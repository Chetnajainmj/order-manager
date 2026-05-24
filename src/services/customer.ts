import { api } from '@common';
import {
  allDocs,
  buildRelatedDataDocumentPayload,
  defaultDataDocuments,
  normalizeCustomerDoc,
  normalizeOrderCollectionResponse,
  normalizeOrderDoc,
  orderLookupFields,
  toStringValue,
  uniqueStrings
} from './OrderService';
import type { ContactMech, Customer, Order } from '@/types/order';

export interface CustomerSearchParams {
  queryString?: string;
  status?: string;
  partyTypeId?: string;
  loyaltyTier?: string;
  pageSize?: number;
  pageIndex?: number;
}

export interface CustomerSearchResult {
  customers: Customer[];
  total: number;
}

export interface CustomerContactMechResult {
  contactMechs: ContactMech[];
  emails: ContactMech[];
  phones: ContactMech[];
  postalAddresses: ContactMech[];
}

export interface CustomerOrderResult {
  orders: Order[];
  total: number;
}

export interface CustomerOrderParams {
  pageSize?: number;
  pageIndex?: number;
}

export function buildCustomerSearchRequests(params: CustomerSearchParams = {}) {
  const baseParams: Record<string, string | number> = {
    dependentLevels: 1,
    pageSize: Number(params.pageSize ?? 50),
    pageIndex: Number(params.pageIndex ?? 0)
  };
  const searchTerm = params.queryString?.trim();

  if (params.status && params.status !== 'All') baseParams.statusId = params.status;

  if (!searchTerm) {
    if (params.partyTypeId && params.partyTypeId !== 'All') baseParams.partyTypeId = params.partyTypeId;
    else if (!params.partyTypeId) baseParams.partyTypeId = 'PERSON';
    return [baseParams];
  }

  if (isPartyIdSearch(searchTerm)) {
    return [{
      partyId: searchTerm,
      ...baseParams
    }];
  }

  const requestedPartyType = params.partyTypeId && params.partyTypeId !== 'All' ? params.partyTypeId : '';
  const tokens = searchTerm.split(/\s+/).filter(Boolean);

  if (tokens.length > 1) {
    return [{
      partyTypeId: requestedPartyType || 'PERSON',
      firstName_op: 'contains',
      firstName: tokens[0],
      lastName_op: 'contains',
      lastName: tokens[tokens.length - 1],
      ...baseParams
    }];
  }

  if (requestedPartyType === 'PARTY_GROUP') {
    return [{
      partyTypeId: 'PARTY_GROUP',
      groupName_op: 'contains',
      groupName: searchTerm,
      ...baseParams
    }];
  }

  if (requestedPartyType === 'PERSON') {
    return [{
      partyTypeId: 'PERSON',
      lastName_op: 'contains',
      lastName: searchTerm,
      ...baseParams
    }];
  }

  return [
    {
      partyTypeId: 'PERSON',
      lastName_op: 'contains',
      lastName: searchTerm,
      ...baseParams
    },
    {
      partyTypeId: 'PARTY_GROUP',
      groupName_op: 'contains',
      groupName: searchTerm,
      ...baseParams
    }
  ];
}

export async function searchCustomers(params: CustomerSearchParams = {}): Promise<CustomerSearchResult> {
  const searchTerm = params.queryString?.trim();

  if (searchTerm && (searchTerm.includes('@') || isPhoneSearch(searchTerm))) {
    return searchCustomersByContact(searchTerm, params);
  }

  const responses = await Promise.all(buildCustomerSearchRequests(params).map((requestParams) => api({
    url: 'oms/parties',
    method: 'get',
    params: requestParams
  })));
  const customersById = new Map<string, Customer>();
  let total = 0;

  responses.forEach((response) => {
    const docs = responseList(response.data);
    docs.map((doc: any) => normalizeCustomerDoc(doc)).forEach((customer) => {
      if (customer.id) customersById.set(customer.id, customer);
    });
    total += responseTotal(response.data, docs.length);
  });

  const customers = [...customersById.values()];
  return {
    customers,
    total: responses.length > 1 ? customers.length : total
  };
}

export async function getCustomer(partyId: string): Promise<Customer> {
  const response = await api({
    url: `oms/parties/${partyId}`,
    method: 'get'
  });

  return normalizeCustomerDoc(response.data, partyId);
}

export async function getCustomerContactMechs(partyId: string): Promise<CustomerContactMechResult> {
  const response = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: buildRelatedDataDocumentPayload(
      defaultDataDocuments.customerContactLookup,
      'partyid',
      partyId
    )
  });
  const contactMechs = allDocs(response.data).map(normalizeContactMech);

  return groupContactMechs(contactMechs);
}

