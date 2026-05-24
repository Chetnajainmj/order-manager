import { defineStore } from 'pinia';
import {
  getShipment as getShipmentService,
  getShipmentPackages,
  getShipmentRouteSegments,
  getShipmentStatusHistory
} from '@/services/shipment';
import type {
  Shipment,
  ShipmentPackage,
  ShipmentRouteSegment,
  ShipmentStatusChange
} from '@/types/order';

export const useShipmentStore = defineStore('shipments', {
  state: () => ({
    cache: {} as Record<string, Shipment>,
    packagesByShipment: {} as Record<string, ShipmentPackage[]>,
    routesByShipment: {} as Record<string, ShipmentRouteSegment[]>,
    statusHistoryByShipment: {} as Record<string, ShipmentStatusChange[]>,
    fetchStatus: {
      detail: 'none',
      packages: 'none',
      routes: 'none',
      statusHistory: 'none'
    } as Record<string, string>,
    errors: {} as Record<string, string>
  }),
  getters: {
    getShipment: (state) => (shipmentId: string) => state.cache[shipmentId],
    getShipmentPackages: (state) => (shipmentId: string) => state.packagesByShipment[shipmentId] || [],
    getShipmentRouteSegments: (state) => (shipmentId: string) => state.routesByShipment[shipmentId] || [],
    getShipmentStatusHistory: (state) => (shipmentId: string) => state.statusHistoryByShipment[shipmentId] || [],
  },
  actions: {
    async loadShipment(shipmentId: string) {
      this.fetchStatus.detail = 'pending';
      this.errors = {};

      try {
        const shipment = await getShipmentService(shipmentId);
        this.cache[shipment.id] = shipment;
        await this.loadShipmentSections(shipment.id);
        this.fetchStatus.detail = 'success';
        return this.cache[shipment.id];
      } catch (error: any) {
        this.fetchStatus.detail = 'error';
        this.errors.detail = error?.message || 'Failed to load shipment';
        return Promise.reject(error);
      }
    },
    async loadShipmentSections(shipmentId: string) {
      const results = await Promise.allSettled([
        getShipmentPackages(shipmentId),
        getShipmentRouteSegments(shipmentId),
        getShipmentStatusHistory(shipmentId),
      ]);
      const [packages, routes, statusHistory] = results;

      if (packages.status === 'fulfilled') {
        this.packagesByShipment[shipmentId] = packages.value;
        this.fetchStatus.packages = 'success';
      } else {
        this.errors.packages = sectionErrorMessage(packages.reason);
        this.fetchStatus.packages = 'error';
      }

      if (routes.status === 'fulfilled') {
        this.routesByShipment[shipmentId] = routes.value;
        this.fetchStatus.routes = 'success';
      } else {
        this.errors.routes = sectionErrorMessage(routes.reason);
        this.fetchStatus.routes = 'error';
      }

      if (statusHistory.status === 'fulfilled') {
        this.statusHistoryByShipment[shipmentId] = statusHistory.value;
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
