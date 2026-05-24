import { defineStore } from 'pinia';
import { searchReturns, type ReturnSearchParams } from '@/services/return';
import type { ReturnRecord } from '@/types/order';

export { useReturnStore } from './return';

export interface ReturnSearchFilters {
  status: string;
  dateFrom: string;
  dateThru: string;
  productStoreId: string;
}

export const useReturnsStore = defineStore('returnsSearch', {
  state: () => ({
    searchQuery: '',
    searchFilters: {
      status: 'All',
      dateFrom: '',
      dateThru: '',
      productStoreId: 'All',
    } as ReturnSearchFilters,
    searchResults: [] as ReturnRecord[],
    searchTotal: 0,
    pageIndex: 0,
    pageSize: 50,
    loading: false,
    error: '',
  }),
  getters: {
    hasMore: (state) => state.searchResults.length < state.searchTotal,
  },
  actions: {
    async runSearch() {
      this.pageIndex = 0;
      const result = await this.fetchSearchPage(0);
      this.searchResults = result.returns;
      this.searchTotal = result.total;
    },
    async appendNextPage() {
      if (this.loading || !this.hasMore) return;
      const nextPageIndex = this.pageIndex + 1;
      const result = await this.fetchSearchPage(nextPageIndex);
      this.pageIndex = nextPageIndex;
      this.searchResults = [...this.searchResults, ...result.returns];
      this.searchTotal = result.total;
    },
    async fetchSearchPage(pageIndex: number) {
      this.loading = true;
      this.error = '';
      try {
        return await searchReturns(this.toSearchParams(pageIndex));
      } catch (error: any) {
        this.error = error?.message || 'Failed to search returns';
        return Promise.reject(error);
      } finally {
        this.loading = false;
      }
    },
    toSearchParams(pageIndex: number): ReturnSearchParams {
      return {
        queryString: this.searchQuery,
        status: this.searchFilters.status,
        productStoreId: this.searchFilters.productStoreId,
        dateFrom: this.searchFilters.dateFrom,
        dateThru: this.searchFilters.dateThru,
        pageSize: this.pageSize,
        pageIndex,
      };
    },
  },
  persist: true,
});
