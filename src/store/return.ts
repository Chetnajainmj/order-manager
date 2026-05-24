import { defineStore } from 'pinia';
import {
  getReturn as getReturnService,
  getReturnItems,
  getReturnStatusHistory
} from '@/services/return';
import type { ReturnItem, ReturnRecord, ReturnStatusChange } from '@/types/order';

export const useReturnStore = defineStore('returns', {
  state: () => ({
    cache: {} as Record<string, ReturnRecord>,
    itemsByReturn: {} as Record<string, ReturnItem[]>,
    statusHistoryByReturn: {} as Record<string, ReturnStatusChange[]>,
    fetchStatus: {
      detail: 'none',
      items: 'none',
      statusHistory: 'none'
    } as Record<string, string>,
    errors: {} as Record<string, string>
  }),
  getters: {
    getReturn: (state) => (returnId: string) => state.cache[returnId],
    getReturnItems: (state) => (returnId: string) => state.itemsByReturn[returnId] || [],
    getReturnStatusHistory: (state) => (returnId: string) => state.statusHistoryByReturn[returnId] || [],
  },
  actions: {
    async loadReturn(returnId: string) {
      this.fetchStatus.detail = 'pending';
      this.errors = {};

      try {
        const returnRecord = await getReturnService(returnId);
        this.cache[returnRecord.id] = returnRecord;
        await this.loadReturnSections(returnRecord.id);
        this.fetchStatus.detail = 'success';
        return this.cache[returnRecord.id];
      } catch (error: any) {
        this.fetchStatus.detail = 'error';
        this.errors.detail = error?.message || 'Failed to load return';
        return Promise.reject(error);
      }
    },
    async loadReturnSections(returnId: string) {
      const results = await Promise.allSettled([
        getReturnItems(returnId),
        getReturnStatusHistory(returnId),
      ]);
      const [items, statusHistory] = results;

      if (items.status === 'fulfilled') {
        this.itemsByReturn[returnId] = items.value;
        this.fetchStatus.items = 'success';
        this.cache[returnId] = {
          ...this.cache[returnId],
          itemIds: items.value.map((item) => item.orderItemSeqId).filter(Boolean)
        };
      } else {
        this.errors.items = sectionErrorMessage(items.reason);
        this.fetchStatus.items = 'error';
      }

      if (statusHistory.status === 'fulfilled') {
        this.statusHistoryByReturn[returnId] = statusHistory.value;
        this.fetchStatus.statusHistory = 'success';
      } else {
        this.errors.statusHistory = sectionErrorMessage(statusHistory.reason);
        this.fetchStatus.statusHistory = 'error';
      }
    }
  },
  persist: true,
});

function sectionErrorMessage(error: any) {
  return error?.message || 'Section failed to load';
}
