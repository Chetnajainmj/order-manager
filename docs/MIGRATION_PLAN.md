# Migration Plan

> Sequenced phases for taking the scaffold to a shippable Order Manager app. Each phase has a clear "done" definition that the next phase depends on.

## Phase 0 — Workspace integration (brief 00)

**Goal:** the app builds inside the accxui monorepo, with `@common` resolved.

- Move/confirm the app at `accxui/apps/order-manager/`.
- Replace `package.json` with the job-manager template (rename to `order-manager`).
- Replace `vite.config.js`, `tsconfig.json`, `ionic.config.json` with job-manager equivalents.
- Add `.env.example`, `capacitor.config.json`, `manifest.json`, `src/theme/variables.css`, `src/locales/en-US.json`, `src/shims-vue.d.ts`, `src/vite-env.d.ts`.
- `pnpm install` at the accxui root.
- `pnpm --filter order-manager build` produces a `dist/`.

**Done when:** `pnpm --filter order-manager dev` boots a blank page that imports `@common` without resolver errors.

## Phase 1 — Auth + user store (brief 01)

**Goal:** a user can log in via the standard accxui Login UI and the app holds their profile + permissions.

- Add `src/store/user.ts` mirroring `apps/job-manager/src/store/user.ts` (adapt `VITE_APP_PERMISSION_ID` to `ORDERMGR_VIEW` or similar).
- Add `src/store/util.ts` for shared lookups (status enums, facilities, product stores, etc.).
- Wire `main.ts` with `initialiseConfig({ postLogin: useUserStore().postLogin, postLogout: useUserStore().postLogout, ... })`.
- Add `Login` import from `@common/components/Login.vue` and a `/login` route.
- Add `authGuard` `beforeEnter` to every existing protected route.
- Add a global `router.beforeEach` for `meta.permissionId` checks.

**Done when:** opening the app at `/` redirects to `/login`; entering OMS + creds reaches `/orders`; logging out clears the session and returns to `/login`.

## Phase 2 — App shell + theme (brief 02)

**Goal:** a polished shell users actually want to look at.

- Replace `AppMenu.vue` with a sidebar mirroring `apps/job-manager/src/components/Menu.vue`: app logo, user profile, store selector, navigation links, settings, logout, version banner.
- Add a Settings view (`views/Settings.vue`) with: current OMS, current user, timezone selector, language selector, logout button.
- Wire `theme/variables.css` and import `@common/css/theme.css` + `@common/css/settings.css` in `main.ts`.
- Add empty-state / error / loading components matching the accxui look.

**Done when:** the app looks like a sibling of job-manager and has working settings + logout.

## Phase 3 — Find Order (brief 03)

**Goal:** real order search.

- Determine the search strategy:
  - **Option A (preferred):** seed an `OrderManagerOrderLookup` DataDocument on the OMS side (see `data/*.xml` patterns in `/Users/adityapatel/Documents/GitHub/oms/data/`) that joins `OrderHeader`, primary `Party`, `ProductStore`, and the status item description. Then call `POST oms/dataDocumentView`.
  - **Option B (fallback):** `GET oms/orders` (entity-listing) with `params: { orderTypeId: 'SALES_ORDER', orderDate_op: '...', statusId, ... }` and fan out to `oms/parties` for customer name. Slower (N+1) but works without a new DataDocument.
- Wire `OrderSearch.vue` to the chosen path. Use existing `buildOrderDataDocumentPayload` shape if going with A.
- Implement infinite scroll using `pageIndex` / `pageSize`.
- Add a filter panel for status, channel, product store, date range.

**Done when:** typing into the searchbar yields real orders within ~300ms; status / channel / date filters work; navigating to a result opens the order detail.

## Phase 4 — View Order (brief 04)

**Goal:** the rich order detail screen.

- Replace stub data with `GET oms/orders/{orderId}` (the `OrderServices.get#SalesOrder` deep fetch — see `oms.rest.xml:36-38`). Confirm what fields it returns; supplement with side calls as needed:
  - `GET oms/orders/{orderId}/items`, `…/shipGroups`, `…/status` (history), `…/attributes`
  - `GET oms/communicationEvents?orderId=...` for email history
  - `GET oms/parties/{customerPartyId}` for customer block
  - `GET oms/dataDocumentView` with `OrderNote` lookup for notes
