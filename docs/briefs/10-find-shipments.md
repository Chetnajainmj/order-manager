# Brief 10 — Find Shipments screen

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`, `../ENDPOINTS.md § Shipments`, `../ENDPOINTS.md § Pre-seeded DataDocuments`. Briefs 00–02 must be complete. Brief 05 provides the detail page rows will link to.

## Goal

A search screen at `/shipments` that lets a CSR find a shipment by **order ID / order name** or by **tracking code**, with filters for status, carrier, and ship-date range. Infinite-scroll pagination. Tapping a row navigates to the existing `/shipments/:shipmentId` detail view from brief 05.

## Inputs

- Pattern to clone: [`src/views/OrderSearch.vue`](../../src/views/OrderSearch.vue), [`src/store/order.ts`](../../src/store/order.ts), [`src/services/order.ts`](../../src/services/order.ts) `buildOrderLookupPayload`.
- Current stubs to replace: [`src/store/shipments.ts`](../../src/store/shipments.ts) (1-line stub).
- Detail route already exists: `/shipments/:shipmentId` → `ShipmentDetail.vue` (brief 05).
- DataDocument and field list already declared: `defaultDataDocuments.shipmentLookup = 'OrderManagerShipmentLookup'` in `src/services/OrderService.ts:31`, `shipmentLookupFields` lines 52–64. **Live-verified seeded** (see ENDPOINTS.md table).

## Architecture: use `OrderManagerShipmentLookup`

The DataDocument is the right primary path — it joins `Shipment` header with carrier party. Live-verified keys: `shipmentId, primaryOrderId, statusId, carrierPartyId, originFacilityId, createdDate`.

```
POST oms/dataDocumentView
{
  "dataDocumentId": "OrderManagerShipmentLookup",
  "format": "json",
  "fieldsToSelect": ["shipmentId","primaryOrderId","shipmentTypeId","statusId","carrierPartyId","originFacilityId","destinationFacilityId","estimatedShipDate","estimatedArrivalDate","latestCancelDate","createdDate"],
  "customParametersMap": { ... },
  "orderByField": "-createdDate",
  "pageSize": 50,
  "pageIndex": 0
}
```

### Tracking-code search — known gap

The `OrderManagerShipmentLookup` DataDocument's primary entity is `Shipment`, but tracking codes live on `ShipmentRouteSegment.trackingIdNumber` (see `normalizeShipmentDoc` at `OrderService.ts:331` — it reads `trackingCode ?? trackingIdNumber`). Two options:

- **Option A (preferred):** verify whether the live `OrderManagerShipmentLookup` join already exposes `trackingIdNumber` (smoke-check below). If so, route `trackingCode` queries to that param.
- **Option B (fallback):** use the pre-seeded `ShipmentRouteAndPackageRouteSegment` DataDocument (see ENDPOINTS.md § Pre-seeded DataDocuments, "Other useful seeded DataDocuments") — query via `admin/dataDocuments/{id}/data` with `customParametersMap.trackingIdNumber=...` → get `shipmentId`s → second call to fetch headers via `OrderManagerShipmentLookup` with `shipmentId_in=...`.

**Smoke-check before writing code:**

```bash
eval "$(node scripts/dev-login.mjs --shell)"
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -X POST "${MAARG_URL}oms/dataDocumentView" \
  -d '{"dataDocumentId":"OrderManagerShipmentLookup","format":"json","pageSize":3}' | jq '.entityValueList[0] | keys'
```

If `trackingIdNumber` (or `trackingCode`) is in the key list, option A; otherwise option B.

## Query routing

Inside `buildShipmentLookupPayload`:

| Pattern | Param mapped |
|---|---|
| starts with `#`, or matches order-name (`WS-...` / `M1001`) | `primaryOrderId` (try `orderName` too) |
| matches shipment-ID pattern (e.g. starts with `SHIP_`) | `shipmentId` |
| free text / alphanumeric tracking-like string | `trackingIdNumber` (option A) or two-step lookup (option B) |

Filter map:

| Filter | Param |
|---|---|
| status (`All` = omit) | `statusId` |
| carrier (`All` = omit) | `carrierPartyId` |
| ship-date from | `estimatedShipDate_from` (ms epoch, start of day) |
| ship-date thru | `estimatedShipDate_thru` (ms epoch, end of day) |