export async function getCustomerOrders(partyId: string, params: CustomerOrderParams = {}): Promise<CustomerOrderResult> {
  const roleResponse = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: {
      dataDocumentId: defaultDataDocuments.orderRoleLookup,
      format: 'json',
      customParametersMap: {
        partyId,
        partyid: partyId,
        roleTypeId: 'PLACING_CUSTOMER',
        roletypeid: 'PLACING_CUSTOMER'
      },
      pageSize: Number(params.pageSize ?? 10),
      pageIndex: Number(params.pageIndex ?? 0)
    }
  });

  const roleDocs = allDocs(roleResponse.data);
  const total = Number(roleResponse.data?.count ?? roleResponse.data?.total ?? roleResponse.data?.response?.numFound ?? roleDocs.length);

  if (!roleDocs.length) {
    return { orders: [], total };
  }

  const orderPromises = roleDocs.map(async (roleDoc: any) => {
    const orderId = toStringValue(roleDoc.orderId ?? roleDoc.orderid);
    if (!orderId) return null;

    try {
      const orderResponse = await api({
        url: 'oms/dataDocumentView',
        method: 'post',
        data: {
          dataDocumentId: defaultDataDocuments.orderLookup,
          format: 'json',
          fieldsToSelect: orderLookupFields,
          customParametersMap: {
            hcOrderId: orderId
          },
          pageSize: 1,
          pageIndex: 0
        }
      });
      const doc = allDocs(orderResponse.data)[0];
      return doc ? normalizeOrderDoc(doc) : null;
    } catch (error) {
      console.error(`Failed to fetch details for order ${orderId}`, error);
      return null;
    }
  });

  const orders = (await Promise.all(orderPromises)).filter(Boolean) as Order[];

  return {
    orders,
    total
  };
}

export function groupContactMechs(contactMechs: ContactMech[]): CustomerContactMechResult {
  return {
    contactMechs,
    emails: contactMechs.filter((contactMech) => contactMech.contactMechTypeId === 'EMAIL_ADDRESS'),
    phones: contactMechs.filter((contactMech) => contactMech.contactMechTypeId === 'TELECOM_NUMBER'),
    postalAddresses: contactMechs.filter((contactMech) => contactMech.contactMechTypeId === 'POSTAL_ADDRESS')
  };
}

function normalizeContactMech(doc: any): ContactMech {
  const contactMechTypeId = readContactField(doc, 'contactMechTypeId');

  return {
    contactMechId: readContactField(doc, 'contactMechId'),
    contactMechTypeId,
    contactMechPurposeTypeId: readContactField(doc, 'contactMechPurposeTypeId'),
    infoString: contactMechTypeId === 'TELECOM_NUMBER' ? formatPhone(doc) : readContactField(doc, 'infoString'),
    postalAddress: contactMechTypeId === 'POSTAL_ADDRESS' ? {
      address1: readContactField(doc, 'address1'),
      address2: readContactField(doc, 'address2'),
      city: readContactField(doc, 'city'),
      stateProvinceGeoId: readContactField(doc, 'stateProvinceGeoId'),
      postalCode: readContactField(doc, 'postalCode'),
      countryGeoId: readContactField(doc, 'countryGeoId')
    } : undefined,
    expireDate: readContactField(doc, 'expireDate')
  };
}

function formatPhone(doc: any) {
  const countryCode = readContactField(doc, 'countryCode');
  const areaCode = readContactField(doc, 'areaCode');
  const contactNumber = readContactField(doc, 'contactNumber');
  const phone = [countryCode ? `+${countryCode}` : '', areaCode, contactNumber].filter(Boolean).join(' ');

  return phone || readContactField(doc, 'infoString');
}

function readContactField(doc: any, fieldName: string) {
  return toStringValue(doc[fieldName] ?? doc[fieldName.toLowerCase()]);
}

async function searchCustomersByContact(searchTerm: string, params: CustomerSearchParams): Promise<CustomerSearchResult> {
  const contactField = searchTerm.includes('@') ? 'infoString' : 'contactNumber';
  const response = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: {
      dataDocumentId: defaultDataDocuments.customerContactLookup,
      format: 'json',
      customParametersMap: {
        [contactField]: searchTerm
      },
      pageSize: Number(params.pageSize ?? 50),
      pageIndex: Number(params.pageIndex ?? 0)
    }
  });
  const contactDocs = allDocs(response.data);
  const partyIds = uniqueStrings(contactDocs.map((doc: any) => readContactField(doc, 'partyId')));

  if (!partyIds.length) {
    return { customers: [], total: 0 };
  }

  const customers = await Promise.all(partyIds.map(getCustomer));
  const filteredCustomers = customers.filter((customer) => {
    if (params.status && params.status !== 'All' && customer.statusId !== params.status) return false;
    if (params.partyTypeId && params.partyTypeId !== 'All' && customer.partyTypeId !== params.partyTypeId) return false;
    return true;
  });

  return {
    customers: filteredCustomers,
    total: filteredCustomers.length
  };
}

function responseList(data: any) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.list)) return data.list;
  return allDocs(data);
}

function responseTotal(data: any, fallback: number) {
  return Number(data?.count ?? data?.total ?? data?.documentDataCount ?? data?.response?.numFound ?? fallback);
}

function isPartyIdSearch(value: string) {
  return /^10\d+$/.test(value);
}

function isPhoneSearch(value: string) {
  return /^\d{7,}$/.test(value.replace(/[^\d]/g, ''));
}
