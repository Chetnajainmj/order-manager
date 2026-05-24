# Brief 04 — View Order (Order Detail)

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`, `../ENDPOINTS.md § Orders`, `../LEGACY_SCREENS.md § OrderHeaderView`. Briefs 00–02 must be complete. Brief 03 ideally complete (gives you a real entry point).

## Goal

The richest screen in the app: a working replica of OFBiz's OrderHeaderView. Reproduces every section in `LEGACY_SCREENS.md § OrderHeaderView` and supports the in-scope actions.

## Inputs

- Current view: `src/views/OrderDetail.vue` (186 lines, accordion layout). Reuse layout, gut the data wiring.
- Endpoint catalog: `../ENDPOINTS.md § Orders`, especially `GET oms/orders/{orderId}` which calls `co.hotwax.orderledger.order.OrderServices.get#SalesOrder` and is the deep-fetch.
- Legacy reference: `applications/order/widget/ordermgr/OrderViewScreens.xml:54-202` plus the `.ftl` templates listed in LEGACY_SCREENS.md.

## Architecture

**Primary fetch:** `GET oms/orders/{orderId}` (verified live). Returns `{ orderDetail: { ... } }` with this shape (Swagger-confirmed):

```
orderDetail
  ├── orderId, orderName, orderExternalId, orderDate, orderStatusId
  ├── productStoreId, entryDate, grandTotal, currencyUom, salesChannel
  ├── partyId, roleTypeId, customerFirstName, customerLastName
  └── shipGroups[]
        ├── shipGroupSeqId, shipmentMethodTypeId, shipmentMethodTypeDesc
        ├── shipmentId, shipmentStatusId, trackingCode, carrierPartyId
        ├── facilityId, facilityName, facilityTypeId
        ├── picklistId, picklistDate, pickerId, pickerFirstName, pickerLastName
        └── items[]
              ├── orderId, orderItemSeqId, shipGroupSeqId, itemStatusId
              ├── facilityId, productId, productTypeId ...
```

That gets you the **Header + Customer + Ship groups + Items** sections in one call.

**Side calls for sections not in the deep fetch:**

| Section              | Endpoint                                                                                                     |
|----------------------|--------------------------------------------------------------------------------------------------------------|
| Status history       | `GET oms/orders/{orderId}/status` — returns `[{ orderStatusId, statusId, statusDatetime, statusUserLogin, ... }]` (live-verified) |
| Order attributes     | `GET oms/orders/{orderId}/attributes`                                                                        |
| Notes                | `POST oms/dataDocumentView` with `dataDocumentId=OrderManagerOrderNoteLookup` and `customParametersMap.orderId={id}` — DD is seeded; pair with `OrderManagerNoteDataLookup` if you need note body text |
| Order roles          | `POST oms/dataDocumentView` with `OrderManagerOrderRoleLookup`, `customParametersMap.orderId={id}` (Sales reps, affiliates, etc.) |
| Communication log    | `GET oms/communicationEvents?orderId={id}` (`EmailServices.get#CommunicationEvents`)                         |
| Payments / adjustments / contact mechs | Use `GET oms/orders?orderId={id}&dependentLevels=2` — entity-list with deps returns nested `paymentPreferences`, `adjustments`, `contactMechs`, `roles`, `statuses` (live-verified 9.7KB response) |
| Shipments (related)  | `GET poorti/orderShipmentAndRouteSegments?orderId={id}` (purpose-built view)                                 |
| Returns (related)    | `GET oms/returns?primaryOrderId={id}&dependentLevels=2` OR `POST oms/dataDocumentView` with `OrderManagerReturnLookup`, `customParametersMap.primaryOrderId={id}` |
| Full customer detail | `GET oms/parties/{customerPartyId}` — keep this as a side-call rather than relying on the orderDetail's first/last name fields |

## Sales order action parity matrix

Every action below exists on the legacy `hotwax-oms` outgoing sales-order view. The new app keeps all actions in the typed registry so gaps stay visible, but only renders callable controls for documented Moqui/Poorti endpoints. Backend gaps must not link to OFBiz.

