import { defineStore } from 'pinia';
import {
  addOrderNote as addOrderNoteService,
  bulkCancelOrderItems as bulkCancelOrderItemsService,
  cancelOrderItem as cancelOrderItemService,
  cancelOrderItemReservation as cancelOrderItemReservationService,
  changeOrderItemStatus as changeOrderItemStatusService,
  convertOrderShipToStore as convertOrderShipToStoreService,
  createOrderItemReservation as createOrderItemReservationService,
  deleteOrderItem as deleteOrderItemService,
  getOrder as getOrderService,
  getOrderAttributes,
  getOrderCommunicationEvents,
  getOrderNotes,
  getOrderReturns,
  getOrderRoles,
  getOrderShipments,
  getOrderStatusHistory,
  getPoortiDocument as getPoortiDocumentService,
  processOrderFacilityAllocation as processOrderFacilityAllocationService,
  processOrderItemAllocation as processOrderItemAllocationService,
  rejectOrderItem as rejectOrderItemService,
  rejectOrderItems as rejectOrderItemsService,
  reserveSoftAllocatedInventory as reserveSoftAllocatedInventoryService,
  searchOrders as searchOrderService,
  sendOrderEmail as sendOrderEmailService,
  sendPickupNotification as sendPickupNotificationService,
  sendPickupScheduledNotification as sendPickupScheduledNotificationService,
  updateOrderItem as updateOrderItemService,
  updateOrderShipGroup as updateOrderShipGroupService,
  type AddOrderNotePayload,
  type InventoryActionPayload,
  type OrderItemUpdatePayload,
  type OrderItemsActionPayload,
  type OrderSearchParams,
  type PoortiDocumentName,
  type ShipGroupUpdatePayload,
  type ShipToStorePayload
} from '@/services/order';
import type { Customer, Order, ReturnRecord, Shipment } from '@/types/order';

export interface OrderSearchFilters {
  status: string;
  channel: string;
  productStoreId: string;
  dateFrom: string;
  dateThru: string;
}

