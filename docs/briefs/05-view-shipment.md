# Brief 05 — View Shipment

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`, `../ENDPOINTS.md § Shipments`, `../LEGACY_SCREENS.md § ViewShipment`. Briefs 00–02 must be complete. Coordinates well with brief 04 (which provides cross-link entry points).

## Goal

Replace the mock shipment detail with a real, read-only view of the shipment: header, items, packages, route segments, status history. Match the section coverage in `LEGACY_SCREENS.md § ViewShipment`.

## Inputs

- Current view: `src/views/ShipmentDetail.vue` (119 lines). Layout reusable.
- Endpoints: `../ENDPOINTS.md § Shipments (poorti.rest.xml)`. Note `poorti/orderShipmentAndRouteSegments` is built specifically for customer-service views.

## Architecture

| Section             | Endpoint                                                                                                          |
|---------------------|-------------------------------------------------------------------------------------------------------------------|
| Header              | `POST oms/dataDocumentView` with `dataDocumentId=OrderManagerShipmentLookup`, `customParametersMap.shipmentId={id}` (DD is seeded; live-verified keys: `shipmentId, primaryOrderId, statusId, carrierPartyId, originFacilityId, createdDate`) |
| Items               | `POST oms/dataDocumentView` with `OrderManagerOrderShipmentLookup`, `customParametersMap.shipmentId={id}` — gives item-level rows joined with order info |
| Packages            | `GET poorti/shipments/{shipmentId}/shipmentPackages` (entity-list, swagger-documented)                            |
| Package contents    | `GET poorti/shipments/{shipmentId}/shipmentPackageContents`                                                       |
| Route segments      | `GET poorti/orderShipmentAndRouteSegments?shipmentId={id}` — purpose-built view for customer-service screens      |
| Status history      | `GET poorti/shipments/{shipmentId}/statusHistory`                                                                 |
| Origin / destination facility | `GET admin/facilities/{facilityId}` (separate call once per facility seen)                              |
| Print artifacts     | `GET poorti/Picklist.pdf?shipmentId={id}` / `PackingSlip.pdf` / `Label.pdf` / `Manifest.pdf` (defer; not in scope for read-only view) |

## Tasks

1. **`src/services/shipment.ts`:**
   - `getShipment(shipmentId)` — header + items.
   - `getShipmentPackages(shipmentId)`.
   - `getShipmentRouteSegments(shipmentId)` (uses `poorti/orderShipmentAndRouteSegments`).
   - `getShipmentStatusHistory(shipmentId)`.
   - Normalizers (carry forward `normalizeShipmentDoc` from the existing `OrderService.ts`).

2. **`src/store/shipment.ts`** (Pinia store):
   - State: `cache: Record<string, Shipment>`, `packagesByShipment`, `routesByShipment`, `statusHistoryByShipment`, `fetchStatus`.
   - Action `loadShipment(shipmentId)` — orchestrates parallel fetches and writes to state.

3. **Extend `src/types/order.ts`:**
   - Flesh out `Shipment` with: `shipmentTypeId`, `originFacilityId`, `originFacilityName`, `destinationFacilityId`, `destinationFacilityName`, `estimatedShipDate`, `latestCancelDate`, `createdDate`.
   - Add `ShipmentPackage`, `ShipmentRouteSegment`, `ShipmentStatusChange`.

4. **Rebuild `views/ShipmentDetail.vue`:**
   - Header card (shipment ID, type, status, origin facility → destination facility, ship date, ETA).
   - Items list (per item: product, qty, dimensions).
   - Packages list (per package: package ID, dimensions, weight, tracking number, carrier, link to carrier party).
   - Route segments (per segment: carrier, method, tracking code, status, est. ship / arrival dates).
   - Status history accordion.
   - "Back to order" link if `primaryOrderId` is present.

5. **Cross-links:** Each item row → its order's item. The order link goes to `/orders/{primaryOrderId}` (Brief 04).

6. **Permission gate.** Use `meta: { permissionId: 'FACILITY_VIEW' }` (or its real Moqui equivalent — confirm).

7. **Tests.** Normalization unit tests; component test for the loading skeleton + error states.

## Out of scope (defer)

- Editing shipment header
- Adding / removing items
- Repacking / re-routing
- Generating new tracking labels
- Printing picklist / packing slip / label / manifest (the `poorti/*.pdf` endpoints exist; defer to a later UX pass)

## Done when

- `/shipments/{realId}` renders all sections with real data from `poorti/*`.
- Tracking numbers (if present) are clickable as carrier links (use `useUtilStore()` lookup for carrier tracking URL templates if available, else show as text).
- "Back to order" navigates correctly.

## Hand off

Note any data gaps (e.g. "destination facility name not returned by the shipments endpoint; had to side-call admin/facilities").

Implemented locally without a git commit per instruction. Shipment detail now has `src/services/shipment.ts`, `src/store/shipment.ts`, and a read-only Ionic detail view backed by DataDocument shipment header/items plus poorti package, package-content, route-segment, and status-history calls. App-level and route-level permission gates remain intentionally omitted per user direction.

Data gaps/deferred: facility names are rendered only when returned by the shipment payload; no separate `admin/facilities/{facilityId}` enrichment was added yet. Print artifacts, edits, repacking, and re-routing remain out of scope. Browser auth redirected to `/login` in the DevTools smoke, so live authenticated shipment data rendering was verified by build/tests and route availability, not by a full authenticated browser pass.
