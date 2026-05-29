import { api, commonUtil, useSolrSearch } from '@common';
import {
  allDocs,
  buildRelatedDataDocumentPayload,
  defaultDataDocuments,
  mergeOrderNoteDocs,
  normalizeOrderNoteDoc,
  normalizeOrderStatusDoc,
  normalizeOrderDoc,
  orderNoteLookupFields,
  orderRoleLookupFields,
  noteDataLookupFields,
  selectCustomerIdFromRoles,
  toNumberValue,
  toStringList,
  toStringValue,
  uniqueStrings,
  type OrderSearchResult
} from './OrderService';
import type {
  Address,
  CommunicationEvent,
  Order,
  OrderAttribute,
  OrderItem,
  OrderNote,
  OrderRole,
  OrderStatusChange,
  OrderTerm,
  PaymentPreference,
  ReturnRecord,
  Shipment
} from '@/types/order';

export interface OrderSearchParams {
  queryString?: string;
  status?: string | string[];
  channel?: string;
  productStoreId?: string;
  dateFrom?: string;
  dateThru?: string;
  sort?: string;
  pageSize?: number;
  pageIndex?: number;
}

const orderSolrFields = [
  'orderId',
  'orderName',
  'externalOrderId',
  'externalId',
  'orderDate',
  'orderStatusId',
  'orderStatusDesc',
  'statusId',
  'customerPartyId',
  'customerPartyName',
  'customerFirstName',
  'customerLastName',
  'customerName',
  'customerEmailId',
  'customerPhoneNumber',
  'partyId',
  'salesChannelEnumId',
  'salesChannelDesc',
  'productStoreId',
  'productStoreName',
  'grandTotal',
  'currencyUom',
  'presentmentCurrencyUom',
  'shipmentMethodTypeId',
  'shipmentMethodDesc',
  'shipmentId',
  'returnId',
  'priority'
];

const orderSearchQueryFields = [
  'orderId^20',
  'orderName^20',
  'externalOrderId^15',
  'externalId^15',
  'search_orderIdentifications^15',
  'customerPartyId^10',
  'customerPartyName^12',
  'customerName^12',
  'customerEmailId^10',
  'customerPhoneNumber^10',
  'productId^6',
  'productName^6',
  'internalName^6',
  'parentProductName^4',
  'goodIdentifications^6',
  'orderNotes^4',
  'salesChannelDesc',
  'productStoreName',
  'shipmentId',
  'returnId'
];

export function buildOrderLookupPayload(params: OrderSearchParams = {}) {
  const viewSize = Number(params.pageSize ?? 50);
  const viewIndex = Number(params.pageIndex ?? 0);
  const searchTerm = params.queryString?.trim() ?? '';
  const filters = ['docType: ORDER', 'orderTypeId: SALES_ORDER'];
  const statusIds = selectedStatuses(params.status);

  if (statusIds.length === 1) filters.push(`orderStatusId:${escapeSolrValue(statusIds[0])}`);
  if (statusIds.length > 1) filters.push(`orderStatusId:(${statusIds.map(escapeSolrValue).join(' OR ')})`);
  if (params.channel && params.channel !== 'All') filters.push(`salesChannelEnumId: ${escapeSolrValue(params.channel)}`);
  if (params.productStoreId && params.productStoreId !== 'All') filters.push(`productStoreId: ${escapeSolrValue(params.productStoreId)}`);

  const dateFilter = buildOrderDateSolrFilter(params.dateFrom, params.dateThru);
  if (dateFilter) filters.push(dateFilter);

  const payload = {
    json: {
      params: {
        sort: params.sort ?? 'orderDate desc',
        rows: viewSize,
        start: viewSize * viewIndex,
        group: true,
        'group.field': 'orderId',
        'group.limit': 10000,
        'group.ngroups': true,
        'q.op': 'AND',
        fl: orderSolrFields.join(' ')
      } as Record<string, any>,
      query: '*:*',
      filter: filters
    }
  };

  if (searchTerm) {
    payload.json.params.defType = 'edismax';
    payload.json.params.qf = orderSearchQueryFields.join(' ');
    payload.json.query = buildOrderSearchQuery(searchTerm);
  }

  return payload;
}

