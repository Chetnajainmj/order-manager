import { defineStore } from 'pinia';
import { searchShipments, type ShipmentSearchParams } from '@/services/shipment';
import type { Shipment } from '@/types/order';

export { useShipmentStore } from './shipment';

export interface ShipmentSearchFilters {
  status: string;
  carrierPartyId: string;
  dateFrom: string;
  dateThru: string;
}

export const useShipmentsStore = defineStore('shipmentsSearch', {
  state: () => ({
    searchQuery: '',
    searchFilters: {
      status: 'All',
      carrierPartyId: 'All',
      dateFrom: '',
      dateThru: '',
    } as ShipmentSearchFilters,
    searchResults: [] as Shipment[],
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
      this.searchResults = result.shipments;
      this.searchTotal = result.total;
    },
    async appendNextPage() {
      if (this.loading || !this.hasMore) return;

      const nextPageIndex = this.pageIndex + 1;
      const result = await this.fetchSearchPage(nextPageIndex);
      this.pageIndex = nextPageIndex;
      this.searchResults = [...this.searchResults, ...result.shipments];
      this.searchTotal = result.total;
    },
    async fetchSearchPage(pageIndex: number) {
      this.loading = true;
      this.error = '';

      try {
        return await searchShipments(this.toSearchParams(pageIndex));
      } catch (error: any) {
        this.error = error?.message || 'Failed to search shipments';
        return Promise.reject(error);
      } finally {
        this.loading = false;
      }
    },
    toSearchParams(pageIndex: number): ShipmentSearchParams {
      return {
        queryString: this.searchQuery,
        status: this.searchFilters.status,
        carrierPartyId: this.searchFilters.carrierPartyId,
        dateFrom: this.searchFilters.dateFrom,
        dateThru: this.searchFilters.dateThru,
        pageSize: this.pageSize,
        pageIndex,
      };
    },
  },
  persist: true,
});
