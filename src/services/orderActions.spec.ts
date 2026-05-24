import { describe, expect, it } from 'vitest';
import {
  getBackendGapOrderActions,
  getCallableOrderActions,
  legacySalesOrderActions,
  salesOrderActionGroups
} from './orderActions';

describe('sales order action registry', () => {
  it('tracks every legacy sales order action area from the parity plan', () => {
    expect(salesOrderActionGroups).toEqual(expect.arrayContaining([
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
    ]));

    expect(legacySalesOrderActions.map((action) => action.id)).toEqual(expect.arrayContaining([
      'approve-order',
      'hold-order',
      'cancel-order',
      'create-rma',
      'add-merchandising-tags',
      'print-order-pdf',
      'download-shopify-json',
      'refresh-order',
      'reindex-order',
      'reship-order',
      'add-appeasement',
      'change-priority',
      'update-estimated-delivery-date',
      'add-order-adjustment',
      'edit-order-adjustment',
      'add-order-identification',
      'add-order-attribute',
      'delete-order-attribute',
      'update-item',
      'delete-item',
      'cancel-item',
      'reject-item',
      'reserve-item-inventory',
      'cancel-item-reservation',
      'allocate-item',
      'bulk-cancel-items',
      'bulk-reject-items',
      'allocate-order',
      'reserve-soft-allocations',
      'update-ship-group',
      'ship-to-store',
      'pickup-scheduled-notification',
      'pickup-ready-notification',
      'print-packing-slip',
      'print-shipping-label',
      'send-order-email',
      'add-order-note',
      'add-payment-preference',
      'authorize-payment',
      'capture-payment',
      'receive-offline-payment',
      'allow-split',
      'set-gift-message',
      'set-shipping-instructions',
      'update-ship-by-date',
      'update-ship-after-date',
    ]));
  });

  it('only returns documented callable actions for controls', () => {
    const callableActions = getCallableOrderActions({
      permissions: ['ORDERMGR_UPDATE', 'ORDERMGR_SEND_CONFIRMATION'],
      orderStatus: 'ORDER_APPROVED',
    });

    expect(callableActions.length).toBeGreaterThan(0);
    expect(callableActions.every((action) => action.implementationStatus === 'callable')).toBe(true);
    expect(callableActions.map((action) => action.id)).toEqual(expect.arrayContaining([
      'cancel-item',
      'reject-item',
      'send-order-email',
      'update-ship-group',
      'reserve-soft-allocations',
    ]));
    expect(callableActions.map((action) => action.id)).not.toContain('download-shopify-json');
  });

  it('keeps backend gaps explicit but not callable', () => {
    const backendGapActions = getBackendGapOrderActions();

    expect(backendGapActions.map((action) => action.id)).toEqual(expect.arrayContaining([
      'approve-order',
      'create-rma',
      'download-shopify-json',
      'refresh-order',
      'reindex-order',
      'reship-order',
      'add-appeasement',
      'authorize-payment',
      'capture-payment',
      'receive-offline-payment',
    ]));
    expect(backendGapActions.every((action) => action.implementationStatus === 'backend-gap')).toBe(true);
  });

  it('hides update actions on terminal orders', () => {
    const callableActions = getCallableOrderActions({
      permissions: ['ORDERMGR_UPDATE', 'ORDERMGR_SEND_CONFIRMATION'],
      orderStatus: 'ORDER_COMPLETED',
    });

    expect(callableActions.map((action) => action.id)).not.toContain('cancel-item');
    expect(callableActions.map((action) => action.id)).toContain('send-order-email');
  });
});
