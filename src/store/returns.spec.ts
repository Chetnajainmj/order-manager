import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { searchReturns } from '@/services/return';
import { useReturnsStore } from './returns';
import type { ReturnRecord } from '@/types/order';

vi.mock('@/services/return', () => ({
  searchReturns: vi.fn(),
}));

describe('returns search store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(searchReturns).mockReset();
  });

  it('runs the first page of search and stores results', async () => {
    vi.mocked(searchReturns).mockResolvedValue({
      returns: [stubReturn('RET1'), stubReturn('RET2')],
      total: 2,
    });

    const store = useReturnsStore();
    store.searchQuery = 'M100051';
    await store.runSearch();

    expect(searchReturns).toHaveBeenCalledWith(expect.objectContaining({
      queryString: 'M100051',
      pageIndex: 0,
      pageSize: 50,
    }));
    expect(store.searchResults.map((r) => r.id)).toEqual(['RET1', 'RET2']);
    expect(store.searchTotal).toBe(2);
    expect(store.loading).toBe(false);
    expect(store.error).toBe('');
  });

  it('appendNextPage paginates and concatenates results', async () => {
    vi.mocked(searchReturns)
      .mockResolvedValueOnce({ returns: [stubReturn('RET1')], total: 3 })
      .mockResolvedValueOnce({ returns: [stubReturn('RET2'), stubReturn('RET3')], total: 3 });

    const store = useReturnsStore();
    await store.runSearch();
    await store.appendNextPage();

    expect(store.pageIndex).toBe(1);
    expect(store.searchResults.map((r) => r.id)).toEqual(['RET1', 'RET2', 'RET3']);
    expect(store.hasMore).toBe(false);
  });

  it('skips appendNextPage when there is no more data', async () => {
    vi.mocked(searchReturns).mockResolvedValue({ returns: [stubReturn('RET1')], total: 1 });
    const store = useReturnsStore();
    await store.runSearch();
    vi.mocked(searchReturns).mockClear();

    await store.appendNextPage();

    expect(searchReturns).not.toHaveBeenCalled();
    expect(store.pageIndex).toBe(0);
  });

  it('captures service errors on the store', async () => {
    vi.mocked(searchReturns).mockRejectedValue(new Error('boom'));
    const store = useReturnsStore();

    await expect(store.runSearch()).rejects.toThrow('boom');
    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
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