export async function searchOrders(params: OrderSearchParams = {}): Promise<OrderSearchResult> {
  const response = await useSolrSearch().runSolrQuery(buildOrderLookupPayload(params));

  if (commonUtil.hasError(response)) return Promise.reject(response.data);

  return normalizeOrderSolrResponse(response.data);
}

function normalizeOrderSolrResponse(data: any): OrderSearchResult {
  const groupedOrders = data?.grouped?.orderId;

  if (groupedOrders?.groups?.length) {
    return {
      orders: groupedOrders.groups
        .map((group: any) => group?.doclist?.docs?.[0])
        .filter(Boolean)
        .map(normalizeOrderDoc),
      total: Number(groupedOrders.ngroups ?? groupedOrders.matches ?? groupedOrders.groups.length)
    };
  }

  const docs = allDocs(data);
  return {
    orders: docs.map(normalizeOrderDoc),
    total: Number(data?.response?.numFound ?? docs.length)
  };
}

function buildOrderSearchQuery(searchTerm: string) {
  const escapedTerm = escapeSolrValue(searchTerm);
  const tokens = searchTerm
    .split(/\s+/)
    .map((token) => escapeSolrValue(token))
    .filter(Boolean);

  if (!tokens.length) return '*:*';

  return `(${tokens.map((token) => `${token}*`).join(' OR ')} OR "${escapedTerm}"^100)`;
}

function buildOrderDateSolrFilter(dateFrom?: string, dateThru?: string) {
  if (!dateFrom && !dateThru) return '';

  const fromDate = dateFrom ? `${dateFrom.split('T')[0]}T00:00:00Z` : '*';
  const thruDate = dateThru ? `${dateThru.split('T')[0]}T23:59:59Z` : '*';

  return `orderDate: [${fromDate} TO ${thruDate}]`;
}

function selectedStatuses(status?: string | string[]) {
  const statuses = Array.isArray(status) ? status : [status];
  return [...new Set(statuses.filter((statusId): statusId is string => Boolean(statusId && statusId !== 'All')))];
}

function escapeSolrValue(value: string) {
  return String(value).replace(/([\\+\-!(){}[\]^"~*?:]|&&|\|\|)/g, '\\$1');
}

export async function getOrder(orderId: string): Promise<Order> {
  const response = await api({
    url: `oms/orders/${orderId}`,
    method: 'get'
  });

  return normalizeOrderDetail(response.data?.orderDetail ?? response.data);
}

export async function getOrderStatusHistory(orderId: string): Promise<OrderStatusChange[]> {
  const response = await api({
    url: `oms/orders/${orderId}/status`,
    method: 'get'
  });

  return responseList(response.data).map(normalizeStatusChange);
}

export async function getOrderAttributes(orderId: string): Promise<OrderAttribute[]> {
  const response = await api({
    url: `oms/orders/${orderId}/attributes`,
    method: 'get'
  });

  return responseList(response.data).map(normalizeOrderAttribute);
}

export async function getOrderNotes(orderId: string): Promise<OrderNote[]> {
  const noteResponse = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: buildRelatedDataDocumentPayload(
      defaultDataDocuments.orderNoteLookup,
      'orderId',
      orderId,
      orderNoteLookupFields
    )
  });
  const noteDocs = allDocs(noteResponse.data);

  if (!noteDocs.length) return [];

  const noteDataDocs = await Promise.all(noteDocs.map(async (noteDoc) => {
    const noteId = toStringValue(noteDoc.noteId);
    if (!noteId) return undefined;

    const noteDataResponse = await api({
      url: 'oms/dataDocumentView',
      method: 'post',
      data: buildRelatedDataDocumentPayload(
        defaultDataDocuments.noteDataLookup,
        'noteId',
        noteId,
        noteDataLookupFields
      )
    });

    return allDocs(noteDataResponse.data)[0];
  }));

  return mergeOrderNoteDocs(noteDocs, noteDataDocs.filter(Boolean)).map(normalizeNote);
}

export async function getOrderRoles(orderId: string): Promise<OrderRole[]> {
  const response = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: buildRelatedDataDocumentPayload(
      defaultDataDocuments.orderRoleLookup,
      'orderId',
      orderId,
      orderRoleLookupFields
    )
  });

  return allDocs(response.data).map(normalizeOrderRole);
}

