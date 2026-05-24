import type {
  OrderActionContext,
  OrderActionDefinition,
  OrderActionGroup,
  OrderActionImplementationStatus
} from '@/types/order';

export const salesOrderActionGroups: OrderActionGroup[] = [
  'order-status',
  'order-info',
  'items',
  'ship-groups',
  'payments',
  'communications',
  'notes',
  'returns',
  'metadata',
  'adjustments',
  'downloads',
  'fulfillment',
  'appeasement',
];

const terminalOrderStatuses = ['ORDER_COMPLETED', 'ORDER_CANCELLED', 'ORDER_REJECTED'];
const updatePermission = 'ORDERMGR_UPDATE OR ORD_SALES_ORDER_EDIT OR ORD_SALES_ORDER_ADMIN OR ORDERMGR_ADMIN';
const viewPermission = 'ORDERMGR_VIEW OR ORD_SALES_ORDER_ADMIN OR ORDERMGR_ADMIN';
const sendPermission = 'ORDERMGR_SEND_CONFIRMATION OR COMM_EVNT_MENU_VIEW OR ORD_SALES_ORDER_ADMIN OR ORDERMGR_ADMIN';

export const legacySalesOrderActions: OrderActionDefinition[] = [
  documentedGap('approve-order', 'Approve order', 'order-status', 'SalesOrderButtonBar.ftl', updatePermission),
  documentedGap('hold-order', 'Hold order', 'order-status', 'SalesOrderButtonBar.ftl', updatePermission),
  documentedGap('cancel-order', 'Cancel order', 'order-status', 'CancelSalesOrder.ftl', 'ORD_SALES_ORDER_CNCL'),
  callable('update-order-header', 'Update order header', 'order-info', 'OrderInfo.ftl', updatePermission, 'oms/orders/{orderId}', terminalOrderStatuses),
  backendGap('create-rma', 'Create RMA', 'returns', 'SalesOrderButtonBar.ftl', 'CRT_RMA_VIEW'),
  backendGap('add-merchandising-tags', 'Add merchandising tags', 'notes', 'CreateAndViewOrderNote.ftl', updatePermission),
  backendGap('print-order-pdf', 'Print order PDF', 'downloads', 'SalesOrderButtonBar.ftl', viewPermission),
  backendGap('download-shopify-json', 'Download Shopify JSON', 'downloads', 'SalesOrderButtonBar.ftl', 'DWNLD_ONLN_ORDR'),
  backendGap('refresh-order', 'Refresh order', 'fulfillment', 'SalesOrderButtonBar.ftl', 'REFRESH_ORDER'),
  backendGap('reindex-order', 'Reindex order', 'fulfillment', 'SalesOrderButtonBar.ftl', 'REINDEX_ORDER'),
  backendGap('reship-order', 'Reship order', 'fulfillment', 'ReShipOrderItems.ftl', 'RESHIP_ORDER'),
  backendGap('add-appeasement', 'Add appeasement', 'appeasement', 'AddOrderAppeasement.ftl', 'ADD_APPEASEMENT'),

  backendGap('change-priority', 'Change priority', 'order-info', 'OrderInfo.ftl', updatePermission),
  backendGap('update-estimated-delivery-date', 'Update estimated delivery date', 'order-info', 'OrderInfo.ftl', updatePermission),
  backendGap('add-order-identification', 'Add order identification', 'metadata', 'OrderInfo.ftl', 'ORDER_IDENT_CREATE'),
  backendGap('add-order-attribute', 'Add order attribute', 'metadata', 'OrderInfo.ftl', 'ORDER_ATTR_CREATE'),
  backendGap('delete-order-attribute', 'Delete order attribute', 'metadata', 'OrderInfo.ftl', 'ORDER_ATTR_DELETE'),
  backendGap('add-order-adjustment', 'Add order adjustment', 'adjustments', 'EditAdjustments.ftl', updatePermission),
  backendGap('edit-order-adjustment', 'Edit order adjustment', 'adjustments', 'EditOrderAdjustment.ftl', updatePermission),

  callable('update-item', 'Update item', 'items', 'OrderItems.ftl', updatePermission, 'oms/orders/{orderId}/items/{seq}', terminalOrderStatuses),
  callable('delete-item', 'Delete item', 'items', 'OrderItems.ftl', updatePermission, 'oms/orders/{orderId}/items/{seq}', terminalOrderStatuses),
  callable('cancel-item', 'Cancel item', 'items', 'OrderItems.ftl', updatePermission, 'oms/orders/{orderId}/items/{seq}/cancel', terminalOrderStatuses),
  callable('reject-item', 'Reject item', 'items', 'RejectSalesOrderItem.ftl', updatePermission, 'oms/orders/{orderId}/items/{seq}/reject', terminalOrderStatuses),
  callable('reserve-item-inventory', 'Reserve inventory', 'items', 'ReleaseOrderItemToFacility.ftl', updatePermission, 'oms/orders/{orderId}/items/{seq}/reservation', terminalOrderStatuses),
  callable('cancel-item-reservation', 'Cancel reservation', 'items', 'OrderItems.ftl', updatePermission, 'oms/orders/{orderId}/items/{seq}/reservation', terminalOrderStatuses),
  callable('allocate-item', 'Allocate item', 'items', 'OrderItems.ftl', updatePermission, 'oms/orders/{orderId}/items/{seq}/allocation', terminalOrderStatuses),
  callable('bulk-cancel-items', 'Cancel items', 'items', 'OrderItems.ftl', updatePermission, 'oms/orders/{orderId}/items/cancel', terminalOrderStatuses),
  callable('bulk-reject-items', 'Reject items', 'items', 'OrderItems.ftl', updatePermission, 'oms/orders/{orderId}/reject', terminalOrderStatuses),
  backendGap('complete-items', 'Complete items', 'items', 'CompleteItems.ftl', updatePermission),

  callable('allocate-order', 'Allocate order', 'fulfillment', 'SalesOrderButtonBar.ftl', updatePermission, 'oms/orders/{orderId}/allocation', terminalOrderStatuses),
  callable('reserve-soft-allocations', 'Reserve soft allocations', 'fulfillment', 'SalesOrderButtonBar.ftl', updatePermission, 'oms/orders/{orderId}/soft-allocations/reserve-inventory', terminalOrderStatuses),
  callable('update-ship-group', 'Update ship group', 'ship-groups', 'OrderShipGroups.ftl', updatePermission, 'oms/orders/{orderId}/shipGroups/{shipGroupSeqId}', terminalOrderStatuses),
  callable('ship-to-store', 'Convert to ship-to-store', 'ship-groups', 'OrderShipGroups.ftl', updatePermission, 'oms/orders/{orderId}/shipToStore', terminalOrderStatuses),
  callable('allow-split', 'Allow split', 'ship-groups', 'OrderShipGroups.ftl', updatePermission, 'oms/orders/{orderId}/shipGroups/{shipGroupSeqId}', terminalOrderStatuses),
  callable('set-gift-message', 'Set gift message', 'ship-groups', 'SetGiftMessageForOrder.ftl', updatePermission, 'oms/orders/{orderId}/shipGroups/{shipGroupSeqId}', terminalOrderStatuses),
  callable('set-shipping-instructions', 'Set shipping instructions', 'ship-groups', 'SetShippingInstructionForOrder.ftl', updatePermission, 'oms/orders/{orderId}/shipGroups/{shipGroupSeqId}', terminalOrderStatuses),
  callable('update-ship-by-date', 'Update ship by date', 'ship-groups', 'OrderShipGroups.ftl', updatePermission, 'oms/orders/{orderId}/shipGroups/{shipGroupSeqId}', terminalOrderStatuses),
  callable('update-ship-after-date', 'Update ship after date', 'ship-groups', 'OrderShipGroups.ftl', updatePermission, 'oms/orders/{orderId}/shipGroups/{shipGroupSeqId}', terminalOrderStatuses),
  backendGap('edit-shipping-address', 'Edit shipping address', 'ship-groups', 'EditShipGroupShipInfo.ftl', updatePermission),
  backendGap('edit-shipping-method', 'Edit shipping method', 'ship-groups', 'EditShipMethodInfo.ftl', updatePermission),
  backendGap('broker-order', 'Broker order', 'ship-groups', 'ListOrderRoutingGroups.ftl', 'BROKER_ITEM'),
  backendGap('add-shipping-phone', 'Add shipping phone', 'ship-groups', 'AddUpdateOrderShippingTelecomNumber.ftl', updatePermission),
  backendGap('delete-shipping-phone', 'Delete shipping phone', 'ship-groups', 'OrderShipGroups.ftl', updatePermission),

  callable('pickup-scheduled-notification', 'Send pickup scheduled notification', 'communications', 'SalesOrderButtonBar.ftl', sendPermission, 'oms/orders/pickupScheduledNotification'),
  callable('pickup-ready-notification', 'Send pickup ready notification', 'communications', 'SalesOrderButtonBar.ftl', sendPermission, 'oms/orders/pickup/{orderId}/notification'),
  callable('send-order-email', 'Send order email', 'communications', 'OrderCommunicationEvents.ftl', sendPermission, 'oms/orders/sendEmailNotification'),
  callable('add-order-note', 'Add note', 'notes', 'AddOrderNote.ftl', updatePermission, 'oms/orders/{orderId}/notes', terminalOrderStatuses),
  callable('print-packing-slip', 'Print packing slip', 'downloads', 'OrderShipGroups.ftl', viewPermission, 'poorti/PackingSlip.pdf'),
  callable('print-shipping-label', 'Print shipping label', 'downloads', 'OrderShipGroups.ftl', viewPermission, 'poorti/Label.pdf'),

  backendGap('add-payment-preference', 'Add payment preference', 'payments', 'AddPaymentPreference.ftl', updatePermission),
  backendGap('add-payment-to-order', 'Add payment to order', 'payments', 'AddPaymentToOrder.ftl', updatePermission),
  backendGap('authorize-payment', 'Authorize payment', 'payments', 'AuthorizePayment.ftl', updatePermission),
  backendGap('capture-payment', 'Capture payment', 'payments', 'CapturePayment.ftl', updatePermission),
  backendGap('receive-offline-payment', 'Receive offline payment', 'payments', 'ReceiveOfflinePayment.ftl', updatePermission),
];

