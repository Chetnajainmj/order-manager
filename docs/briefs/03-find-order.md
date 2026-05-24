# Brief 03 — Find Order screen

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`, `../ENDPOINTS.md`, `../LEGACY_SCREENS.md § OrderFindOrder`. Briefs 00–02 must be complete.

## Goal

Replace the mock-data search with real Moqui-backed order search. Filters by status, channel, product store, date range work. Infinite-scroll pagination works. Results link to the Order Detail screen.

## Inputs

- Current view: `src/views/OrderSearch.vue` (104 lines) — layout is reusable.
- Current service code worth salvaging: `src/services/OrderService.ts`, especially `orderLookupFields` (lines 142–155) and `buildOrderDataDocumentPayload` (lines 258–285).
- Endpoint catalog: `../ENDPOINTS.md § Orders` and `§ DataDocument super-endpoints`.

## Architecture: use `OrderManagerOrderLookup`

The DataDocument-backed path is the right call. **The `OrderManagerOrderLookup` DataDocument is already seeded on `dev-maarg`** (verified live — see `../ENDPOINTS.md § Pre-seeded DataDocuments`). The endpoint is:

```
POST oms/dataDocumentView
{
  "dataDocumentId": "OrderManagerOrderLookup",
  "format": "json",
  "fieldsToSelect": ["hcOrderId","orderName","externalId","orderDate","statusId","grandTotal","currencyUom","productStoreId","salesChannelEnumId","priority"],
  "customParametersMap": {
    "orderTypeId": "SALES_ORDER",
    "statusId": "ORDER_APPROVED"
  },
  "orderByField": "-orderDate",
  "pageSize": 50,
  "pageIndex": 0
}
```

Response shape (verified live): `{ entityValueList: [...], count: <total> }`. Codex's `normalizeOrderCollectionResponse` (`OrderService.ts`) already understands this. Live-verified sample keys on each row: `hcOrderId`, `orderTypeId`, `orderName`, `externalId`, `orderDate`, `statusId`, `salesChannelEnumId`, `grandTotal`, `currencyUom`, `productStoreId`.

**Smoke-check before writing code:**

```bash
eval "$(node scripts/dev-login.mjs --shell)"
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -X POST "${MAARG_URL}oms/dataDocumentView" \
  -d '{"dataDocumentId":"OrderManagerOrderLookup","format":"json","pageSize":5}' | jq '.entityValueList[0]'
```

### When to fall back to the entity-list endpoint

`GET oms/orders` (entity-list) supports `dependentLevels` and a long list of field filters (see `../ENDPOINTS.md § Orders / Entity-list filters`). Use it only if the DataDocument's `fieldsToSelect` is missing something you need — usually it isn't. **One known gap:** the entity-list does NOT accept a `customerPartyId` filter, so for "orders by customer" use the DataDocument (which exposes the joined Party).

## Tasks

1. **Create `src/services/order.ts`** (replaces the search-related parts of `OrderService.ts`):
   - Export `searchOrders({ queryString, status, channel, productStoreId, dateFrom, dateThru, pageSize, pageIndex })`.
   - Use `api({ url: 'oms/dataDocumentView', method: 'post', data: buildOrderLookupPayload(...) })`.
   - Carry forward the normalization (`normalizeOrderDoc`, the field lists) from the existing `OrderService.ts` — they're correct.
   - Return `{ orders: Order[], total: number }`.

2. **Create `src/store/order.ts`** (Pinia store):
   - State: `searchQuery`, `searchFilters`, `searchResults`, `searchTotal`, `pageIndex`, `loading`, `cache: Record<string, Order>`.
   - Action `runSearch()` calls `searchOrders(...)`, replaces `searchResults`, upserts to `cache`.
   - Action `appendNextPage()` increments `pageIndex` and pushes onto `searchResults`.
   - Action `cacheOrders(orders)` upserts into the per-ID cache (for detail screens to read).

3. **Refactor `views/OrderSearch.vue`:**
   - Replace `useOrdersStore()` with `useOrderStore()`.
   - Searchbar input → debounced `runSearch`.
   - `IonSelect` for status reads from `useUtilStore().statuses` (filtered to order status types). If util store doesn't have it yet, fetch `GET oms/statuses?statusTypeId=ORDER_STATUS` and `?statusTypeId=ORDER_ITEM_STATUS`.
   - `IonSelect` for channel reads from `useUtilStore().enums.SalesChannel` (fetched via `GET admin/enums?enumTypeId=ORDER_SALES_CHANNEL`).
   - Add date range pickers, product-store filter (from `useUserStore().current.stores`).
   - Wire `IonInfiniteScroll` to `appendNextPage`.
   - Each result row uses `<router-link :to="{ name: 'OrderDetail', params: { orderId: order.id } }">`.

4. **Empty / error / loading states** (using components from brief 02).

5. **Permission gate.** Use `meta: { permissionId: 'ORDERMGR_VIEW' }` on the `/orders` route (brief 01 should already have this).

6. **Tests.** Port relevant tests from `OrderService.spec.ts` to the new `services/order.spec.ts`. Test the payload builder and the normalizer purely; mock `api` for end-to-end.

## Don't do

- Don't add edit / cancel / send-email actions here — those live on the detail screen (brief 04).
- Don't load shipments or returns yet; only orders.
- Don't introduce new types — reuse `Order` from `src/types/order.ts`.

## Done when

- Typing "M1001" (or a real order ID) shows it within ~300ms.
- Selecting a status filter narrows results.
- Scrolling to the bottom loads the next page.
- Tapping a row navigates to `/orders/{id}` (which still shows mock data — brief 04 fills it).
- Removing the mock gateway is *not* required yet; just stop reading from it in this screen. Brief 04 will finish the removal.

## Hand off

If you had to seed a DataDocument, link the PR or commit in `MIGRATION_PLAN.md § Phase 3` and note any field name discrepancies vs. the field list in this brief.

Implemented locally without a git commit per instruction. No DataDocument seed was needed; the search uses the existing `OrderManagerOrderLookup`. App-level permission gating remains intentionally omitted per user direction.