| Area | Legacy action | Legacy source | New app status | Endpoint / gap |
|------|---------------|---------------|----------------|----------------|
| Order status | Approve order | `SalesOrderButtonBar.ftl` | Backend gap | Needs Moqui wrapper for legacy `approveSalesOrder` status workflow |
| Order status | Hold order | `SalesOrderButtonBar.ftl` | Backend gap | Needs Moqui wrapper for legacy `holdSalesOrder` |
| Order status | Cancel order | `CancelSalesOrder.ftl` | Backend gap | Item cancel exists; full order cancel workflow does not |
| Order info | Update order header | `OrderInfo.ftl` | Callable | `PUT oms/orders/{orderId}` |
| Order info | Change priority | `OrderInfo.ftl` | Backend gap | Needs service wrapper for `changeOrderPriority` |
| Order info | Update estimated delivery date | `OrderInfo.ftl` | Backend gap | Needs service wrapper for `updateEstimatedDeliveryDate` |
| Returns | Create RMA | `SalesOrderButtonBar.ftl` | Backend gap | Needs validation wrapper matching `validateOrderToCreateReturn` |
| Notes | Add merchandising tags | `CreateAndViewOrderNote.ftl` | Backend gap | Needs merchandising tag endpoint |
| Downloads | Print order PDF | `SalesOrderButtonBar.ftl` | Backend gap | No Moqui order PDF endpoint in catalog |
| Downloads | Download Shopify JSON | `SalesOrderButtonBar.ftl` | Backend gap | No Moqui Shopify JSON endpoint in catalog |
| Fulfillment | Refresh order | `SalesOrderButtonBar.ftl` | Backend gap | Needs Moqui wrapper for `downloadOnlineOrder` |
| Fulfillment | Reindex order | `SalesOrderButtonBar.ftl` | Backend gap | Needs Moqui wrapper for `reCreateOrderIndex` |
| Fulfillment | Reship order | `ReShipOrderItems.ftl` | Backend gap | Needs reship service endpoint |
| Appeasement | Add appeasement | `AddOrderAppeasement.ftl` | Backend gap | Needs appeasement endpoint |
| Metadata | Add identification | `OrderInfo.ftl` | Backend gap | Needs order identification endpoint |
| Metadata | Add attribute | `OrderInfo.ftl` | Backend gap | Catalog exposes read-only `GET oms/orders/{orderId}/attributes` |
| Metadata | Delete attribute | `OrderInfo.ftl` | Backend gap | Needs delete endpoint |
| Adjustments | Add adjustment | `EditAdjustments.ftl` | Backend gap | Needs adjustment endpoint |
| Adjustments | Edit adjustment | `EditOrderAdjustment.ftl` | Backend gap | Needs adjustment endpoint |
| Items | Update item | `OrderItems.ftl` | Callable | `PUT oms/orders/{orderId}/items/{seq}` |
| Items | Delete item | `OrderItems.ftl` | Callable | `DELETE oms/orders/{orderId}/items/{seq}` |
| Items | Cancel item | `OrderItems.ftl` | Callable | `POST oms/orders/{orderId}/items/{seq}/cancel` |
| Items | Reject item | `RejectSalesOrderItem.ftl` | Callable | `POST oms/orders/{orderId}/items/{seq}/reject` |
| Items | Reserve inventory | `ReleaseOrderItemToFacility.ftl` | Callable | `POST oms/orders/{orderId}/items/{seq}/reservation` |
| Items | Cancel reservation | `OrderItems.ftl` | Callable | `DELETE oms/orders/{orderId}/items/{seq}/reservation` |
| Items | Allocate item | `OrderItems.ftl` | Callable | `POST oms/orders/{orderId}/items/{seq}/allocation` |
| Items | Bulk cancel items | `OrderItems.ftl` | Callable | `POST oms/orders/{orderId}/items/cancel` |
| Items | Bulk reject items | `OrderItems.ftl` | Callable | `POST oms/orders/{orderId}/reject` |
| Items | Complete items | `CompleteItems.ftl` | Backend gap | Needs completion endpoint |
| Fulfillment | Allocate order | `SalesOrderButtonBar.ftl` | Callable | `POST oms/orders/{orderId}/allocation` |
| Fulfillment | Reserve soft allocations | `SalesOrderButtonBar.ftl` | Callable | `POST oms/orders/{orderId}/soft-allocations/reserve-inventory` |
| Ship groups | Update ship group | `OrderShipGroups.ftl` | Callable | `PUT oms/orders/{orderId}/shipGroups/{shipGroupSeqId}` |
| Ship groups | Convert to ship-to-store | `OrderShipGroups.ftl` | Callable | `POST oms/orders/{orderId}/shipToStore` |
| Ship groups | Allow split | `OrderShipGroups.ftl` | Callable | `PUT oms/orders/{orderId}/shipGroups/{shipGroupSeqId}` |
| Ship groups | Set gift message | `SetGiftMessageForOrder.ftl` | Callable | `PUT oms/orders/{orderId}/shipGroups/{shipGroupSeqId}` |
| Ship groups | Set shipping instructions | `SetShippingInstructionForOrder.ftl` | Callable | `PUT oms/orders/{orderId}/shipGroups/{shipGroupSeqId}` |
| Ship groups | Update ship by date | `OrderShipGroups.ftl` | Callable | `PUT oms/orders/{orderId}/shipGroups/{shipGroupSeqId}` |
| Ship groups | Update ship after date | `OrderShipGroups.ftl` | Callable | `PUT oms/orders/{orderId}/shipGroups/{shipGroupSeqId}` |
| Ship groups | Edit shipping address | `EditShipGroupShipInfo.ftl` | Backend gap | Needs address/contact endpoint |
| Ship groups | Edit shipping method | `EditShipMethodInfo.ftl` | Backend gap | Raw ship-group update exists; legacy method workflow needs wrapper before parity claim |
| Ship groups | Broker order | `ListOrderRoutingGroups.ftl` | Backend gap | Needs routing group endpoint |
| Ship groups | Add shipping phone | `AddUpdateOrderShippingTelecomNumber.ftl` | Backend gap | Needs contact endpoint |
| Ship groups | Delete shipping phone | `OrderShipGroups.ftl` | Backend gap | Needs contact endpoint |
| Communications | Send order email | `OrderCommunicationEvents.ftl` | Callable | `POST oms/orders/sendEmailNotification` |
| Communications | Send pickup scheduled notification | `SalesOrderButtonBar.ftl` | Callable | `POST oms/orders/pickupScheduledNotification` |
| Communications | Send pickup ready notification | `SalesOrderButtonBar.ftl` | Callable | `POST oms/orders/pickup/{orderId}/notification` |
| Notes | Add order note | `AddOrderNote.ftl` | Callable, confirm backend | `POST oms/orders/{orderId}/notes` is wired but still absent from `ENDPOINTS.md` |
| Downloads | Print packing slip | `OrderShipGroups.ftl` | Callable | `GET poorti/PackingSlip.pdf` |
| Downloads | Print shipping label | `OrderShipGroups.ftl` | Callable | `GET poorti/Label.pdf` |
| Payments | Add payment preference | `AddPaymentPreference.ftl` | Backend gap | Needs payment preference endpoint |
| Payments | Add payment to order | `AddPaymentToOrder.ftl` | Backend gap | Needs payment endpoint |
| Payments | Authorize payment | `AuthorizePayment.ftl` | Backend gap | Needs payment authorization endpoint |
| Payments | Capture payment | `CapturePayment.ftl` | Backend gap | Needs payment capture endpoint |
| Payments | Receive offline payment | `ReceiveOfflinePayment.ftl` | Backend gap | Needs offline payment endpoint |

