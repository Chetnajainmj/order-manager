# Brief 08 — Find Returns screen

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`, `../ENDPOINTS.md § Returns`, `../ENDPOINTS.md § Pre-seeded DataDocuments`. Briefs 00–02 must be complete. Brief 06 provides the detail page rows will link to.

## Goal

A search screen at `/returns` that lets a CSR find a return by **order name / order ID** or by **customer name**, with filters for status, date range, and product store. Infinite-scroll pagination. Tapping a row navigates to the existing `/returns/:returnId` detail view from brief 06.

## Inputs

- Pattern to clone: [`src/views/OrderSearch.vue`](../../src/views/OrderSearch.vue), [`src/store/order.ts`](../../src/store/order.ts), [`src/services/order.ts`](../../src/services/order.ts) `buildOrderLookupPayload` (lines 48–83) and `searchOrders` (lines 85–93).
- Current stubs to replace: [`src/store/returns.ts`](../../src/store/returns.ts) (1-line stub).
- Detail route already exists: `/returns/:returnId` → `ReturnDetail.vue` (brief 06).
- DataDocument and field list already declared: `defaultDataDocuments.returnLookup = 'OrderManagerReturnLookup'` in `src/services/OrderService.ts:32`, `returnLookupFields` lines 117–132. **Live-verified seeded** (see ENDPOINTS.md table).

## Architecture: reuse `OrderManagerReturnLookup`

The DataDocument is already seeded and covers everything we need for a list view:

```
POST oms/dataDocumentView
{
  "dataDocumentId": "OrderManagerReturnLookup",
  "format": "json",
  "fieldsToSelect": ["returnId","externalId","statusId","returnHeaderTypeId","fromPartyId","toPartyId","entryDate","createdDate","receivedDate","currencyUomId","createdBy","orderId","returnTotal","grandTotal"],
  "customParametersMap": { ... },
  "orderByField": "-entryDate",
  "pageSize": 50,
  "pageIndex": 0
}
```

**Smoke-check before writing code** (an unpopulated dev instance will return 0 rows; that's expected):

```bash
eval "$(node scripts/dev-login.mjs --shell)"
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -X POST "${MAARG_URL}oms/dataDocumentView" \
  -d '{"dataDocumentId":"OrderManagerReturnLookup","format":"json","pageSize":5}' | jq '.entityValueList[0]'
```

If `OrderManagerReturnLookup` does not include the customer-name fields exposed by its joined Party (live probe to confirm), fall back to the **two-step approach**:

1. Resolve the typed query string → a list of `fromPartyId`s via the customer search service from brief 09 (or `GET oms/parties` filters: `firstName`, `lastName`, `groupName`).
2. Re-issue the return search with `customParametersMap.fromPartyId` set to the matched IDs (or use the entity-list `GET oms/returns?fromPartyId=...` for a single ID).

The DataDocument is preferred — only fall back if the join is missing.

## Query routing (matches OrderSearch's auto-detect heuristic)

Inside `buildReturnLookupPayload`, when a `queryString` is present:

| Pattern | Param mapped |
|---|---|
| starts with `#`, or matches order-name format (e.g. `WS-...`, `M1001`) | `customParametersMap.orderId` (also accept `orderName`) |
| starts with `R` followed by digits / matches return-ID format | `customParametersMap.returnId` |
| `@` present | resolve via brief 09 customer search → `fromPartyId` |
| otherwise (free-text name) | `customParametersMap.partyName` (contains) — if backend doesn't support, fall back to two-step lookup |

Filter map:

| Filter | Param |
|---|---|
| status (`All` = omit) | `statusId` |
| date from | `entryDate_from` (ms epoch, start of day) |
| date thru | `entryDate_thru` (ms epoch, end of day) |
| product store (`All` = omit) | `productStoreId` if the DataDocument exposes it; otherwise drop the filter |

Reuse `toStartOfDayMillis` / `toEndOfDayMillis` from `src/services/order.ts`.

## Tasks

