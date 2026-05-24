import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { getReturn, getReturnItems, getReturnStatusHistory } from '@/services/return';
import { useReturnStore } from './return';
import type { ReturnRecord } from '@/types/order';

vi.mock('@/services/return', () => ({
  getReturn: vi.fn(),
  getReturnItems: vi.fn(),
  getReturnStatusHistory: vi.fn(),
}));

describe('return store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(getReturn).mockReset();
    vi.mocked(getReturnItems).mockReset();
    vi.mocked(getReturnStatusHistory).mockReset();
  });

  it('loads return detail sections into keyed state', async () => {
    vi.mocked(getReturn).mockResolvedValue(stubReturn('RET1000'));
    vi.mocked(getReturnItems).mockResolvedValue([{ returnItemSeqId: '00001' } as any]);
    vi.mocked(getReturnStatusHistory).mockResolvedValue([{ id: '1000' } as any]);

    const store = useReturnStore();
    const returnRecord = await store.loadReturn('RET1000');

    expect(returnRecord.id).toBe('RET1000');
    expect(store.getReturn('RET1000')?.id).toBe('RET1000');
    expect(store.getReturnItems('RET1000')).toEqual([{ returnItemSeqId: '00001' }]);
    expect(store.getReturnStatusHistory('RET1000')).toEqual([{ id: '1000' }]);
    expect(store.fetchStatus.detail).toBe('success');
  });
});

function stubReturn(id: string): ReturnRecord {
  return {
    id,
    orderId: 'M100051',
    status: 'RETURN_ACCEPTED',
    reason: 'CUSTOMER_RETURN',
    requestedDate: '2026-05-22T10:00:00',
    itemIds: [],
    refundTotal: 27,
  };
}