export function getCallableOrderActions(context: OrderActionContext) {
  return legacySalesOrderActions.filter((action) => isOrderActionCallable(action, context));
}

export function getBackendGapOrderActions() {
  return legacySalesOrderActions.filter((action) => action.implementationStatus === 'backend-gap');
}

export function getCallableOrderActionsByGroup(group: OrderActionGroup, context: OrderActionContext) {
  return getCallableOrderActions(context).filter((action) => action.group === group);
}

export function isOrderActionCallable(action: OrderActionDefinition, context: OrderActionContext) {
  if (action.implementationStatus !== 'callable') return false;
  if (action.permission && !hasPermissionExpression(context.permissions, action.permission)) return false;
  if (context.orderStatus && action.hiddenForStatuses?.includes(context.orderStatus)) return false;
  return true;
}

function hasPermissionExpression(permissions: string[], expression: string): boolean {
  if (expression.includes(' OR ')) {
    return expression.split(' OR ').some((part) => hasPermissionExpression(permissions, part.trim()));
  }

  if (expression.includes(' AND ')) {
    return expression.split(' AND ').every((part) => hasPermissionExpression(permissions, part.trim()));
  }

  return permissions.includes(expression);
}

function callable(
  id: string,
  label: string,
  group: OrderActionGroup,
  legacySource: string,
  permission: string,
  endpoint: string,
  hiddenForStatuses: string[] = []
): OrderActionDefinition {
  return action(id, label, group, legacySource, permission, 'documented-endpoint', 'callable', endpoint, hiddenForStatuses);
}

function backendGap(id: string, label: string, group: OrderActionGroup, legacySource: string, permission: string): OrderActionDefinition {
  return action(id, label, group, legacySource, permission, 'backend-gap', 'backend-gap');
}

function documentedGap(id: string, label: string, group: OrderActionGroup, legacySource: string, permission: string): OrderActionDefinition {
  return action(id, label, group, legacySource, permission, 'documented-backend-gap', 'backend-gap');
}

function action(
  id: string,
  label: string,
  group: OrderActionGroup,
  legacySource: string,
  permission: string,
  endpointStatus: OrderActionDefinition['endpointStatus'],
  implementationStatus: OrderActionImplementationStatus,
  endpoint?: string,
  hiddenForStatuses: string[] = []
): OrderActionDefinition {
  return {
    id,
    label,
    group,
    legacySource,
    permission,
    endpoint,
    endpointStatus,
    implementationStatus,
    hiddenForStatuses,
  };
}