1. **Service — extend [`src/services/return.ts`](../../src/services/return.ts):**
   - Export `interface ReturnSearchParams { queryString?, status?, dateFrom?, dateThru?, productStoreId?, pageSize?, pageIndex? }`.
   - Export `buildReturnLookupPayload(params)` mirroring `buildOrderLookupPayload`.
   - Export `searchReturns(params): Promise<{ returns: ReturnRecord[], total: number }>` — POSTs to `oms/dataDocumentView`, normalizes each row through the existing `normalizeReturnDoc`.
   - Reuse `allDocs(response.data)` and `responseList` helpers already in the file / `OrderService.ts`.

2. **Store — flesh out [`src/store/returns.ts`](../../src/store/returns.ts):**
   - Trimmed clone of `src/store/order.ts:30` — search state only (the singular `src/store/return.ts` keeps the detail/cache concerns).
   - State: `searchQuery`, `searchFilters` (`status`, `dateFrom`, `dateThru`, `productStoreId`), `searchResults: ReturnRecord[]`, `searchTotal`, `pageIndex`, `pageSize` (50), `loading`, `error`.
   - Actions: `runSearch`, `appendNextPage`, `fetchSearchPage(pageIndex)`, `toSearchParams(pageIndex)`.
   - Getter: `hasMore`.
   - `persist: true`.

3. **View — new `src/views/ReturnSearch.vue`:**
   - Clone the `OrderSearch.vue` skeleton.
   - Searchbar placeholder: `"Return ID, order, customer"`.
   - Filters: status (from `useUtilStore().getStatusItemsByType('RETURN_HEADER_STATUS')`), date from/thru, product store (from `useUserStore().getUserProfile?.stores`).
   - Row content: `{{ ret.id }} · {{ ret.status }}` / `{{ ret.orderId }} · {{ ret.requestedDate }}` / `{{ ret.refundTotal }}` with `:router-link="`/returns/${ret.id}`"`.
   - Empty / error states via `EmptyState.vue` / `ErrorState.vue`.

4. **Route — add to [`src/router/index.ts`](../../src/router/index.ts):**
   - `{ path: '/returns', name: 'ReturnSearch', component: ReturnSearch, beforeEnter: authGuard }`. Insert before the dynamic `/returns/:returnId`.

5. **Menu — add to [`src/components/Menu.vue`](../../src/components/Menu.vue):**
   - New `<ion-menu-toggle>` block under "Find orders" with `returnOutline` icon and `translate("Find returns")` label, routing to `/returns`.

6. **Util store warm-up.** If `RETURN_HEADER_STATUS` isn't in the `util` store yet, add `fetchStatusItemsByType('RETURN_HEADER_STATUS')` to the existing fetch list. Same pattern as OrderSearch's `onMounted`.

7. **Tests.** Port the order-search test pattern to `src/services/return.spec.ts` / `src/store/returns.spec.ts`: cover the query-routing branches in `buildReturnLookupPayload`, `runSearch` happy path, and `appendNextPage` paging.

## Don't do

- Don't add create / approve / receive / cancel actions — those are out of scope for the read-only phase (and stay out of brief 06's scope too).
- Don't fetch return items or status history on the search page; that work belongs to the detail screen.
- Don't introduce new types — reuse `ReturnRecord` from `src/types/order.ts`.

## Done when

- Typing an order ID/name returns the linked returns within ~300ms.
- Typing a customer name returns returns scoped to that customer (either via DataDocument's party join, or the two-step fallback).
- Status filter narrows results; date range narrows results.
- Infinite scroll appends pages.
- Tapping a row opens `/returns/{returnId}` (brief 06's view).
- "Find returns" appears in the sidebar.

## Hand off

- If you had to add a new DataDocument field or seed a new join, note it under `ENDPOINTS.md § Pre-seeded DataDocuments` with the seed script path.
- Note whether the DataDocument exposed `partyName` for the customer-name search, or whether you took the two-step fallback. If two-step, link to the helper in `services/customer.ts`.
- Document any seeded test returns used to verify (no live returns exist on the current dev instance — see brief 06's hand-off note).
