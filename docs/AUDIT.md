# Audit — Codex's Scaffold (handoff state)

> What Codex left behind, what's worth keeping, what needs to go. Read this before touching code.

## Verdict at a glance

| Verdict | Files                                                                                                      |
|---------|------------------------------------------------------------------------------------------------------------|
| KEEP    | `src/types/order.ts`, `src/components/AppMenu.vue`, view shells (5 `.vue` under `src/views/`), `src/router/index.ts` (routes only — add login + guard) |
| REWRITE | `src/main.ts`, `src/services/OrderService.ts` (keep field lists + normalizers, drop the gateway/env machinery), `src/store/orders.ts` (drop hardcoded gateway, inject via `@common`) |
| DELETE  | `src/data/orders.ts`, mock gateway, env-var machinery, `vite.config.js` custom envPrefix |
| ADD     | `@common` wiring in `main.ts`, `Login` route + `authGuard`, `store/user.ts`, `store/util.ts`, `.env.example`, `theme/variables.css`, `locales/`, `package.json` deps, `capacitor.config.json`, `manifest.json` |

## src/services/OrderService.ts — 829 lines

Codex chose **the right endpoint**: every remote call goes to `POST oms/dataDocumentView` (verified at lines 528, 538, 611, 616, 621, 626, 631, 641, 662, 671, 684, 693, 711). That's the right hammer for read-heavy screens.

What he **got wrong / didn't finish**:

- **Reinvented the HTTP client.** `createMaargApiClient` (lines ~721–757) builds its own axios setup with custom auth-header logic, instead of using `@common`'s `api` which already handles Bearer token injection, 401 auto-logout, embedded-app context, and base-URL resolution. **Delete and replace.**
- **Invented env vars.** `OrderManagerEnv` interface (lines 58–91) declares `OMS_URL`, `MAARG_URL`, `USERNAME`, `PASSWORD`, and a dual `VITE_*` mirror for each. None of these match accxui conventions — credentials and instance URL come from the runtime Login screen. The `vite.config.js` envPrefix list is contaminated for this. **Delete the env machinery entirely**; use `@common`'s `commonUtil` and cookie-based config.
- ~~Made up `dataDocumentId` values.~~ **Correction (verified live against `dev-maarg`):** every entry in Codex's `defaultDataDocuments` map exists on the dev instance and is indexed to the `oms` ElasticSearch index. The 11 `OrderManager*Lookup` DataDocuments are real and queryable today. Codex got this right. See `docs/swagger/probe-dataDocumentsList.json` for the full seeded list. The only caveat: `OrderManagerCustomerLookup` is thin (just `partyId` + timestamps) and will need either enrichment or a side-call to `oms/parties/{partyId}` to populate the customer view.
- **Mock-vs-remote gateway switch.** `createOrderGatewayFromEnv` (lines ~796–830) picks between mock and remote based on env. Once we're in the accxui pattern this becomes "real or fixture for tests" — the production app should not carry the mock at all. Mocks move to `src/mock/` and are only used by `.spec.ts`.

What's **salvageable** (port these forward into the new services):

- **Field lists** (lines 142–177): `orderLookupFields`, `orderItemLookupFields`, `orderRoleLookupFields`, `orderShipmentLookupFields`, `orderNoteLookupFields`, `noteDataLookupFields`, `orderStatusLookupFields`, `shipmentLookupFields`, `returnLookupFields`, `returnItemLookupFields`, `customerLookupFields`. These describe the columns we want from each DataDocument and they're a reasonable starting cut. **Move to per-domain service files** (e.g. `services/order.ts`, `services/shipment.ts`) under `src/services/`.
- **Payload builders** (lines 258–285): `buildOrderDataDocumentPayload`, etc. The signature pattern (dataDocumentId + customParametersMap + fieldsToSelect + orderByField + pageSize + pageIndex) is correct for the Moqui side. Keep.
- **Normalization helpers** (lines 376–509): `toStringValue`, `toNumberValue`, `firstValue`, `firstDoc`, `allDocs`, `normalizeOrderDoc`, `normalizeOrderItemDoc`, `normalizeShipmentDoc`, `normalizeReturnDoc`, `normalizeCustomerDoc`. These translate the Moqui DataDocument response shape into the typed `Order` / `Shipment` / etc. interfaces. Keep — these are domain logic, not glue.
- **`legacyScreenCoverage` map** (lines 109–140): documents which legacy OFBiz screen each new route replaces. Move into `docs/LEGACY_SCREENS.md` (already captured there) and delete from runtime code.

## src/data/orders.ts

261 lines of fake orders, customers, shipments, returns. **Delete entirely.** Anything we need for tests goes to `src/mock/` as named fixtures.

## src/types/order.ts — 84 lines

Clean domain interfaces. Keep all of them:

- `Order` — id, externalId, orderDate, status, customerId, channel, total, currency, paymentStatus, fulfillmentStatus, deliveryMethod, priority, items, shipmentIds, returnIds, notes, history
- `OrderItem` — id, sku, name, quantity, status, facility, unitPrice
- `Shipment` — id, orderId, status, carrier, trackingCode, origin, destination, shipDate, itemIds, packages
- `ReturnRecord` — id, orderId, status, reason, requestedDate, itemIds, refundTotal
- `Customer` — id, name, email, phone, loyaltyTier, lifetimeOrders, lifetimeValue, addresses

