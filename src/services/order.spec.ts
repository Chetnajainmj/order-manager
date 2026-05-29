import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  buildOrderLookupPayload,
  bulkCancelOrderItems,
  cancelOrderItem,
  cancelOrderItemReservation,
  convertOrderShipToStore,
  createOrderCommunicationEvent,
  createOrderItemReservation,
  deleteOrderItem,
  getOrder,
  getOrderReturns,
  getPoortiDocument,
  processOrderFacilityAllocation,
  processOrderItemAllocation,
  rejectOrderItems,
  reserveSoftAllocatedInventory,
  searchOrders,
  sendOrderEmail,
  sendPickupNotification,
  sendPickupScheduledNotification,
  updateOrderItem,
  updateOrderShipGroup
} from './order';

const runSolrQuery = vi.fn();

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: vi.fn(() => false),
  },
  useSolrSearch: () => ({
    runSolrQuery,
  }),
}));

describe('order service', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    runSolrQuery.mockReset();
  });

  it('builds the SOLR order lookup payload with search and filters', () => {
    expect(buildOrderLookupPayload({
      queryString: 'M1001',
      status: ['ORDER_APPROVED'],
      channel: 'WEB_CHANNEL',
      productStoreId: 'STORE',
      dateFrom: '2026-05-01',
      dateThru: '2026-05-24',
      pageSize: 25,
      pageIndex: 2,
    })).toMatchObject({
      json: {
        params: {
          rows: 25,
          start: 50,
          group: true,
          'group.field': 'orderId',
          'group.ngroups': true,
          defType: 'edismax',
          qf: expect.stringContaining('customerEmailId'),
        },
        query: '(M1001* OR "M1001"^100)',
        filter: [
          'docType: ORDER',
          'orderTypeId: SALES_ORDER',
          'orderStatusId:ORDER_APPROVED',
          'salesChannelEnumId: WEB_CHANNEL',
          'productStoreId: STORE',
          'orderDate: [2026-05-01T00:00:00Z TO 2026-05-24T23:59:59Z]',
        ],
      },
    });
  });

  it('omits the status filter for all statuses', () => {
    expect(buildOrderLookupPayload({
      status: [],
    }).json.filter).not.toContain(expect.stringContaining('orderStatusId'));

    expect(buildOrderLookupPayload({
      status: 'All',
    }).json.filter).not.toContain(expect.stringContaining('orderStatusId'));
  });

  it('builds one OR status filter for multiple selected statuses', () => {
    const filter = buildOrderLookupPayload({
      status: ['ORDER_APPROVED', 'ORDER_COMPLETED'],
    }).json.filter;

    expect(filter.filter((entry: string) => entry.includes('orderStatusId'))).toEqual([
      'orderStatusId:(ORDER_APPROVED OR ORDER_COMPLETED)'
    ]);
  });

  it('posts to the SOLR endpoint and normalizes grouped returned orders', async () => {
    runSolrQuery.mockResolvedValue({
      status: 200,
      data: {
        grouped: {
          orderId: {
            ngroups: 1,
            groups: [{
              doclist: {
                docs: [{
                  orderId: 'M1001',
                  orderName: '#1001',
                  orderStatusDesc: 'Approved',
                  customerPartyName: 'Maya Chen',
                  salesChannelDesc: 'Web',
                  grandTotal: 27,
                  currencyUom: 'USD',
                  productStoreId: 'STORE',
                }],
              },
            }],
          },
        },
      },
    });

    const result = await searchOrders({ queryString: 'M1001', pageSize: 25 });

    expect(runSolrQuery).toHaveBeenCalledWith(expect.objectContaining({
      json: expect.objectContaining({
        params: expect.objectContaining({ rows: 25 }),
      }),
    }));
    expect(result.total).toBe(1);
    expect(result.orders[0]).toMatchObject({
      id: 'M1001',
      externalId: '#1001',
      status: 'Approved',
      customerName: 'Maya Chen',
      channel: 'Web',
      total: 27,
      currency: 'USD',
    });
  });

  it('fetches order detail and normalizes header, customer, ship groups, and items', async () => {
    vi.mocked(api).mockResolvedValue({
      data: {
        orderDetail: {
          orderId: 'M100051',
          orderName: '#1004',
          orderExternalId: '11839453462639',
          orderDate: 1779445400000,
          orderStatusId: 'ORDER_APPROVED',
          productStoreId: 'STORE',
          grandTotal: 27,
          currencyUom: 'USD',
          salesChannel: 'WEB_CHANNEL',
          partyId: 'M100051',
          customerFirstName: 'Swati',
          customerLastName: 'Pandey',
          orderEmail: 'swati.pandey@example.com',
          paymentPreferences: [{ orderPaymentPreferenceId: '1001', statusId: 'PAYMENT_SETTLED', maxAmount: 27, captureDate: '2026-05-30T10:00:00Z' }],
          roles: [{ partyId: 'M100051', roleTypeId: 'BILL_TO_CUSTOMER' }],
          shipGroups: [{
            shipGroupSeqId: '00002',
            shipmentMethodTypeDesc: 'Standard',
            shipmentId: 'SHIP1',
            carrierPartyId: 'UPS',
            facilityId: 'BROOKLYN',
            facilityName: 'Brooklyn',
            shippingInstructions: 'Leave at dock',
            giftMessage: 'Happy birthday',
            maySplit: 'N',
            isGift: 'Y',
            shipByDate: '2026-05-30',
            items: [{
              orderItemSeqId: '01',
              productId: 'M101874',
              internalName: 'MH09PINK',
              quantity: 1,
              unitPrice: 12,
              itemStatusId: 'ITEM_APPROVED',
              facilityId: 'BROOKLYN',
              mainImageUrl: 'https://cdn.example.com/mh09pink.jpg',
            }],
          }],
        },
      },
    });

    const order = await getOrder('M100051');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/M100051',
      method: 'get',
    });
    expect(order).toMatchObject({
      id: 'M100051',
      externalId: '#1004',
      status: 'ORDER_APPROVED',
      customerId: 'M100051',
      total: 27,
      paymentStatus: 'PAYMENT_SETTLED',
      deliveryMethod: 'Standard',
      shipmentIds: ['SHIP1'],
      shipGroups: [{
        id: '00002',
        facilityName: 'Brooklyn',
        shippingInstructions: 'Leave at dock',
        giftMessage: 'Happy birthday',
        maySplit: 'N',
        isGift: 'Y',
        shipByDate: '2026-05-30',
      }],
    });
    expect(order.payments?.[0]).toMatchObject({
      amount: 27,
      capturedAt: '2026-05-30T10:00:00Z',
    });
    expect(order.items[0]).toMatchObject({
      id: '01',
      sku: 'M101874',
      name: 'MH09PINK',
      quantity: 1,
      status: 'ITEM_APPROVED',
      imageUrl: 'https://cdn.example.com/mh09pink.jpg',
    });
  });

  it('calls documented mutation endpoints for cancel and email actions', async () => {
    vi.mocked(api).mockResolvedValue({ data: {}, status: 200 });

    await cancelOrderItem('M100051', '01', 'Customer request');
    await sendOrderEmail('M100051', 'PRDS_ODR_CONFIRM');

    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'oms/orders/M100051/items/01/cancel',
      method: 'post',
      data: {
        orderId: 'M100051',
        orderItemSeqId: '01',
        reason: 'Customer request',
      },
    });
    expect(api).toHaveBeenNthCalledWith(2, {
      url: 'oms/orders/sendEmailNotification',
      method: 'post',
      data: {
        orderId: 'M100051',
        emailType: 'PRDS_ODR_CONFIRM',
      },
    });
  });

  it('creates an order-linked communication event with CommunicationEvent model fields', async () => {
    vi.mocked(api).mockResolvedValue({ data: { communicationEventId: 'CE100' }, status: 200 });

    await createOrderCommunicationEvent('M100051', {
      communicationEventTypeId: 'EMAIL_COMMUNICATION',
      parentCommEventId: 'CE99',
      statusId: 'COM_IN_PROGRESS',
      contactMechTypeId: 'EMAIL_ADDRESS',
      partyIdFrom: 'CSR_1',
      partyIdTo: 'CUST_1',
      roleTypeIdFrom: 'ORIGINATOR',
      roleTypeIdTo: 'ADDRESSEE',
      datetimeStarted: '2026-05-29T12:00:00.000Z',
      subject: 'Order M100051',
      contentMimeTypeId: 'text/plain',
      content: 'Checking on your order.',
      action: 'REPLY'
    });

    expect(api).toHaveBeenCalledWith({
      url: 'oms/communicationEvents',
      method: 'post',
      data: {
        orderId: 'M100051',
        communicationEventTypeId: 'EMAIL_COMMUNICATION',
        parentCommEventId: 'CE99',
        statusId: 'COM_IN_PROGRESS',
        contactMechTypeId: 'EMAIL_ADDRESS',
        partyIdFrom: 'CSR_1',
        partyIdTo: 'CUST_1',
        roleTypeIdFrom: 'ORIGINATOR',
        roleTypeIdTo: 'ADDRESSEE',
        datetimeStarted: '2026-05-29T12:00:00.000Z',
        subject: 'Order M100051',
        contentMimeTypeId: 'text/plain',
        content: 'Checking on your order.',
        action: 'REPLY'
      },
    });
  });

  it('calls documented item and inventory action endpoints', async () => {
    vi.mocked(api).mockResolvedValue({ data: {}, status: 200 });

    await updateOrderItem('M100051', '01', { quantity: 2, unitPrice: 12 });
    await deleteOrderItem('M100051', '02');
    await bulkCancelOrderItems('M100051', { orderItemSeqIds: ['01', '02'], reason: 'Customer request' });
    await rejectOrderItems('M100051', { orderItemSeqIds: ['03'], reason: 'No inventory' });
    await createOrderItemReservation('M100051', '01', { facilityId: 'BROOKLYN', quantity: 1 });
    await cancelOrderItemReservation('M100051', '01', 1);
    await processOrderItemAllocation('M100051', '01', { facilityId: 'BROOKLYN', quantity: 1 });
    await processOrderFacilityAllocation('M100051', { facilityId: 'BROOKLYN' });

    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'oms/orders/M100051/items/01',
      method: 'put',
      data: { orderId: 'M100051', orderItemSeqId: '01', quantity: 2, unitPrice: 12 },
    });
    expect(api).toHaveBeenNthCalledWith(2, {
      url: 'oms/orders/M100051/items/02',
      method: 'delete',
    });
    expect(api).toHaveBeenNthCalledWith(3, {
      url: 'oms/orders/M100051/items/cancel',
      method: 'post',
      data: { orderId: 'M100051', orderItemSeqIds: ['01', '02'], reason: 'Customer request' },
    });
    expect(api).toHaveBeenNthCalledWith(4, {
      url: 'oms/orders/M100051/reject',
      method: 'post',
      data: { orderId: 'M100051', orderItemSeqIds: ['03'], reason: 'No inventory' },
    });
    expect(api).toHaveBeenNthCalledWith(5, {
      url: 'oms/orders/M100051/items/01/reservation',
      method: 'post',
      data: { orderId: 'M100051', orderItemSeqId: '01', facilityId: 'BROOKLYN', quantity: 1 },
    });
    expect(api).toHaveBeenNthCalledWith(6, {
      url: 'oms/orders/M100051/items/01/reservation',
      method: 'delete',
      params: { cancelQuantity: 1 },
    });
    expect(api).toHaveBeenNthCalledWith(7, {
      url: 'oms/orders/M100051/items/01/allocation',
      method: 'post',
      data: { orderId: 'M100051', orderItemSeqId: '01', facilityId: 'BROOKLYN', quantity: 1 },
    });
    expect(api).toHaveBeenNthCalledWith(8, {
      url: 'oms/orders/M100051/allocation',
      method: 'post',
      data: { orderId: 'M100051', facilityId: 'BROOKLYN' },
    });
  });

  it('calls documented ship group and order-level action endpoints', async () => {
    vi.mocked(api).mockResolvedValue({ data: {}, status: 200 });

    await updateOrderShipGroup('M100051', '00001', { maySplit: 'Y', giftMessage: 'Happy birthday' });
    await convertOrderShipToStore('M100051', { shipGroupSeqId: '00001', facilityId: 'STORE_1' });
    await reserveSoftAllocatedInventory('M100051');
    await sendPickupNotification('M100051');
    await sendPickupScheduledNotification({ orderId: 'M100051', emailType: 'PRDS_ODR_PICKUP_SCHEDULED' });
    await getPoortiDocument('PackingSlip.pdf', { shipmentId: 'SHIP1' });

    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'oms/orders/M100051/shipGroups/00001',
      method: 'put',
      data: { orderId: 'M100051', shipGroupSeqId: '00001', maySplit: 'Y', giftMessage: 'Happy birthday' },
    });
    expect(api).toHaveBeenNthCalledWith(2, {
      url: 'oms/orders/M100051/shipToStore',
      method: 'post',
      data: { orderId: 'M100051', shipGroupSeqId: '00001', facilityId: 'STORE_1' },
    });
    expect(api).toHaveBeenNthCalledWith(3, {
      url: 'oms/orders/M100051/soft-allocations/reserve-inventory',
      method: 'post',
    });
    expect(api).toHaveBeenNthCalledWith(4, {
      url: 'oms/orders/pickup/M100051/notification',
      method: 'post',
    });
    expect(api).toHaveBeenNthCalledWith(5, {
      url: 'oms/orders/pickupScheduledNotification',
      method: 'post',
      data: { orderId: 'M100051', emailType: 'PRDS_ODR_PICKUP_SCHEDULED' },
    });
    expect(api).toHaveBeenNthCalledWith(6, {
      url: 'poorti/PackingSlip.pdf',
      method: 'get',
      params: { shipmentId: 'SHIP1' },
      responseType: 'blob',
    });
  });

  it('fetches returns and filters them by orderId', async () => {
    vi.mocked(api).mockResolvedValue({
      data: [
        {
          returnId: 'RET1',
          statusId: 'RETURN_COMPLETED',
          returnReasonId: 'SIZE_TOO_SMALL',
          entryDate: 1779445400000,
          items: [
            { orderId: 'M100051', returnItemSeqId: '01' }
          ]
        },
        {
          returnId: 'RET2',
          statusId: 'RETURN_REQUESTED',
          returnReasonId: 'SIZE_TOO_LARGE',
          entryDate: 1779445500000,
          items: [
            { orderId: 'M100052', returnItemSeqId: '01' }
          ]
        }
      ]
    });

    const result = await getOrderReturns('M100051');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/returns',
      method: 'get',
      params: {
        primaryOrderId: 'M100051',
        dependentLevels: 2
      }
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'RET1',
      orderId: 'M100051',
      status: 'RETURN_COMPLETED',
      reason: 'SIZE_TOO_SMALL',
    });
  });
});
