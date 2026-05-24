import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  getOrder,
  getOrderAttributes,
  getOrderCommunicationEvents,
  getOrderNotes,
  getOrderReturns,
  getOrderRoles,
  getOrderShipments,
  getOrderStatusHistory,
  reserveSoftAllocatedInventory,
  searchOrders,
  updateOrderShipGroup
} from '@/services/order';
import { useOrderStore } from './order';

vi.mock('@/services/order', () => ({
  addOrderNote: vi.fn(),
  cancelOrderItem: vi.fn(),
  changeOrderItemStatus: vi.fn(),
  getOrder: vi.fn(),
  getOrderAttributes: vi.fn(),
  getOrderCommunicationEvents: vi.fn(),
  getOrderNotes: vi.fn(),
  getOrderReturns: vi.fn(),
  getOrderRoles: vi.fn(),
  getOrderShipments: vi.fn(),
  getOrderStatusHistory: vi.fn(),
  rejectOrderItem: vi.fn(),
  reserveSoftAllocatedInventory: vi.fn(),
  searchOrders: vi.fn(),
  sendOrderEmail: vi.fn(),
  updateOrderShipGroup: vi.fn(),
}));

describe('order store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(searchOrders).mockReset();
    vi.mocked(getOrder).mockReset();
    vi.mocked(getOrderStatusHistory).mockReset();
    vi.mocked(getOrderNotes).mockReset();
    vi.mocked(getOrderAttributes).mockReset();
    vi.mocked(getOrderRoles).mockReset();
    vi.mocked(getOrderCommunicationEvents).mockReset();
    vi.mocked(getOrderShipments).mockReset();
    vi.mocked(getOrderReturns).mockReset();
    vi.mocked(updateOrderShipGroup).mockReset();
    vi.mocked(reserveSoftAllocatedInventory).mockReset();
  });

  it('replaces search results then appends the next page', async () => {
    vi.mocked(searchOrders)
      .mockResolvedValueOnce({
        total: 2,
        orders: [stubOrder('M1001')],
      })
      .mockResolvedValueOnce({
        total: 2,
        orders: [stubOrder('M1002')],
      });

    const store = useOrderStore();
    store.searchQuery = 'M100';
    store.searchFilters.status = 'ORDER_APPROVED';
    store.pageSize = 1;

    await store.runSearch();
    await store.appendNextPage();

    expect(searchOrders).toHaveBeenNthCalledWith(1, expect.objectContaining({
      queryString: 'M100',
      status: 'ORDER_APPROVED',
      pageIndex: 0,
      pageSize: 1,
    }));
    expect(searchOrders).toHaveBeenNthCalledWith(2, expect.objectContaining({
      pageIndex: 1,
      pageSize: 1,
    }));
    expect(store.searchResults.map((order) => order.id)).toEqual(['M1001', 'M1002']);
    expect(store.getOrder('M1002')?.id).toBe('M1002');
  });

  it('tracks pending state and reloads after documented order actions', async () => {
    vi.mocked(getOrder).mockResolvedValue(stubOrder('M1001'));
    vi.mocked(getOrderStatusHistory).mockResolvedValue([]);
    vi.mocked(getOrderNotes).mockResolvedValue([]);
    vi.mocked(getOrderAttributes).mockResolvedValue([]);
    vi.mocked(getOrderRoles).mockResolvedValue([]);
    vi.mocked(getOrderCommunicationEvents).mockResolvedValue([]);
    vi.mocked(getOrderShipments).mockResolvedValue([]);
    vi.mocked(getOrderReturns).mockResolvedValue([]);
    vi.mocked(updateOrderShipGroup).mockResolvedValue({ data: {}, status: 200 });
    vi.mocked(reserveSoftAllocatedInventory).mockResolvedValue({ data: {}, status: 200 });

    const store = useOrderStore();

    await store.updateOrderShipGroup('M1001', '00001', { giftMessage: 'Happy birthday' });
    await store.reserveSoftAllocatedInventory('M1001');

    expect(updateOrderShipGroup).toHaveBeenCalledWith('M1001', '00001', { giftMessage: 'Happy birthday' });
    expect(reserveSoftAllocatedInventory).toHaveBeenCalledWith('M1001');
    expect(store.pendingActions['M1001:update-ship-group']).toBe(false);
    expect(store.pendingActions['M1001:reserve-soft-allocations']).toBe(false);
    expect(getOrder).toHaveBeenCalledTimes(2);
  });
});

function stubOrder(id: string) {
  return {
    id,
    externalId: `#${id}`,
    orderDate: '',
    status: 'ORDER_APPROVED' as const,
    customerId: '',
    channel: 'WEB_CHANNEL',
    total: 0,
    currency: 'USD',
    paymentStatus: '',
    fulfillmentStatus: '',
    deliveryMethod: '',
    priority: '',
    items: [],
    shipmentIds: [],
    returnIds: [],
    notes: [],
    history: [],
  };
}