- Wire the accordion sections (Items / Shipments / Returns / Activity) to real data. Add the legacy sections we're not rendering yet: Payment Info, Contact Info, Sales Reps, Order Roles, Order Terms.
- Implement actions per [LEGACY_SCREENS.md § OrderHeaderView](LEGACY_SCREENS.md#orderheaderview-view-order):
  - Add note → `POST` on `OrderNote` entity
  - Cancel item → `POST oms/orders/{orderId}/items/{seq}/cancel`
  - Reject item → `POST oms/orders/{orderId}/items/{seq}/reject`
  - Send confirmation / completion email → `POST oms/orders/sendEmailNotification`
  - Change status → status-flow transition service (confirm name)
- Gate each action by `useUserStore().hasPermission(...)`.

**Done when:** the detail page reproduces every section listed in LEGACY_SCREENS.md and the in-scope actions execute against the real backend.

## Phase 5 — View Shipment (brief 05)

**Goal:** real shipment detail.

- Primary call: `GET poorti/shipments?shipmentId=...` (or single-resource if available; verify against `poorti.rest.xml`).
- Side calls: `…/shipmentPackages`, `…/statusHistory`, plus `poorti/orderShipmentAndRouteSegments` if useful (designed for customer-service views).
- Render: header, items, packages, route segments. Add the receipts panel if data is present.
- Read-only actions only in this phase (edit / split shipment is out of scope).

**Done when:** clicking a shipment link from the order detail loads the real shipment with packages and tracking.

## Phase 6 — View Return (brief 06)

**Goal:** real return detail.

- Primary call: `GET oms/returns?returnId=...` (entity list with masterName=default). If it returns thin data, supplement with `POST oms/dataDocumentView` against a `ReturnHeaderAndItem` DataDocument (seed if needed).
- Side calls: status history, return-item changes (lookups for ReturnTypeHistory, ReturnReasonHistory, etc. if we choose to surface them — defer if low value).
- Read-only actions in this phase.

**Done when:** the return detail mirrors the OFBiz screen's data, including return items with reason / type / qty / price.

## Phase 7 — View Customer (brief 07)

**Goal:** real customer profile.

- Primary calls: `GET oms/parties/{partyId}`, `GET oms/partyContactMechs?partyId=...`.
- Customer-orders panel: `POST oms/dataDocumentView` with the order DataDocument scoped to `customerPartyId=partyId`.
- Render: name, contact mechs (email/phone/postal), addresses, recent orders, optional roles & relationships sections.

**Done when:** clicking a customer from order detail loads their profile and order history.

## Phase 8 — Search expansion (briefs 08, 09, 10)

**Goal:** the menu has dedicated search entry points for returns, customers, and shipments — not just orders.

Three independent screens, each cloning the OrderSearch pattern from Phase 3:

- **Find Returns** (brief 08) — `/returns` list backed by `OrderManagerReturnLookup`. Query-routes order-name / return-ID / customer-name. Filters: status, date range, product store.
- **Find Customers** (brief 09) — `/customers` list. Primary path is `GET oms/parties` with `firstName / lastName / groupName` filters; falls back to a new enriched DataDocument if row content is too sparse. Filters: status, party type.
- **Find Shipments** (brief 10) — `/shipments` list backed by `OrderManagerShipmentLookup`. Query-routes order-ID / shipment-ID / tracking code (with a two-step fallback through `ShipmentRouteAndPackageRouteSegment` if `trackingIdNumber` isn't in the primary join). Filters: status, carrier, ship-date range.

Each phase 8 brief plugs into the existing detail route from its sibling detail brief (06 / 07 / 05) — no detail-view work needed.

**Done when:** all three search screens are reachable from the sidebar, return real results within ~300ms of typing, and tapping a row opens the corresponding detail view.

## Phase 9 — Polish & ship

- Hook up `@hotwax/app-version-info` for the version banner.
- Add ESLint + lint-pass.
- Add unit tests for the per-domain services (carry over the spec coverage Codex had for the gateway).
- Confirm permission gating end-to-end.
- Add the order-manager to `accxui/launchpad` if applicable.
- Tag a release.

**Done when:** Definition-of-done bullet list in [PROJECT.md](PROJECT.md#definition-of-done) is satisfied.

## Risk register

| Risk                                                                                 | Mitigation                                                                                          |
|--------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| Required DataDocuments don't exist server-side                                       | Each brief calls out the DataDocument it needs; check seeded `data/*.xml` first, then seed via PR.   |
| The OFBiz screens have hidden behaviors not in the XML (Groovy logic)                | When in doubt, read the corresponding `.groovy` script in `hotwax-oms/applications/.../groovy/`.     |
| `OrderServices.get#SalesOrder` doesn't return everything the OFBiz screen rendered   | Confirm the response shape in a smoke test first; supplement with explicit side calls.               |
| Permission IDs differ between Moqui and OFBiz                                        | List actual permission IDs via `GET admin/groups`; document the mapping in `briefs/01-auth.md`.      |
| Hardlink confusion between the two paths                                              | Treat `accxui/apps/order-manager/` as canonical; mention the hardlink in PR descriptions.            |
