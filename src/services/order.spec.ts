import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  buildOrderLookupPayload,
  bulkCancelOrderItems,
  cancelOrderItem,
  cancelOrderItemReservation,
  convertOrderShipToStore,
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

vi.mock('@common', () => ({
  api: vi.fn(),
}));

describe('order service', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it('builds the OrderManagerOrderLookup payload with search and filters', () => {
    expect(buildOrderLookupPayload({
      queryString: 'M1001',
      status: 'ORDER_APPROVED',
      channel: 'WEB_CHANNEL',
      productStoreId: 'STORE',
      dateFrom: '2026-05-01',
      dateThru: '2026-05-24',
      pageSize: 25,
      pageIndex: 2,
    })).toMatchObject({
      dataDocumentId: 'OrderManagerOrderLookup',
      format: 'json',
      customParametersMap: {
        orderTypeId: 'SALES_ORDER',
        hcOrderId: 'M1001',
        statusId: 'ORDER_APPROVED',
        salesChannelEnumId: 'WEB_CHANNEL',
        productStoreId: 'STORE',
        orderDate_from: expect.any(String),
        orderDate_thru: expect.any(String),
      },
      orderByField: '-orderDate',
      pageSize: 25,
      pageIndex: 2,
    });
  });

  it('posts to the DataDocument endpoint and normalizes returned orders', async () => {
    vi.mocked(api).mockResolvedValue({
      data: {
        count: 1,
        entityValueList: [{
          hcOrderId: 'M1001',
          orderName: '#1001',
          statusId: 'ORDER_APPROVED',
          salesChannelEnumId: 'WEB_CHANNEL',
          grandTotal: 27,
          currencyUom: 'USD',
          productStoreId: 'STORE',
        }],
      },
    });

    const result = await searchOrders({ queryString: 'M1001', pageSize: 25 });

    expect(api).toHaveBeenCalledWith({
      url: 'oms/dataDocumentView',
      method: 'post',
      data: expect.objectContaining({
        dataDocumentId: 'OrderManagerOrderLookup',
        pageSize: 25,
      }),
    });
    expect(result.total).toBe(1);
    expect(result.orders[0]).toMatchObject({
      id: 'M1001',
      externalId: '#1001',
      status: 'ORDER_APPROVED',
      channel: 'WEB_CHANNEL',
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
          paymentPreferences: [{ orderPaymentPreferenceId: '1001', statusId: 'PAYMENT_SETTLED' }],
          roles: [{ partyId: 'M100051', roleTypeId: 'BILL_TO_CUSTOMER' }],
          shipGroups: [{
            shipGroupSeqId: '00002',
            shipmentMethodTypeDesc: 'Standard',
            shipmentId: 'SHIP1',
            carrierPartyId: 'UPS',
            facilityId: 'BROOKLYN',
            facilityName: 'Brooklyn',
            items: [{
              orderItemSeqId: '01',
              productId: 'M101874',
              internalName: 'MH09PINK',
              quantity: 1,
              unitPrice: 12,
              itemStatusId: 'ITEM_APPROVED',
              facilityId: 'BROOKLYN',
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
    });
    expect(order.items[0]).toMatchObject({
      id: '01',
      sku: 'M101874',
      name: 'MH09PINK',
      quantity: 1,
      status: 'ITEM_APPROVED',
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
