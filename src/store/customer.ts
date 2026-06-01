import { defineStore } from 'pinia';
import {
  createPartyRelationship,
  expirePartyRelationship,
  getCustomerOrdersFromSolr,
  getCustomerProfile,
  getCustomerRelationships,
  getCustomerTasks
} from '@/services/customer';
import type {
  ContactSection,
  CustomerCommunicationSummary,
  CustomerOrderSummary,
  CustomerProfile,
  CustomerRelationship,
  CustomerReturnSummary,
  CustomerTaskSummary,
  CustomerTimelineEvent,
  LoadStatus,
  SourceEntry
} from '@/types/customer';

// Relationship taxonomy for splitting the Relationships card vs the Merged
// contacts (duplicate) card. Personal types are the blood-relative set seeded
// for the first build, plus the parent types.
const DUPLICATE_REL_TYPE = 'DUPLICATE';
const PERSONAL_REL_TYPES = new Set(['PERSONAL_REL', 'BLOOD_REL', 'MOTHER', 'FATHER', 'CHILD', 'SIBLING']);

const CONTACT_SECTION_DEFS: Array<{ key: string; label: string; contactMechTypeId: string }> = [
  { key: 'email', label: 'Email', contactMechTypeId: 'EMAIL_ADDRESS' },
  { key: 'phone', label: 'Phone', contactMechTypeId: 'TELECOM_NUMBER' },
  { key: 'address', label: 'Address', contactMechTypeId: 'POSTAL_ADDRESS' }
];

type SectionKey = 'profile' | 'recentOrders' | 'tasks' | 'unfillable' | 'returns' | 'communications';

interface CustomerDetailState {
  currentPartyId: string;
  profilesById: Record<string, SourceEntry<CustomerProfile | null>>;
  recentOrdersByPartyId: Record<string, SourceEntry<CustomerOrderSummary[]>>;
  tasksByPartyId: Record<string, SourceEntry<CustomerTaskSummary[]>>;
  unfillableByPartyId: Record<string, SourceEntry<CustomerOrderSummary[]>>;
  returnsByPartyId: Record<string, SourceEntry<CustomerReturnSummary[]>>;
  communicationsByPartyId: Record<string, SourceEntry<CustomerCommunicationSummary[]>>;
  relationshipsByPartyId: Record<string, SourceEntry<CustomerRelationship[]>>;
  lifetimeByPartyId: Record<string, { orders: number; value: number; currencyUom: string; firstOrderDate: string }>;
}

function newSource<T>(payload: T): SourceEntry<T> {
  return { payload, status: 'idle', loadedAt: '', error: '' };
}

function contactDisplay(contactMech: CustomerProfile['contactMechs'][number]): string {
  if (contactMech.contactMechTypeId === 'TELECOM_NUMBER' && contactMech.telecomNumber) {
    const { countryCode, areaCode, contactNumber } = contactMech.telecomNumber;
    return [countryCode, areaCode, contactNumber].filter(Boolean).join(' ').trim() || contactMech.infoString;
  }
  if (contactMech.contactMechTypeId === 'POSTAL_ADDRESS' && contactMech.postalAddress) {
    const address = contactMech.postalAddress;
    return [
      address.address1,
      address.address2,
      [address.city, address.stateProvinceGeoId, address.postalCode].filter(Boolean).join(', '),
      address.countryGeoId
    ].filter(Boolean).join(', ');
  }
  return contactMech.infoString;
}

function isActiveThru(thruDate?: string): boolean {
  if (!thruDate) return true;
  const millis = Number(thruDate);
  return Number.isFinite(millis) ? millis > Date.now() : true;
}

function relationshipKey(relationship: CustomerRelationship): string {
  return [
    relationship.partyIdFrom,
    relationship.partyIdTo,
    relationship.roleTypeIdFrom,
    relationship.roleTypeIdTo,
    relationship.fromDate
  ].join('|');
}