Add `Address` as its own interface (inferred from usage today but undeclared). Add enums or string-literal types for the status fields once we know the Moqui enum IDs (see [ENDPOINTS.md § lookups](ENDPOINTS.md#lookups-for-dropdowns--facets)).

## src/store/orders.ts — 193 lines + .spec.ts — 184 lines

State: `query`, `status`, `channel`, `allOrders`, `orderList`, `shipmentList`, `returnList`, `customerList`, `total`, `loading`.

Actions: `loadWorkflowData` (batch), `searchOrders`, `loadOrder`, `loadCustomerOrders`, `loadCustomer`, `loadShipment`, `loadReturn`.

Getters: `getOrder`, `getCustomer`, `getShipment`, `getReturn`, `getOrderShipments`, `getOrderReturns`, `getCustomerOrders`, `filteredOrders`, `statuses`, `channels`, `openWork`.

**Salvageable:**
- The `upsertById` cache-merge pattern (lines 8–15) — keep it; it correctly handles "list endpoint returned a shallow record, detail endpoint upgrades it".
- The lazy-load pattern (detail-route loads, then promotes the cached shallow record).
- The search composition for query/status/channel.
- The spec (5 tests) — port to the new store layout. The behaviors they assert are still correct.

**Rewrite:**
- Hardcoded gateway instantiation at the top of the file. Replace with per-domain Pinia stores (`useOrderStore`, `useShipmentStore`, `useReturnStore`, `useCustomerStore`) that each call `api(...)` directly. There's no need for an `OrderGateway` abstraction once we're on `@common/api`.

**Add:**
- `persist: true` (mirrors job-manager's `pinia-plugin-persistedstate` usage).
- `fetchStatus` state per action so views can show loading / error correctly.

## src/views/ — 5 files

All five views render. None call real endpoints; they all read from `useOrdersStore` which proxies to the mock gateway today.

- `OrderSearch.vue` (104 lines) — searchbar + status / channel selects + result list. Infinite scroll is a stub. **Keep the layout, replace data source.**
- `OrderDetail.vue` (186 lines) — accordion with Items / Shipments / Returns / Activity sections. Lazy-loads order + customer on mount. **Keep layout. Add actions** (cancel, send confirmation email, add note, etc. — see [LEGACY_SCREENS.md § OrderHeaderView](LEGACY_SCREENS.md#orderheaderview)).
- `ShipmentDetail.vue` (119 lines) — header + items + packages. **Keep layout. Wire to `poorti/shipments/{id}` + route segments.**
- `ReturnDetail.vue` (110 lines) — header + return items. **Keep layout. Add status history.**
- `CustomerDetail.vue` (117 lines) — profile + addresses + order history. **Keep layout. Add `partyContactMechs` fetch.**

None of the views have edit actions wired. That's all migration scope (see briefs 03–07).

## src/components/AppMenu.vue — 60 lines

Sidebar with "Find order" link and dynamic open-work shortcuts. Layout is fine; **add** user profile section, logout button, version banner, settings link — mirror `apps/job-manager/src/components/Menu.vue`.

## src/router/index.ts — 48 lines

Five routes covering the five legacy screens. Missing: `/login` route, `beforeEnter: authGuard` on every protected route, `meta.permissionId` for permission gating, 404 fallback. **Add these (see [CONVENTIONS.md § Router](CONVENTIONS.md#router-conventions)).**

## src/main.ts — 22 lines

Bootstraps Pinia + router + Ionic. Missing: `initialiseConfig` from `@common`, `createDxpI18n`, `pinia-plugin-persistedstate`, logger, theme imports. **Replace wholesale** with the job-manager pattern (see [CONVENTIONS.md § main.ts](CONVENTIONS.md#maints--the-wiring-template)).

## Config files

| File              | Issue                                                                                                                                                                                  | Fix |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----|
| `package.json`    | Missing `@common` (workspace ref), `@hotwax/app-version-info`, `@casl/ability`, `pinia-plugin-persistedstate`, `@vitejs/plugin-legacy`, `@capacitor/*`, `vue-i18n`, `vue-logger-plugin`, `mitt`, `qs`, `luxon`, etc. Missing `cypress` and `test:e2e` script. | Copy `apps/job-manager/package.json` as a base, set `name: order-manager`. |
| `vite.config.js`  | Contaminated `envPrefix` list (`'USERNAME', 'PASSWORD', 'OMS_URL', ...`). Missing `@common` alias, `@vitejs/plugin-legacy`, `dedupe: ['vue', 'pinia']`, vitest config. | Copy `apps/job-manager/vite.config.js`. |
| `tsconfig.json`   | Missing `@common` path alias, `importHelpers`, expanded `lib`, `exclude: ["node_modules"]`. | Copy `apps/job-manager/tsconfig.json`. |
| `ionic.config.json` | Just `{"name": "Order Manager", "integrations": {}, "type": "vue-vite"}` — fine but add `appId` for native builds. | Add `"appId": "co.hotwax.ordermanager"`. |
| `index.html`      | No PWA meta, no manifest link, no version comment. | Copy from job-manager. |
| (missing) `capacitor.config.json` | n/a | Add for parity with siblings. |
| (missing) `.env.example` | n/a | Add — see [CONVENTIONS.md § Environment variables](CONVENTIONS.md#environment-variables). |
| (missing) `manifest.json` | n/a | Add for PWA. |
| (missing) `src/theme/variables.css` | n/a | Add — mirror job-manager. |
| (missing) `src/locales/*` | n/a | Add `en-US.json`. |
| (missing) `src/store/user.ts` and `src/store/util.ts` | n/a | Mirror job-manager. |

## Special note on the workspace location

`/Users/adityapatel/Documents/GitHub/accxui/apps/order-manager` is a **symlink** to `/Users/adityapatel/Documents/GitHub/orders manager/`. The latter is the real directory — once we run `git init` there, it becomes the app's own git repo, mirroring how sibling apps are organized. No git tracking yet.
