import { defineStore } from 'pinia';
import { searchCustomers, type CustomerSearchParams } from '@/services/customer';
import type { Customer } from '@/types/order';

export { useCustomerStore } from './customer';

export interface CustomerSearchFilters {
  status: string;
  partyTypeId: string;
  loyaltyTier: string;
}

export const useCustomersStore = defineStore('customersSearch', {
  state: () => ({
    searchQuery: '',
    searchFilters: {
      status: 'All',
      partyTypeId: 'PERSON',
      loyaltyTier: 'All',
    } as CustomerSearchFilters,
    searchResults: [] as Customer[],
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
      this.searchResults = result.customers;
      this.searchTotal = result.total;
    },
    async appendNextPage() {
      if (this.loading || !this.hasMore) return;

      const nextPageIndex = this.pageIndex + 1;
      const result = await this.fetchSearchPage(nextPageIndex);
      this.pageIndex = nextPageIndex;
      this.searchResults = [...this.searchResults, ...result.customers];
      this.searchTotal = result.total;
    },
    async fetchSearchPage(pageIndex: number) {
      this.loading = true;
      this.error = '';

      try {
        return await searchCustomers(this.toSearchParams(pageIndex));
      } catch (error: any) {
        this.error = error?.message || 'Failed to search customers';
        return Promise.reject(error);
      } finally {
        this.loading = false;
      }
    },
    toSearchParams(pageIndex: number): CustomerSearchParams {
      return {
        queryString: this.searchQuery,
        status: this.searchFilters.status,
        partyTypeId: this.searchFilters.partyTypeId,
        loyaltyTier: this.searchFilters.loyaltyTier,
        pageSize: this.pageSize,
        pageIndex,
      };
    },
  },
  persist: true,
});