Reuse `toStartOfDayMillis` / `toEndOfDayMillis` from `src/services/order.ts`.

## Tasks

1. **Service — extend [`src/services/shipment.ts`](../../src/services/shipment.ts):**
   - Export `interface ShipmentSearchParams { queryString?, status?, carrierPartyId?, dateFrom?, dateThru?, pageSize?, pageIndex? }`.
   - Export `buildShipmentLookupPayload(params)` mirroring `buildOrderLookupPayload`.
   - Export `searchShipments(params): Promise<{ shipments: Shipment[], total: number }>` — POSTs to `oms/dataDocumentView`, normalizes via existing `normalizeShipmentDoc`.
   - If option B is needed, add a private `resolveShipmentIdsByTracking(trackingCode)` helper that queries the route-segment DataDocument and returns the matching `shipmentId`s.

2. **Store — flesh out [`src/store/shipments.ts`](../../src/store/shipments.ts):**
   - Trimmed clone of `src/store/order.ts:30`.
   - State: `searchQuery`, `searchFilters` (`status`, `carrierPartyId`, `dateFrom`, `dateThru`), `searchResults: Shipment[]`, `searchTotal`, `pageIndex`, `pageSize` (50), `loading`, `error`.
   - Actions: `runSearch`, `appendNextPage`, `fetchSearchPage`, `toSearchParams`.
   - Getter: `hasMore`.
   - `persist: true`.

3. **View — new `src/views/ShipmentSearch.vue`:**
   - Clone the `OrderSearch.vue` skeleton.
   - Searchbar placeholder: `"Order, tracking code, shipment ID"`.
   - Filters: status (from `useUtilStore().getStatusItemsByType('SHIPMENT_STATUS')`), carrier (party lookup — see "Carrier list" below), ship-date from/thru.
   - Row content: `{{ shipment.id }}` / `{{ shipment.orderId || '—' }} · {{ shipment.trackingCode || '—' }}` / `{{ shipment.status }} · {{ shipment.shipDate }}` with `:router-link="`/shipments/${shipment.id}`"`. Show carrier as `<ion-note slot="end">`.
   - Empty / error states via `EmptyState.vue` / `ErrorState.vue`.

4. **Carrier list.** Two options for the carrier-filter source:
   - **Cheap:** distinct `carrierPartyId`s seen in the current result set (reactive computed). Good enough day one.
   - **Better:** seeded DataDocument `FacilityCarrier` (ENDPOINTS.md § Pre-seeded DataDocuments) — query once at mount, cache in `useUtilStore`.

5. **Route — add to [`src/router/index.ts`](../../src/router/index.ts):**
   - `{ path: '/shipments', name: 'ShipmentSearch', component: ShipmentSearch, beforeEnter: authGuard }`. Insert before the dynamic `/shipments/:shipmentId`.

6. **Menu — add to [`src/components/Menu.vue`](../../src/components/Menu.vue):**
   - New `<ion-menu-toggle>` block with `cubeOutline` icon and `translate("Find shipments")` label, routing to `/shipments`.

7. **Util store warm-up.** Add `fetchStatusItemsByType('SHIPMENT_STATUS')` to the search view's `onMounted`.

8. **Tests.** `src/services/shipment.spec.ts` should cover the query-routing branches in `buildShipmentLookupPayload`, the tracking-fallback path (if option B), and `normalizeShipmentDoc` for the keys we're displaying.

## Don't do

- Don't load packages, route segments, or status history on the search page — detail screen owns those (brief 05).
- Don't introduce print / label / cancel actions — out of scope.
- Don't add a "ship now" affordance even though `poorti/shipments/{id}/ship` exists.

## Done when

- Typing an order ID/name returns its shipments within ~300ms.
- Typing a tracking code returns the matching shipment.
- Status / carrier / date-range filters narrow results.
- Infinite scroll appends pages.
- Tapping a row opens `/shipments/{shipmentId}` (brief 05's view).
- "Find shipments" appears in the sidebar.

## Hand off

- If you took option B (two-step tracking lookup), document the route-segment DataDocument call in `ENDPOINTS.md § Shipments`.
- If the carrier-list source ended up being `FacilityCarrier`, document the util-store fetch pattern so brief 05's detail view can reuse it.
- Note any tracking-code formats observed (carrier prefix patterns) — useful for tightening the query-routing heuristic later.
