import { defineStore } from 'pinia';
import {
  getCustomer as getCustomerService,
  getCustomerContactMechs,
  getCustomerOrders
} from '@/services/customer';
import type { ContactMech, Customer, Order } from '@/types/order';

export const useCustomerStore = defineStore('customers', {
  state: () => ({
    cache: {} as Record<string, Customer>,
    contactMechsByCustomer: {} as Record<string, ContactMech[]>,
    ordersByCustomer: {} as Record<string, Order[]>,
    orderTotalsByCustomer: {} as Record<string, number>,
    fetchStatus: {
      detail: 'none',
      contactMechs: 'none',
      orders: 'none'
    } as Record<string, string>,
    errors: {} as Record<string, string>
  }),
  getters: {
    getCustomer: (state) => (partyId: string) => state.cache[partyId],
    getCustomerContactMechs: (state) => (partyId: string) => state.contactMechsByCustomer[partyId] || [],
    getCustomerOrders: (state) => (partyId: string) => state.ordersByCustomer[partyId] || [],
  },
  actions: {
    async loadCustomer(partyId: string) {
      this.fetchStatus.detail = 'pending';
      this.errors = {};

      try {
        const customer = await getCustomerService(partyId);
        this.cache[customer.id] = customer;
        await this.loadCustomerSections(customer.id);
        this.fetchStatus.detail = 'success';
        return this.cache[customer.id];
      } catch (error: any) {
        this.fetchStatus.detail = 'error';
        this.errors.detail = error?.message || 'Failed to load customer';
        return Promise.reject(error);
      }
    },
    async loadCustomerSections(partyId: string) {
      const results = await Promise.allSettled([
        getCustomerContactMechs(partyId),
        getCustomerOrders(partyId, { pageSize: 10, pageIndex: 0 }),
      ]);
      const [contactMechs, orders] = results;

      if (contactMechs.status === 'fulfilled') {
        this.contactMechsByCustomer[partyId] = contactMechs.value.contactMechs;
        this.fetchStatus.contactMechs = 'success';
        this.cache[partyId] = {
          ...this.cache[partyId],
          contactMechs: contactMechs.value.contactMechs,
          emails: contactMechs.value.emails,
          phones: contactMechs.value.phones,
          postalAddresses: contactMechs.value.postalAddresses,
          email: contactMechs.value.emails[0]?.infoString || this.cache[partyId]?.email || '',
          phone: contactMechs.value.phones[0]?.infoString || this.cache[partyId]?.phone || '',
          addresses: contactMechs.value.postalAddresses.map((contactMech) => ({
            label: contactMech.contactMechPurposeTypeId || 'Address',
            lines: [
              contactMech.postalAddress?.address1,
              contactMech.postalAddress?.address2,
              [
                contactMech.postalAddress?.city,
                contactMech.postalAddress?.stateProvinceGeoId,
                contactMech.postalAddress?.postalCode
              ].filter(Boolean).join(', '),
              contactMech.postalAddress?.countryGeoId
            ].filter(Boolean) as string[]
          }))
        };
      } else {
        this.errors.contactMechs = sectionErrorMessage(contactMechs.reason);
        this.fetchStatus.contactMechs = 'error';
      }

      if (orders.status === 'fulfilled') {
        this.ordersByCustomer[partyId] = orders.value.orders;
        this.orderTotalsByCustomer[partyId] = orders.value.total;
        this.fetchStatus.orders = 'success';
      } else {
        this.errors.orders = sectionErrorMessage(orders.reason);
        this.fetchStatus.orders = 'error';
      }
    }
  },
  persist: true,
});

function sectionErrorMessage(error: any) {
  return error?.message || 'Section failed to load';
}