## Tasks

1. **`src/services/order.ts`** (extend the one from brief 03):
   - `getOrder(orderId): Promise<Order>` — calls `GET oms/orders/{orderId}` and normalizes.
   - `getOrderNotes(orderId)`, `getOrderStatusHistory(orderId)`, `getOrderCommunicationEvents(orderId)`.
   - `addOrderNote(orderId, { noteName, noteInfo, internalNote })`.
   - `cancelOrderItem(orderId, orderItemSeqId, reason)`.
   - `rejectOrderItem(orderId, orderItemSeqId, reason)`.
   - `sendOrderEmail(orderId, emailType: 'PRDS_ODR_CONFIRM' | 'PRDS_ODR_COMPLETE')`.
   - `changeOrderItemStatus(orderId, orderItemSeqId, statusId)`.

2. **Extend `src/types/order.ts`:**
   - Add `Address`, `PaymentPreference`, `OrderTerm`, `OrderRole`, `OrderAttribute`, `CommunicationEvent`, `OrderStatusChange`.
   - The current `Order.notes` and `Order.history` arrays should hold typed entries: `OrderNote[]` and `OrderStatusChange[]`.

3. **Rebuild `views/OrderDetail.vue`:**
   - Keep the page layout but expand the accordion to cover every section in LEGACY_SCREENS.md (Header, Terms, Payments, Contact info, Order roles, Shipping info, Sales reps, Items, Notes, Activity, Transitions).
   - For each section, render a loading skeleton, then real data, then empty / error fallbacks.
   - Items list: show product, SKU, qty (ordered / shipped / cancelled / returned), unit price, adjustments, status. Include per-row "Cancel" / "Reject" buttons gated by `ORDERMGR_UPDATE`.
   - Add note: bottom-of-page composer with internal/customer toggle, gated by `ORDERMGR_UPDATE`.
   - Transitions: render the actions returned by `oms/statusFlows/transitions?statusId={current}` — each as an `ion-button` that fires the appropriate status-change service.
   - Email actions: a menu (kebab) with "Send confirmation" and "Send completion", both gated by `ORDERMGR_SEND_CONFIRMATION` (or its Moqui equivalent — confirm IDs).