export async function getOrderCommunicationEvents(orderId: string): Promise<CommunicationEvent[]> {
  const response = await api({
    url: 'oms/communicationEvents',
    method: 'get',
    params: { orderId }
  });

  return responseList(response.data).map(normalizeCommunicationEvent);
}

export async function getOrderShipments(orderId: string): Promise<Shipment[]> {
  const response = await api({
    url: 'poorti/orderShipmentAndRouteSegments',
    method: 'get',
    params: { orderId }
  });

  return responseList(response.data).map((doc) => ({
    id: toStringValue(doc.shipmentId),
    orderId,
    status: toStringValue(doc.statusId ?? doc.shipmentStatusId ?? doc.status),
    carrier: toStringValue(doc.carrierPartyId ?? doc.carrierServiceStatusId),
    trackingCode: toStringValue(doc.trackingCode ?? doc.trackingIdNumber),
    origin: toStringValue(doc.originFacilityId ?? doc.facilityId),
    destination: toStringValue(doc.destinationFacilityId),
    shipDate: toStringValue(doc.estimatedShipDate ?? doc.actualShipDate ?? doc.createdDate),
    itemIds: toStringList(doc.orderItemSeqId),
    packages: []
  })).filter((shipment) => shipment.id);
}

export async function getOrderReturns(orderId: string): Promise<ReturnRecord[]> {
  const response = await api({
    url: 'oms/returns',
    method: 'get',
    params: {
      primaryOrderId: orderId,
      dependentLevels: 2
    }
  });

  return responseList(response.data)
    .filter((doc) => {
      const items = responseList(doc.items);
      return items.some((item: any) => toStringValue(item.orderId) === orderId);
    })
    .map((doc) => ({
      id: toStringValue(doc.returnId),
      orderId,
      status: toStringValue(doc.statusId ?? doc.status),
      reason: toStringValue(doc.returnReasonId ?? doc.returnHeaderTypeId),
      requestedDate: toStringValue(doc.entryDate ?? doc.createdDate),
      receivedDate: toStringValue(doc.receivedDate) || undefined,
      itemIds: toStringList(doc.orderItemSeqId ?? doc.returnItemSeqId),
      refundTotal: toNumberValue(doc.returnTotal ?? doc.grandTotal)
    })).filter((returnRecord) => returnRecord.id);
}

export interface AddOrderNotePayload {
  noteName?: string;
  noteInfo: string;
  internalNote: boolean;
}

export interface CommunicationEventPayload {
  communicationEventTypeId?: string;
  origCommEventId?: string;
  parentCommEventId?: string;
  statusId?: string;
  contactMechTypeId?: string;
  contactMechIdFrom?: string;
  contactMechIdTo?: string;
  roleTypeIdFrom?: string;
  roleTypeIdTo?: string;
  partyIdFrom?: string;
  partyIdTo?: string;
  datetimeStarted?: string;
  datetimeEnded?: string;
  subject?: string;
  contentMimeTypeId?: string;
  content?: string;
  note?: string;
  reasonEnumId?: string;
  contactListId?: string;
  headerString?: string;
  fromString?: string;
  toString?: string;
  ccString?: string;
  bccString?: string;
  messageId?: string;
  externalId?: string;
  action?: 'REPLY' | 'REPLYALL' | 'FORWARD' | '';
}

export interface OrderItemUpdatePayload {
  quantity?: number;
  unitPrice?: number;
  statusId?: string;
}

export interface OrderItemsActionPayload {
  orderItemSeqIds: string[];
  reason?: string;
}

export interface InventoryActionPayload {
  facilityId?: string;
  quantity?: number;
  shipGroupSeqId?: string;
}

export interface ShipGroupUpdatePayload {
  shipmentMethodTypeId?: string;
  carrierPartyId?: string;
  facilityId?: string;
  contactMechId?: string;
  telecomContactMechId?: string;
  shippingInstructions?: string;
  maySplit?: 'Y' | 'N' | string;
  giftMessage?: string;
  isGift?: 'Y' | 'N' | string;
  shipAfterDate?: string;
  shipByDate?: string;
  estimatedShipDate?: string;
  estimatedDeliveryDate?: string;
}

