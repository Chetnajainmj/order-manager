import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { getCustomer, getCustomerContactMechs, getCustomerOrders } from '@/services/customer';
import { useCustomerStore } from './customer';
import type { Customer } from '@/types/order';

vi.mock('@/services/customer', () => ({
  getCustomer: vi.fn(),
  getCustomerContactMechs: vi.fn(),
  getCustomerOrders: vi.fn(),
}));

describe('customer store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(getCustomer).mockReset();
    vi.mocked(getCustomerContactMechs).mockReset();
    vi.mocked(getCustomerOrders).mockReset();
  });

  it('loads customer profile, contact mechs, and recent orders', async () => {
    vi.mocked(getCustomer).mockResolvedValue(stubCustomer('CUST_1'));
    vi.mocked(getCustomerContactMechs).mockResolvedValue({
      contactMechs: [{ contactMechId: 'EMAIL1' } as any],
      emails: [{ contactMechId: 'EMAIL1' } as any],
      phones: [],
      postalAddresses: [],
    });
    vi.mocked(getCustomerOrders).mockResolvedValue({
      total: 1,
      orders: [{ id: 'M100051' } as any],
    });

    const store = useCustomerStore();
    const customer = await store.loadCustomer('CUST_1');

    expect(customer.id).toBe('CUST_1');
    expect(store.getCustomer('CUST_1')?.emails).toEqual([{ contactMechId: 'EMAIL1' }]);
    expect(store.getCustomerOrders('CUST_1')).toEqual([{ id: 'M100051' }]);
    expect(store.orderTotalsByCustomer.CUST_1).toBe(1);
    expect(store.fetchStatus.detail).toBe('success');
  });
});

function stubCustomer(id: string): Customer {
  return {
    id,
    name: 'Swati Pandey',
    email: '',
    phone: '',
    loyaltyTier: 'Unassigned',
    lifetimeOrders: 0,
    lifetimeValue: 0,
    addresses: [],
  };
}