4. **Cross-links:**
   - Each shipment row → `router.push({ name: 'ShipmentDetail', params: { shipmentId } })` (Brief 05).
   - Each return row → `router.push({ name: 'ReturnDetail', params: { returnId } })` (Brief 06).
   - Customer name → `router.push({ name: 'CustomerDetail', params: { customerId: customerPartyId } })` (Brief 07).

5. **Permission gating.** Render-time + click-time. Use `useUserStore().hasPermission(...)`.

6. **Delete now-unused code:**
   - `src/data/orders.ts` (after confirming nothing still imports it).
   - The mock branch of `OrderService.ts` and the entire `OrderGateway` factory.
   - Keep the field lists / normalization helpers — they belong in the new per-domain services.

7. **Tests:**
   - Port the relevant `OrderService.spec.ts` cases that test the payload builders / normalizers to `services/order.spec.ts`.
   - Add component tests for sections that have non-trivial logic (Transitions button gating, item cancel confirmation modal).

## Out of scope (defer)

- Editing the order header (`updateOrderHeader`)
- Receiving payment (`OrderReceivePayment` screen)
- Editing terms
- Creating a new order
- Project association

If any of these are critical, raise it before deferring.

## Don't do

- Don't replace the OFBiz screen one-for-one if Moqui's data shape suggests a cleaner UX — but document the deviation in this brief.
- Don't add a custom HTTP client. Use `api` from `@common` only.

## Done when

- Loading `/orders/{realId}` against a real instance renders every section listed above with real data.
- Adding a note round-trips: it appears immediately after save.
- Item cancel / reject buttons execute the right Moqui service and update the visible status.
- Send-email actions trigger the email service and show a toast.
- All actions respect permissions.
- The deletes in task 6 are merged.

## Hand off

Note any sections you had to defer (e.g. "Sales Reps section unimplemented because no Moqui endpoint exposes order roles yet — raised issue #N").

Implemented locally without a git commit per instruction. The detail screen now uses `GET oms/orders/{orderId}` for header/customer/ship groups/items, loads notes/status history/roles/attributes/communications/shipments/returns as independent side sections, and wires item cancel/reject, email send, note add, and item transition actions behind render-time and click-time permission checks. App-level permission gating remains intentionally omitted per user direction.

Deferred/needs live confirmation: the Add note action is wired to `POST oms/orders/{orderId}/notes`, but that route is not listed in `docs/ENDPOINTS.md`; confirm the backend route or replace it with the final OrderNote entity/service endpoint before calling the round-trip complete. Order-header edits, receiving payment, and term edits remain out of scope as stated above.