export interface ShipToStorePayload {
  shipGroupSeqId: string;
  facilityId?: string;
  orderFacilityId?: string;
}

export type PoortiDocumentName = 'PackingSlip.pdf' | 'Label.pdf' | 'PackingSlipAndLabel.pdf';

export async function addOrderNote(orderId: string, payload: AddOrderNotePayload) {
  return api({
    url: `oms/orders/${orderId}/notes`,
    method: 'post',
    data: {
      orderId,
      noteName: payload.noteName,
      noteInfo: payload.noteInfo,
      internalNote: payload.internalNote ? 'Y' : 'N'
    }
  });
}

export async function cancelOrderItem(orderId: string, orderItemSeqId: string, reason = '') {
  return api({
    url: `oms/orders/${orderId}/items/${orderItemSeqId}/cancel`,
    method: 'post',
    data: {
      orderId,
      orderItemSeqId,
      reason
    }
  });
}

export async function rejectOrderItem(orderId: string, orderItemSeqId: string, reason = '') {
  return api({
    url: `oms/orders/${orderId}/items/${orderItemSeqId}/reject`,
    method: 'post',
    data: {
      orderId,
      orderItemSeqId,
      reason
    }
  });
}

export async function updateOrderItem(orderId: string, orderItemSeqId: string, payload: OrderItemUpdatePayload) {
  return api({
    url: `oms/orders/${orderId}/items/${orderItemSeqId}`,
    method: 'put',
    data: {
      orderId,
      orderItemSeqId,
      ...payload
    }
  });
}

export async function deleteOrderItem(orderId: string, orderItemSeqId: string) {
  return api({
    url: `oms/orders/${orderId}/items/${orderItemSeqId}`,
    method: 'delete'
  });
}

export async function bulkCancelOrderItems(orderId: string, payload: OrderItemsActionPayload) {
  return api({
    url: `oms/orders/${orderId}/items/cancel`,
    method: 'post',
    data: {
      orderId,
      ...payload
    }
  });
}

export async function rejectOrderItems(orderId: string, payload: OrderItemsActionPayload) {
  return api({
    url: `oms/orders/${orderId}/reject`,
    method: 'post',
    data: {
      orderId,
      ...payload
    }
  });
}

export async function createOrderItemReservation(orderId: string, orderItemSeqId: string, payload: InventoryActionPayload) {
  return api({
    url: `oms/orders/${orderId}/items/${orderItemSeqId}/reservation`,
    method: 'post',
    data: {
      orderId,
      orderItemSeqId,
      ...payload
    }
  });
}

export async function cancelOrderItemReservation(orderId: string, orderItemSeqId: string, cancelQuantity?: number) {
  return api({
    url: `oms/orders/${orderId}/items/${orderItemSeqId}/reservation`,
    method: 'delete',
    params: cancelQuantity ? { cancelQuantity } : undefined
  });
}

export async function processOrderItemAllocation(orderId: string, orderItemSeqId: string, payload: InventoryActionPayload) {
  return api({
    url: `oms/orders/${orderId}/items/${orderItemSeqId}/allocation`,
    method: 'post',
    data: {
      orderId,
      orderItemSeqId,
      ...payload
    }
  });
}

export async function processOrderFacilityAllocation(orderId: string, payload: InventoryActionPayload) {
  return api({
    url: `oms/orders/${orderId}/allocation`,
    method: 'post',
    data: {
      orderId,
      ...payload
    }
  });
}

export async function updateOrderShipGroup(orderId: string, shipGroupSeqId: string, payload: ShipGroupUpdatePayload) {
  return api({
    url: `oms/orders/${orderId}/shipGroups/${shipGroupSeqId}`,
    method: 'put',
    data: {
      orderId,
      shipGroupSeqId,
      ...payload
    }
  });
}

export async function convertOrderShipToStore(orderId: string, payload: ShipToStorePayload) {
  return api({
    url: `oms/orders/${orderId}/shipToStore`,
    method: 'post',
    data: {
      orderId,
      ...payload
    }
  });
}

export async function reserveSoftAllocatedInventory(orderId: string) {
  return api({
    url: `oms/orders/${orderId}/soft-allocations/reserve-inventory`,
    method: 'post'
  });
}

