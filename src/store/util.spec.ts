import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUtilStore } from './util';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    getStatusColor: () => 'medium',
  },
}));

describe('util store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('reads status transitions from a serializable cache', () => {
    const utilStore = useUtilStore();
    utilStore.statusItems = {
      ORDER_ITEM_STATUS: [{ statusId: 'ITEM_COMPLETED', description: 'Completed' }],
    };
    utilStore.statusFlowTransitions = {
      ITEM_APPROVED: [{ statusId: 'ITEM_APPROVED', toStatusId: 'ITEM_COMPLETED' }],
    };

    expect(utilStore.getAllowedTransitions('ITEM_APPROVED')).toEqual([expect.objectContaining({
      toStatusId: 'ITEM_COMPLETED',
      toStatusDescription: 'Completed',
      toStatusColor: 'medium',
    })]);
  });
});
