# Brief 06 — View Return

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`, `../ENDPOINTS.md`, `../LEGACY_SCREENS.md § OrderReturnHeader`. Briefs 00–02 must be complete.

## Goal

Replace the mock return detail with a real, read-only view of the return: header, items, status history. Match the section coverage in `LEGACY_SCREENS.md § OrderReturnHeader`.

## Inputs

- Current view: `src/views/ReturnDetail.vue` (110 lines). Layout reusable.
- Endpoints: `../ENDPOINTS.md § Returns`. The surface is thin (`GET oms/returns`, `POST oms/returns` only). We'll need `oms/dataDocumentView` or `oms/entityData` for item-level data.

## Architecture

The Moqui swagger only exposes `GET oms/returns` (list) and `POST oms/returns` (create) — there's no `GET oms/returns/{returnId}` and no item-level endpoint. Two DataDocuments fill the gap and **both are already seeded on `dev-maarg`** (verified):

- `OrderManagerReturnLookup` (primary entity `ReturnHeader`, indexed `oms`)
- `OrderManagerReturnItemLookup` (primary entity `ReturnItem`, indexed `oms`)

| Section          | Endpoint                                                                                                 |
|------------------|----------------------------------------------------------------------------------------------------------|
| Header           | `POST oms/dataDocumentView` with `OrderManagerReturnLookup`, `customParametersMap.returnId={id}`         |
| Items            | `POST oms/dataDocumentView` with `OrderManagerReturnItemLookup`, `customParametersMap.returnId={id}`      |
| Status history   | If `OrderManagerOrderStatusLookup` doesn't include return statuses (verify), define a new DataDocument over `ReturnStatus`. Until then, use `GET oms/returns?returnId={id}&dependentLevels=2` which pulls nested statuses with the entity-one. |
| From / to party  | `GET oms/parties/{partyId}` (Brief 07)                                                                   |
| Linked order     | `GET oms/orders/{orderId}` (Brief 04)                                                                    |

**Note:** the dev instance currently has zero returns seeded, so live shape inspection is not possible until a return exists. Run the smoke check against a populated environment, or create a return via `POST oms/returns` first. Codex's `normalizeReturnDoc` (`OrderService.ts`) is a reasonable starting cut for the shape.

## Tasks

1. **`src/services/return.ts`:**
   - `getReturn(returnId)` — header.
   - `getReturnItems(returnId)`.
   - `getReturnStatusHistory(returnId)`.
   - Normalizers (carry forward `normalizeReturnDoc`).

2. **`src/store/return.ts`** (Pinia):
   - Cache `Record<string, ReturnRecord>`, `itemsByReturn`, `statusHistoryByReturn`.
   - Action `loadReturn(returnId)`.

3. **Extend `src/types/order.ts`:**
   - `ReturnRecord`: add `returnHeaderTypeId`, `fromPartyId`, `toPartyId`, `entryDate`, `currencyUomId`, `createdBy`.
   - Add `ReturnItem`: `returnId`, `returnItemSeqId`, `returnReasonId`, `returnTypeId`, `returnItemTypeId`, `productId`, `description`, `orderId`, `orderItemSeqId`, `statusId`, `returnQuantity`, `receivedQuantity`, `returnPrice`, `returnItemResponseId`.
   - Add `ReturnStatusChange`.

4. **Rebuild `views/ReturnDetail.vue`:**
   - Header card (return ID, status, entry date, from / to party, currency, refund total).
   - Items list (per item: product, qty requested, qty received, reason, type, price).
   - Status history accordion.
   - "Back to order" link if `orderId` is present (returns are usually scoped to one order).

5. **Cross-links:** From party / to party → `/customers/{partyId}` (Brief 07). Linked order → `/orders/{orderId}` (Brief 04). Each return item → that order's item (anchor inside Brief 04's view).

6. **Permission gate.** `meta: { permissionId: 'ORDERMGR_RETURN' }`.

7. **Tests.** Payload + normalizer unit tests.

## Out of scope (defer)

- Editing return header / items
- Approving / receiving / cancelling the return
- Creating a new return (the `OrderQuickReturn` flow)
- Field-history screens (`ReturnTypeHistory`, `ReturnReasonHistory`, `ReturnQuantityHistory`, `ReceivedQuantityHistory`, `ReturnPriceHistory`)

The history screens are a OFBiz auditing nicety; defer until a customer asks. Note: a single "Recent changes" panel powered by a DataDocument over `ReturnItem` change records could replace all five in one shot — pitch this if it comes up.

## Done when

- `/returns/{realId}` renders header + items + status history with real data.
- Cross-links to order and party work.

## Hand off

Document which DataDocument(s) you ended up needing (seeded or used existing) at the bottom of `ENDPOINTS.md § DataDocument super-endpoints`.

Implemented locally without a git commit per instruction. Return detail now has `src/services/return.ts`, `src/store/return.ts`, and a read-only Ionic detail view backed by the existing `OrderManagerReturnLookup` and `OrderManagerReturnItemLookup` DataDocuments, with status history read from `GET oms/returns?returnId={id}&dependentLevels=2`. App-level and route-level permission gates remain intentionally omitted per user direction.

Data gaps/deferred: the dev instance had no seeded returns for an authenticated live-shape smoke, so coverage is from unit tests, build, and route availability. Return edit/approval/receiving/cancel flows and the field-history screens remain out of scope.