export async function sendPickupNotification(orderId: string) {
  return api({
    url: `oms/orders/pickup/${orderId}/notification`,
    method: 'post'
  });
}

export async function sendPickupScheduledNotification(payload: Record<string, string>) {
  return api({
    url: 'oms/orders/pickupScheduledNotification',
    method: 'post',
    data: payload
  });
}

export async function getPoortiDocument(documentName: PoortiDocumentName, params: Record<string, string>) {
  return api({
    url: `poorti/${documentName}`,
    method: 'get',
    params,
    responseType: 'blob'
  });
}

export async function sendOrderEmail(orderId: string, emailType: 'PRDS_ODR_CONFIRM' | 'PRDS_ODR_COMPLETE') {
  return api({
    url: 'oms/orders/sendEmailNotification',
    method: 'post',
    data: {
      orderId,
      emailType
    }
  });
}

export async function createOrderCommunicationEvent(orderId: string, payload: CommunicationEventPayload) {
  return api({
    url: 'oms/communicationEvents',
    method: 'post',
    data: {
      orderId,
      ...payload
    }
  });
}

export async function changeOrderItemStatus(orderId: string, orderItemSeqId: string, statusId: string) {
  return api({
    url: `oms/orders/${orderId}/items/${orderItemSeqId}`,
    method: 'put',
    data: {
      orderId,
      orderItemSeqId,
      statusId
    }
  });
}

function normalizeOrderDetail(detail: any): Order {
  const shipGroups = responseList(detail.shipGroups).map(normalizeShipGroup);
  const directItems = responseList(detail.items).map((item) => normalizeOrderDetailItem(item));
  const shipGroupItems = responseList(detail.shipGroups).flatMap((shipGroup) => {
    const normalizedShipGroup = normalizeShipGroup(shipGroup);
    return responseList(shipGroup.items).map((item) => normalizeOrderDetailItem(item, normalizedShipGroup));
  });
  const roles = responseList(detail.roles).map(normalizeOrderRole);
  const payments = responseList(detail.paymentPreferences ?? detail.payments).map(normalizePaymentPreference);
  const terms = responseList(detail.terms ?? detail.orderTerms).map(normalizeOrderTerm);
  const contactInfo = normalizeContactInfo(detail);
  const orderId = toStringValue(detail.orderId ?? detail.hcOrderId);
  const customerName = [detail.customerFirstName, detail.customerLastName].map((value) => toStringValue(value)).filter(Boolean).join(' ');

  return {
    id: orderId,
    externalId: toStringValue(detail.orderName ?? detail.externalId ?? detail.orderExternalId, orderId),
    orderDate: toStringValue(detail.orderDate ?? detail.orderEntryDate),
    status: toStringValue(detail.orderStatusId ?? detail.statusId ?? detail.orderStatusDesc, 'Created'),
    customerId: selectCustomerIdFromRoles(responseList(detail.roles)) || toStringValue(detail.partyId ?? detail.customerPartyId),
    customerName,
    channel: toStringValue(detail.salesChannel ?? detail.salesChannelEnumId ?? detail.productStoreId),
    total: toNumberValue(detail.grandTotal),
    currency: toStringValue(detail.currencyUom ?? detail.presentmentCurrencyUom, 'USD'),
    productStoreId: toStringValue(detail.productStoreId),
    entryDate: toStringValue(detail.entryDate),
    paymentStatus: payments.map((payment) => payment.status).find(Boolean) || toStringValue(detail.paymentStatus ?? detail.paymentStatusDesc),
    fulfillmentStatus: toStringValue(detail.fulfillmentStatus ?? detail.orderStatusId ?? detail.statusId),
    deliveryMethod: shipGroups.map((shipGroup) => shipGroup.method).find(Boolean) || toStringValue(detail.shipmentMethodTypeDesc),
    priority: toStringValue(detail.priority ?? detail.orderStatusId ?? detail.statusId),
    items: shipGroupItems.length ? shipGroupItems : directItems,
    shipmentIds: uniqueStrings(shipGroups.map((shipGroup) => shipGroup.shipmentId)),
    returnIds: toStringList(detail.returnId ?? detail.primaryReturnId),
    notes: responseList(detail.notes).map(normalizeNote),
    history: responseList(detail.statuses ?? detail.history).map(normalizeStatusChange),
    payments,
    terms,
    roles,
    attributes: responseList(detail.attributes).map(normalizeOrderAttribute),
    communicationEvents: responseList(detail.communicationEvents).map(normalizeCommunicationEvent),
    shipGroups,
    contactInfo: contactInfo.length ? contactInfo : customerContactInfo(customerName, detail)
  };
}