export const useOrderStore = defineStore('orders', {
  state: () => ({
    searchQuery: '',
    searchFilters: {
      status: 'All',
      channel: 'All',
      productStoreId: 'All',
      dateFrom: '',
      dateThru: '',
    } as OrderSearchFilters,
    searchResults: [] as Order[],
    searchTotal: 0,
    pageIndex: 0,
    pageSize: 50,
    loading: false,
    error: '',
    detailLoading: false,
    detailError: '',
    detailSectionErrors: {} as Record<string, string>,
    pendingActions: {} as Record<string, boolean>,
    cache: {} as Record<string, Order>,
    shipmentList: [] as Shipment[],
    returnList: [] as ReturnRecord[],
    customerList: [] as Customer[],
  }),
  getters: {
    filteredOrders: (state) => state.searchResults,
    orderList: (state) => state.searchResults,
    total: (state) => state.searchTotal,
    allOrders: (state) => Object.values(state.cache),
    hasMore: (state) => state.searchResults.length < state.searchTotal,
    openWork: (state) => Object.values(state.cache).filter((order) => order.status !== 'Completed' && order.status !== 'Cancelled'),
    getOrder: (state) => (orderId: string) => state.cache[orderId] || Object.values(state.cache).find((order) => order.externalId === orderId),
    getCustomer: (state) => (customerId: string) => state.customerList.find((customer) => customer.id === customerId),
    getShipment: (state) => (shipmentId: string) => state.shipmentList.find((shipment) => shipment.id === shipmentId),
    getReturn: (state) => (returnId: string) => state.returnList.find((returnRecord) => returnRecord.id === returnId),
    getOrderShipments: (state) => (orderId: string) => state.shipmentList.filter((shipment) => shipment.orderId === orderId),
    getOrderReturns: (state) => (orderId: string) => state.returnList.filter((returnRecord) => returnRecord.orderId === orderId),
    getCustomerOrders: (state) => (customerId: string) => Object.values(state.cache).filter((order) => order.customerId === customerId),
  },
  actions: {
    async runSearch() {
      this.pageIndex = 0;
      const result = await this.fetchSearchPage(0);
      this.searchResults = result.orders;
      this.searchTotal = result.total;
      this.cacheOrders(result.orders);
    },
    async appendNextPage() {
      if (this.loading || !this.hasMore) return;

      const nextPageIndex = this.pageIndex + 1;
      const result = await this.fetchSearchPage(nextPageIndex);
      this.pageIndex = nextPageIndex;
      this.searchResults = [...this.searchResults, ...result.orders];
      this.searchTotal = result.total;
      this.cacheOrders(result.orders);
    },
    cacheOrders(orders: Order[]) {
      orders.forEach((order) => {
        this.cache[order.id] = order;
      });
    },
    async fetchSearchPage(pageIndex: number) {
      this.loading = true;
      this.error = '';

      try {
        return await searchOrderService(this.toSearchParams(pageIndex));
      } catch (error: any) {
        this.error = error?.message || 'Failed to search orders';
        return Promise.reject(error);
      } finally {
        this.loading = false;
      }
    },
    toSearchParams(pageIndex: number): OrderSearchParams {
      return {
        queryString: this.searchQuery,
        status: this.searchFilters.status,
        channel: this.searchFilters.channel,
        productStoreId: this.searchFilters.productStoreId,
        dateFrom: this.searchFilters.dateFrom,
        dateThru: this.searchFilters.dateThru,
        pageSize: this.pageSize,
        pageIndex,
      };
    },
    async loadWorkflowData() {
      if (!this.searchResults.length) await this.runSearch();
    },
    async searchOrders() {
      await this.runSearch();
    },
    async loadOrder(orderId: string) {
      this.detailLoading = true;
      this.detailError = '';
      this.detailSectionErrors = {};

      try {
        const order = await getOrderService(orderId);
        this.cache[order.id] = {
          ...this.cache[order.id],
          ...order,
        };

        await this.loadOrderSections(order.id);
        return this.cache[order.id];
      } catch (error: any) {
        this.detailError = error?.message || 'Failed to load order';
        return Promise.reject(error);
      } finally {
        this.detailLoading = false;
      }
    },
    async loadOrderSections(orderId: string) {
      const order = this.cache[orderId];
      if (!order) return;

      const sectionResults = await Promise.allSettled([
        getOrderStatusHistory(orderId),
        getOrderNotes(orderId),
        getOrderAttributes(orderId),
        getOrderRoles(orderId),
        getOrderCommunicationEvents(orderId),
        getOrderShipments(orderId),
        getOrderReturns(orderId),
      ]);
      const [history, notes, attributes, roles, communicationEvents, shipments, returns] = sectionResults;

      if (history.status === 'fulfilled') order.history = history.value;
      else this.detailSectionErrors.activity = sectionErrorMessage(history.reason);

      if (notes.status === 'fulfilled') order.notes = notes.value;
      else this.detailSectionErrors.notes = sectionErrorMessage(notes.reason);

      if (attributes.status === 'fulfilled') order.attributes = attributes.value;
      else this.detailSectionErrors.attributes = sectionErrorMessage(attributes.reason);

      if (roles.status === 'fulfilled') order.roles = roles.value;
      else this.detailSectionErrors.roles = sectionErrorMessage(roles.reason);

      if (communicationEvents.status === 'fulfilled') order.communicationEvents = communicationEvents.value;
      else this.detailSectionErrors.communications = sectionErrorMessage(communicationEvents.reason);

      if (shipments.status === 'fulfilled') this.mergeShipments(shipments.value);
      else this.detailSectionErrors.shipments = sectionErrorMessage(shipments.reason);

      if (returns.status === 'fulfilled') this.mergeReturns(returns.value);
      else this.detailSectionErrors.returns = sectionErrorMessage(returns.reason);

      this.cache[orderId] = { ...order };
    },
    mergeShipments(shipments: Shipment[]) {
      const shipmentById = new Map(this.shipmentList.map((shipment) => [shipment.id, shipment]));
      shipments.forEach((shipment) => shipmentById.set(shipment.id, shipment));
      this.shipmentList = [...shipmentById.values()];
    },
    mergeReturns(returns: ReturnRecord[]) {
      const returnById = new Map(this.returnList.map((returnRecord) => [returnRecord.id, returnRecord]));
      returns.forEach((returnRecord) => returnById.set(returnRecord.id, returnRecord));
      this.returnList = [...returnById.values()];
    },
    async addOrderNote(orderId: string, payload: AddOrderNotePayload) {
      await this.runOrderAction(orderId, 'add-order-note', () => addOrderNoteService(orderId, payload));
    },
    async cancelOrderItem(orderId: string, orderItemSeqId: string, reason: string) {
      await this.runOrderAction(orderId, `cancel-item:${orderItemSeqId}`, () => cancelOrderItemService(orderId, orderItemSeqId, reason));
    },
    async rejectOrderItem(orderId: string, orderItemSeqId: string, reason: string) {
      await this.runOrderAction(orderId, `reject-item:${orderItemSeqId}`, () => rejectOrderItemService(orderId, orderItemSeqId, reason));
    },
    async sendOrderEmail(orderId: string, emailType: 'PRDS_ODR_CONFIRM' | 'PRDS_ODR_COMPLETE') {
      await this.runOrderAction(orderId, `send-order-email:${emailType}`, () => sendOrderEmailService(orderId, emailType), false);
    },
    async changeOrderItemStatus(orderId: string, orderItemSeqId: string, statusId: string) {
      await this.runOrderAction(orderId, `change-item-status:${orderItemSeqId}`, () => changeOrderItemStatusService(orderId, orderItemSeqId, statusId));
    },
    async updateOrderItem(orderId: string, orderItemSeqId: string, payload: OrderItemUpdatePayload) {
      await this.runOrderAction(orderId, `update-item:${orderItemSeqId}`, () => updateOrderItemService(orderId, orderItemSeqId, payload));
    },
    async deleteOrderItem(orderId: string, orderItemSeqId: string) {
      await this.runOrderAction(orderId, `delete-item:${orderItemSeqId}`, () => deleteOrderItemService(orderId, orderItemSeqId));
    },
    async bulkCancelOrderItems(orderId: string, payload: OrderItemsActionPayload) {
      await this.runOrderAction(orderId, 'bulk-cancel-items', () => bulkCancelOrderItemsService(orderId, payload));
    },
    async rejectOrderItems(orderId: string, payload: OrderItemsActionPayload) {
      await this.runOrderAction(orderId, 'bulk-reject-items', () => rejectOrderItemsService(orderId, payload));
    },
    async createOrderItemReservation(orderId: string, orderItemSeqId: string, payload: InventoryActionPayload) {
      await this.runOrderAction(orderId, `reserve-item-inventory:${orderItemSeqId}`, () => createOrderItemReservationService(orderId, orderItemSeqId, payload));
    },
    async cancelOrderItemReservation(orderId: string, orderItemSeqId: string, cancelQuantity?: number) {
      await this.runOrderAction(orderId, `cancel-item-reservation:${orderItemSeqId}`, () => cancelOrderItemReservationService(orderId, orderItemSeqId, cancelQuantity));
    },
    async processOrderItemAllocation(orderId: string, orderItemSeqId: string, payload: InventoryActionPayload) {
      await this.runOrderAction(orderId, `allocate-item:${orderItemSeqId}`, () => processOrderItemAllocationService(orderId, orderItemSeqId, payload));
    },
    async processOrderFacilityAllocation(orderId: string, payload: InventoryActionPayload) {
      await this.runOrderAction(orderId, 'allocate-order', () => processOrderFacilityAllocationService(orderId, payload));
    },
    async updateOrderShipGroup(orderId: string, shipGroupSeqId: string, payload: ShipGroupUpdatePayload) {
      await this.runOrderAction(orderId, 'update-ship-group', () => updateOrderShipGroupService(orderId, shipGroupSeqId, payload));
    },
    async convertOrderShipToStore(orderId: string, payload: ShipToStorePayload) {
      await this.runOrderAction(orderId, 'ship-to-store', () => convertOrderShipToStoreService(orderId, payload));
    },
    async reserveSoftAllocatedInventory(orderId: string) {
      await this.runOrderAction(orderId, 'reserve-soft-allocations', () => reserveSoftAllocatedInventoryService(orderId));
    },
    async sendPickupNotification(orderId: string) {
      await this.runOrderAction(orderId, 'pickup-ready-notification', () => sendPickupNotificationService(orderId), false);
    },
    async sendPickupScheduledNotification(orderId: string) {
      await this.runOrderAction(orderId, 'pickup-scheduled-notification', () => sendPickupScheduledNotificationService({ orderId }), false);
    },
    async getPoortiDocument(documentName: PoortiDocumentName, params: Record<string, string>) {
      return getPoortiDocumentService(documentName, params);
    },
    async runOrderAction(orderId: string, actionKey: string, mutation: () => Promise<unknown>, reloadOrder = true) {
      const pendingKey = `${orderId}:${actionKey}`;
      this.pendingActions[pendingKey] = true;

      try {
        const result = await mutation();
        if (reloadOrder) await this.loadOrder(orderId);
        return result;
      } finally {
        this.pendingActions[pendingKey] = false;
      }
    },
    async loadCustomerOrders(customerId: string) {
      return this.getCustomerOrders(customerId);
    },
    async loadCustomer(customerId: string) {
      return this.getCustomer(customerId);
    },
    async loadShipment(shipmentId: string) {
      return this.getShipment(shipmentId);
    },
    async loadReturn(returnId: string) {
      return this.getReturn(returnId);
    },
  },
  persist: true,
});

function sectionErrorMessage(error: any) {
  return error?.message || 'Section failed to load';
}