function allRelationships(profile: CustomerProfile | null, loadedRelationships: CustomerRelationship[] = []): CustomerRelationship[] {
  const relationships = [
    ...(profile?.relationshipsFrom || []),
    ...(profile?.relationshipsTo || []),
    ...loadedRelationships
  ];
  const seen = new Set<string>();

  return relationships.filter((relationship) => {
    const key = relationshipKey(relationship);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const useCustomerStore = defineStore('customerDetail', {
  state: (): CustomerDetailState => ({
    currentPartyId: '',
    profilesById: {},
    recentOrdersByPartyId: {},
    tasksByPartyId: {},
    unfillableByPartyId: {},
    returnsByPartyId: {},
    communicationsByPartyId: {},
    relationshipsByPartyId: {},
    lifetimeByPartyId: {}
  }),

  getters: {
    currentCustomer(state): CustomerProfile | null {
      return state.profilesById[state.currentPartyId]?.payload || null;
    },
    getCustomer: (state) => (partyId: string): CustomerProfile | null =>
      state.profilesById[partyId]?.payload || null,

    lifetimeValue: (state) => (partyId: string): number =>
      state.lifetimeByPartyId[partyId]?.value ?? 0,
    lifetimeOrders: (state) => (partyId: string): number =>
      state.lifetimeByPartyId[partyId]?.orders ?? 0,
    lifetimeCurrency: (state) => (partyId: string): string =>
      state.lifetimeByPartyId[partyId]?.currencyUom || 'USD',

    // "Customer since": prefer the party's createdDate; fall back to the earliest
    // order date, because Shopify-imported customers have no Party.createdDate.
    customerSince: (state) => (partyId: string): string =>
      state.profilesById[partyId]?.payload?.createdStamp
      || state.lifetimeByPartyId[partyId]?.firstOrderDate
      || '',

    sectionStatus: (state) => (partyId: string, section: SectionKey): LoadStatus => {
      const buckets: Record<SectionKey, Record<string, SourceEntry<any>>> = {
        profile: state.profilesById,
        recentOrders: state.recentOrdersByPartyId,
        tasks: state.tasksByPartyId,
        unfillable: state.unfillableByPartyId,
        returns: state.returnsByPartyId,
        communications: state.communicationsByPartyId
      };
      return buckets[section]?.[partyId]?.status || 'idle';
    },
    sectionError: (state) => (partyId: string, section: SectionKey): string => {
      const buckets: Record<SectionKey, Record<string, SourceEntry<any>>> = {
        profile: state.profilesById,
        recentOrders: state.recentOrdersByPartyId,
        tasks: state.tasksByPartyId,
        unfillable: state.unfillableByPartyId,
        returns: state.returnsByPartyId,
        communications: state.communicationsByPartyId
      };
      return buckets[section]?.[partyId]?.error || '';
    },

    // Contact card: one section per type (Email / Phone / Address) with active values.
    contactSections: (state) => (partyId: string): ContactSection[] => {
      const profile = state.profilesById[partyId]?.payload || null;
      const contactMechs = profile?.contactMechs || [];
      return CONTACT_SECTION_DEFS.map((def) => ({
        key: def.key,
        label: def.label,
        contactMechTypeId: def.contactMechTypeId,
        values: contactMechs
          .filter((contactMech) => contactMech.contactMechTypeId === def.contactMechTypeId)
          .map((contactMech) => ({
            display: contactDisplay(contactMech),
            contactMechId: contactMech.contactMechId,
            contactMechTypeId: contactMech.contactMechTypeId,
            contactMechPurposeTypeId: contactMech.contactMechPurposeTypeId,
            active: isActiveThru(contactMech.thruDate)
          }))
      }));
    },

    // Relationships card: personal/blood relationships, excluding duplicate links.
    personalRelationships: (state) => (partyId: string) => {
      const relationships = allRelationships(
        state.profilesById[partyId]?.payload || null,
        state.relationshipsByPartyId[partyId]?.payload || []
      );
      return relationships
        .filter((relationship) => PERSONAL_REL_TYPES.has(relationship.partyRelationshipTypeId))
        .map((relationship) => {
          const isFrom = relationship.partyIdFrom === partyId;
          return {
            relatedPartyId: isFrom ? relationship.partyIdTo : relationship.partyIdFrom,
            relatedPartyName: isFrom ? relationship.toPartyName : relationship.fromPartyName,
            relationshipName: relationship.relationshipName,
            partyRelationshipTypeId: relationship.partyRelationshipTypeId,
            fromDate: relationship.fromDate,
            thruDate: relationship.thruDate,
            active: isActiveThru(relationship.thruDate),
            key: relationshipKey(relationship),
            keyFields: {
              partyIdFrom: relationship.partyIdFrom,
              partyIdTo: relationship.partyIdTo,
              roleTypeIdFrom: relationship.roleTypeIdFrom,
              roleTypeIdTo: relationship.roleTypeIdTo,
              fromDate: relationship.fromDate
            }
          };
        });
    },

    // Merged contacts card: DUPLICATE relationship rows (duplicate -> canonical).
    duplicateRelationships: (state) => (partyId: string) => {
      const relationships = allRelationships(
        state.profilesById[partyId]?.payload || null,
        state.relationshipsByPartyId[partyId]?.payload || []
      );
      return relationships
        .filter((relationship) => relationship.partyRelationshipTypeId === DUPLICATE_REL_TYPE)
        .map((relationship) => ({
          duplicatePartyId: relationship.partyIdFrom,
          canonicalPartyId: relationship.partyIdTo,
          duplicatePartyName: relationship.fromPartyName,
          canonicalPartyName: relationship.toPartyName,
          isCanonical: relationship.partyIdTo === partyId,
          active: isActiveThru(relationship.thruDate),
          key: relationshipKey(relationship)
        }));
    },

    customerTimeline: (state) => (partyId: string): CustomerTimelineEvent[] => {
      const profile = state.profilesById[partyId]?.payload || null;
      if (!profile) return [];
      const events: CustomerTimelineEvent[] = [];
      if (profile.createdStamp) {
        events.push({ id: 'created', type: 'created', label: `Created by ${profile.id}`, at: profile.createdStamp, sourceId: profile.id });
      }
      return events;
    },

    recentOrders: (state) => (partyId: string): CustomerOrderSummary[] =>
      state.recentOrdersByPartyId[partyId]?.payload || [],
    openTasks: (state) => (partyId: string): CustomerTaskSummary[] =>
      state.tasksByPartyId[partyId]?.payload || [],
    unfillableOrders: (state) => (partyId: string): CustomerOrderSummary[] =>
      state.unfillableByPartyId[partyId]?.payload || [],
    returns: (state) => (partyId: string): CustomerReturnSummary[] =>
      state.returnsByPartyId[partyId]?.payload || [],
    communications: (state) => (partyId: string): CustomerCommunicationSummary[] =>
      state.communicationsByPartyId[partyId]?.payload || []
  },

  actions: {
    setCurrentCustomer(partyId: string) {
      this.currentPartyId = partyId;
      return this.loadCustomerDashboard(partyId);
    },

    // Prefetch on detail route mount. Profile failure fails the page; section
    // failures (orders/tasks) are isolated to their own source bucket.
    async loadCustomerDashboard(partyId: string, force = false) {
      await Promise.allSettled([
        this.loadCustomerProfile(partyId, force),
        this.loadCustomerOrders(partyId, force),
        this.loadCustomerTasks(partyId, force),
        this.loadCustomerRelationships(partyId, force)
      ]);
    },

    async loadCustomerProfile(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.profilesById[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.profilesById[partyId] = { ...(existing || newSource<CustomerProfile | null>(null)), status: 'loading', error: '' };
      try {
        const profile = await getCustomerProfile(partyId);
        this.profilesById[partyId] = {
          payload: profile,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: ''
        };
      } catch (error: any) {
        this.profilesById[partyId] = {
          payload: null,
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load customer'
        };
      }
    },

    async loadCustomerOrders(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.recentOrdersByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.recentOrdersByPartyId[partyId] = { ...(existing || newSource<CustomerOrderSummary[]>([])), status: 'loading', error: '' };
      try {
        const result = await getCustomerOrdersFromSolr(partyId, { pageSize: 100 });
        this.recentOrdersByPartyId[partyId] = {
          payload: result.orders,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          total: result.lifetimeOrders
        };
        this.lifetimeByPartyId[partyId] = {
          orders: result.lifetimeOrders,
          value: result.lifetimeValue,
          currencyUom: result.currencyUom,
          firstOrderDate: result.firstOrderDate
        };
      } catch (error: any) {
        this.recentOrdersByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load orders'
        };
      }
    },

    async loadCustomerTasks(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.tasksByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.tasksByPartyId[partyId] = { ...(existing || newSource<CustomerTaskSummary[]>([])), status: 'loading', error: '' };
      try {
        const tasks = await getCustomerTasks(partyId, { statusId: 'ORD_HOLD_OPEN' });
        this.tasksByPartyId[partyId] = {
          payload: tasks,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          total: tasks.length
        };
      } catch (error: any) {
        this.tasksByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load tasks'
        };
      }
    },

    async loadCustomerRelationships(partyId: string, force = false) {
      if (!partyId) return;
      const existing = this.relationshipsByPartyId[partyId];
      if (existing?.status === 'loaded' && !force) return;

      this.relationshipsByPartyId[partyId] = { ...(existing || newSource<CustomerRelationship[]>([])), status: 'loading', error: '' };
      try {
        const relationships = await getCustomerRelationships(partyId);
        this.relationshipsByPartyId[partyId] = {
          payload: relationships,
          status: 'loaded',
          loadedAt: new Date().toISOString(),
          error: '',
          total: relationships.length
        };
      } catch (error: any) {
        this.relationshipsByPartyId[partyId] = {
          payload: [],
          status: 'error',
          loadedAt: '',
          error: error?.message || 'Failed to load relationships'
        };
      }
    },

    async createRelationship(input: { partyIdFrom: string; partyIdTo: string; partyRelationshipTypeId: string; fromDate: string; comments?: string }) {
      await createPartyRelationship(input);
      const partyId = this.currentPartyId || input.partyIdFrom;
      await Promise.all([
        this.loadCustomerProfile(partyId, true),
        this.loadCustomerRelationships(partyId, true)
      ]);
    },

    async expireRelationship(key: { partyIdFrom: string; partyIdTo: string; roleTypeIdFrom: string; roleTypeIdTo: string; fromDate: string }, thruDate: string) {
      await expirePartyRelationship(key, thruDate);
      await Promise.all([
        this.loadCustomerProfile(this.currentPartyId, true),
        this.loadCustomerRelationships(this.currentPartyId, true)
      ]);
    },

    refreshCustomer(partyId: string) {
      return this.loadCustomerDashboard(partyId, true);
    }
  },

  // Customer detail is PII composed from several freshness-sensitive sources;
  // it should behave like orderDetail, not the persisted search stores.
  persist: false
});