function normalizeShipGroup(shipGroup: any) {
  return {
    id: toStringValue(shipGroup.shipGroupSeqId),
    shipmentId: toStringValue(shipGroup.shipmentId),
    shipmentMethodTypeId: toStringValue(shipGroup.shipmentMethodTypeId),
    method: toStringValue(shipGroup.shipmentMethodTypeDesc ?? shipGroup.shipmentMethodTypeId),
    status: toStringValue(shipGroup.shipmentStatusId ?? shipGroup.statusId),
    trackingCode: toStringValue(shipGroup.trackingCode ?? shipGroup.trackingIdNumber),
    carrier: toStringValue(shipGroup.carrierPartyId),
    facilityId: toStringValue(shipGroup.facilityId),
    facilityName: toStringValue(shipGroup.facilityName),
    shippingInstructions: toStringValue(shipGroup.shippingInstructions),
    giftMessage: toStringValue(shipGroup.giftMessage),
    maySplit: toStringValue(shipGroup.maySplit),
    isGift: toStringValue(shipGroup.isGift),
    shipAfterDate: toStringValue(shipGroup.shipAfterDate),
    shipByDate: toStringValue(shipGroup.shipByDate),
    estimatedShipDate: toStringValue(shipGroup.estimatedShipDate),
    estimatedDeliveryDate: toStringValue(shipGroup.estimatedDeliveryDate),
    contactMechId: toStringValue(shipGroup.contactMechId),
    telecomContactMechId: toStringValue(shipGroup.telecomContactMechId)
  };
}

function normalizeOrderDetailItem(item: any, shipGroup?: ReturnType<typeof normalizeShipGroup>): OrderItem {
  return {
    id: toStringValue(item.orderItemSeqId),
    sku: toStringValue(item.productId),
    name: toStringValue(item.internalName ?? item.itemDescription ?? item.productName ?? item.productId),
    quantity: toNumberValue(item.quantity),
    shippedQuantity: toNumberValue(item.shippedQuantity, 0),
    cancelledQuantity: toNumberValue(item.cancelQuantity ?? item.cancelledQuantity, 0),
    returnedQuantity: toNumberValue(item.returnedQuantity, 0),
    status: toStringValue(item.itemStatusId ?? item.statusId ?? item.status),
    facility: toStringValue(item.facilityName ?? item.facilityId ?? shipGroup?.facilityName ?? shipGroup?.facilityId),
    unitPrice: toNumberValue(item.unitPrice),
    adjustments: toNumberValue(item.adjustments ?? item.adjustmentAmount, 0),
    shipGroupSeqId: toStringValue(item.shipGroupSeqId ?? shipGroup?.id),
    imageUrl: toStringValue(item.mainImageUrl ?? item.mediumImageUrl ?? item.smallImageUrl ?? item.productImageUrl ?? item.imageUrl)
  };
}

function normalizePaymentPreference(payment: any): PaymentPreference {
  return {
    id: toStringValue(payment.orderPaymentPreferenceId ?? payment.paymentPreferenceId),
    method: toStringValue(payment.paymentMethodTypeId ?? payment.paymentMethodTypeDesc ?? payment.paymentMethodId),
    status: toStringValue(payment.statusId ?? payment.paymentStatusId ?? payment.status),
    amount: toNumberValue(payment.maxAmount ?? payment.amount ?? payment.paymentAmount),
    gatewayResponse: toStringValue(payment.gatewayResponse ?? payment.gatewayCode),
    capturedAt: toStringValue(payment.captureDate ?? payment.capturedDate ?? payment.paymentDate ?? payment.effectiveDate ?? payment.statusDatetime ?? payment.createdDate)
  };
}

function normalizeOrderTerm(term: any): OrderTerm {
  return {
    id: toStringValue(term.orderTermId ?? term.termTypeId),
    type: toStringValue(term.termTypeId ?? term.termTypeDescription),
    value: toStringValue(term.termValue ?? term.termDays ?? term.textValue),
    description: toStringValue(term.description ?? term.termDescription)
  };
}

function normalizeOrderRole(role: any): OrderRole {
  return {
    partyId: toStringValue(role.partyId),
    roleTypeId: toStringValue(role.roleTypeId),
    name: toStringValue(role.partyName) || [role.firstName, role.lastName].map((value) => toStringValue(value)).filter(Boolean).join(' ')
  };
}

function normalizeOrderAttribute(attribute: any): OrderAttribute {
  return {
    name: toStringValue(attribute.attrName ?? attribute.attributeName ?? attribute.name),
    value: toStringValue(attribute.attrValue ?? attribute.attributeValue ?? attribute.value)
  };
}

function normalizeCommunicationEvent(event: any): CommunicationEvent {
  return {
    id: toStringValue(event.communicationEventId ?? event.id),
    subject: toStringValue(event.subject ?? event.content),
    entryDate: toStringValue(event.entryDate ?? event.createdDate),
    statusId: toStringValue(event.statusId),
    typeId: toStringValue(event.communicationEventTypeId ?? event.typeId),
    origCommEventId: toStringValue(event.origCommEventId),
    parentCommEventId: toStringValue(event.parentCommEventId),
    contactMechTypeId: toStringValue(event.contactMechTypeId),
    contactMechIdFrom: toStringValue(event.contactMechIdFrom),
    contactMechIdTo: toStringValue(event.contactMechIdTo),
    roleTypeIdFrom: toStringValue(event.roleTypeIdFrom),
    roleTypeIdTo: toStringValue(event.roleTypeIdTo),
    partyIdFrom: toStringValue(event.partyIdFrom),
    partyIdTo: toStringValue(event.partyIdTo),
    datetimeStarted: toStringValue(event.datetimeStarted),
    datetimeEnded: toStringValue(event.datetimeEnded),
    contentMimeTypeId: toStringValue(event.contentMimeTypeId),
    content: toStringValue(event.content),
    note: toStringValue(event.note),
    reasonEnumId: toStringValue(event.reasonEnumId),
    contactListId: toStringValue(event.contactListId),
    headerString: toStringValue(event.headerString),
    fromString: toStringValue(event.fromString),
    toString: toStringValue(event.toString),
    ccString: toStringValue(event.ccString),
    bccString: toStringValue(event.bccString),
    messageId: toStringValue(event.messageId),
    externalId: toStringValue(event.externalId),
    type: toStringValue(event.type),
    status: toStringValue(event.status),
    orderId: toStringValue(event.orderId)
  };
}

function normalizeStatusChange(status: any): OrderStatusChange {
  return {
    ...normalizeOrderStatusDoc(status),
    itemSeqId: toStringValue(status.orderItemSeqId) || undefined
  };
}

function normalizeNote(note: any): OrderNote {
  const normalizedNote = normalizeOrderNoteDoc(note);

  return {
    ...normalizedNote,
    internal: toStringValue(note.internalNote) === 'Y'
  };
}

function normalizeContactInfo(detail: any): Address[] {
  return responseList(detail.contactMechs ?? detail.contactInfo ?? detail.addresses).map((contact: any) => ({
    label: toStringValue(contact.contactMechPurposeTypeId ?? contact.purpose ?? contact.label, 'Contact'),
    lines: [
      contact.infoString,
      contact.emailAddress,
      contact.contactNumber,
      contact.address1,
      contact.address2,
      [contact.city, contact.stateProvinceGeoId, contact.postalCode].map((value) => toStringValue(value)).filter(Boolean).join(', '),
      contact.countryGeoId
    ].map((value) => toStringValue(value)).filter(Boolean)
  })).filter((address) => address.lines.length);
}

function customerContactInfo(customerName: string, detail: any): Address[] {
  const lines = [
    customerName,
    detail.orderEmail ?? detail.emailAddress,
    detail.contactNumber ?? detail.phoneNumber
  ].map((value) => toStringValue(value)).filter(Boolean);

  return lines.length ? [{ label: 'Customer', lines }] : [];
}

function responseList(data: any) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.list)) return data.list;
  return allDocs(data);
}
