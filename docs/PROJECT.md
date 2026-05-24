# Order Manager Migration — Project Brief

> Read this first. Every other doc assumes you have read this.

## What we're building

We are migrating the **Order Manager / Customer Service** user role from the legacy OFBiz screens in `hotwax-oms` to a new Ionic + Vue 3 + Pinia app that lives inside the **accxui monorepo** alongside `job-manager`, `transfers`, `fulfillment`, `bopis`, etc.

The app being built is at: `/Users/adityapatel/Documents/GitHub/accxui/apps/order-manager/`

(`/Users/adityapatel/Documents/GitHub/accxui/apps/order-manager` is a **symlink** to `/Users/adityapatel/Documents/GitHub/orders manager/`. The latter is the real directory and will become its own git repo, mirroring how sibling apps `job-manager`, `transfers`, etc. are each their own repos symlinked into `accxui/apps/`.)

The legacy app being replaced is at: `/Users/adityapatel/Documents/GitHub/hotwax-oms/` (OFBiz). The five entry-point screens to replace are documented in [LEGACY_SCREENS.md](LEGACY_SCREENS.md).

When complete, an Order Manager / Customer Service rep should never need to log in to OFBiz for their daily work.

## Hard constraints

These are non-negotiable. Violating any of these is a regression — flag it and ask, do not silently work around it.

1. **Moqui-only backend.** The new app must consume only Moqui-served endpoints: `oms/*` (from `hotwax-oms` Moqui side), `poorti/*` (from `hotwax-poorti`), `admin/*` and `api/*` (from `hotwax-maarg-util`). See [ENDPOINTS.md](ENDPOINTS.md) for the verified catalog. **The single exception is `/login`** — see "Login flow" below.
2. **Use the shared `@common` workspace.** All cross-app concerns — login UI, auth composable, axios client, i18n, theme, cookie helpers, embedded-app store — come from `accxui/common/`. Do not reinvent these in this app.
3. **Login flow matches `job-manager` exactly.** Same component (`@common/components/Login.vue`), same composable (`@common/composables/useAuth.ts`), same `initialiseConfig` wiring in `main.ts`, same `authGuard` in the router. See [CONVENTIONS.md § Login flow](CONVENTIONS.md#login-flow).
4. **No mock data in production paths.** The current `src/data/orders.ts` and the mock branch of `OrderService` are throwaway and must be removed once real endpoints are wired up. Mocks belong under `src/mock/` and are only used in tests or behind explicit fixture flags (see how `job-manager` does it in `src/mock/`).
5. **No new HTTP client.** All API calls go through `api` (default export from `@common`). It already handles base URL resolution (`commonUtil.getMaargURL()` vs `commonUtil.getOmsURL()`), the Bearer token header, the 401 auto-logout, and embedded-app context.
6. **No `import.meta.env.OMS_URL` / `USERNAME` / `PASSWORD`.** The current `vite.config.js` envPrefix list (`'USERNAME', 'PASSWORD', 'OMS_URL', ...`) is wrong for this stack — credentials are entered by the user at the Login screen, OMS instance comes from the user's input and is stored in cookies. Remove these. Use only `VITE_*` env vars matching `job-manager/.env.example`.

## Stack & versions

- **Monorepo:** pnpm workspaces, root at `/Users/adityapatel/Documents/GitHub/accxui/`
- **Build:** Vite 5
- **Framework:** Vue 3, Ionic 7 (Vue), `@ionic/vue-router`
- **State:** Pinia + `pinia-plugin-persistedstate`
- **HTTP:** axios via `@common/core/remoteApi.ts`
- **i18n:** `vue-i18n` via `createDxpI18n` from `@common`
- **Shared package:** `@common` aliased to `../../common` in `vite.config.js` and `tsconfig.json`
- **Capacitor:** v6.x (matches sibling apps)

## What is currently in the app (state as of handoff)

Codex scaffolded a stand-alone Vue+Ionic+Pinia app **without integrating it into the accxui workspace patterns**. The five legacy screens exist as Vue views but render mock data only. There is no login screen, no router guard, no `@common` integration, no real HTTP calls. See [AUDIT.md](AUDIT.md) for a file-by-file verdict.

The salvageable pieces from Codex's work are:
- The list of **DataDocument field IDs** in `src/services/OrderService.ts` (`orderLookupFields`, `shipmentLookupFields`, `returnLookupFields`, etc.) — these capture the shape of what we want to read from Moqui.
- The **screen-to-route mapping** in `legacyScreenCoverage`.
- The **normalization helpers** for fanning out a DataDocument response into typed `Order` / `Shipment` / `Return` / `Customer` objects.

Everything else (mock gateway, `data/orders.ts`, ad-hoc env vars, the standalone `vite.config.js` envPrefix) is throwaway.

## How this work is parallelized

The migration is split into independent streams, each with a brief in `docs/briefs/`. A fresh agent should be able to read **PROJECT.md + CONVENTIONS.md + the one brief they own + the relevant section of LEGACY_SCREENS.md and ENDPOINTS.md** and get to work.

| Brief                                                | Owner stream            | Depends on        |
|------------------------------------------------------|-------------------------|-------------------|
| [00-scaffold.md](briefs/00-scaffold.md)              | Wire app into accxui    | —                 |
| [01-auth.md](briefs/01-auth.md)                      | Login + permissions     | 00                |
| [02-app-shell.md](briefs/02-app-shell.md)            | Router, menu, layout    | 00, 01            |
| [03-find-order.md](briefs/03-find-order.md)          | Order search screen     | 00, 01, 02        |
| [04-view-order.md](briefs/04-view-order.md)          | Order detail screen     | 00, 01, 02        |
| [05-view-shipment.md](briefs/05-view-shipment.md)    | Shipment detail screen  | 00, 01, 02        |
| [06-view-return.md](briefs/06-view-return.md)        | Return detail screen    | 00, 01, 02        |
| [07-view-customer.md](briefs/07-view-customer.md)    | Customer profile screen | 00, 01, 02        |
| [08-find-returns.md](briefs/08-find-returns.md)      | Returns search screen   | 00, 01, 02, 06    |
| [09-find-customers.md](briefs/09-find-customers.md)  | Customers search screen | 00, 01, 02, 07    |
| [10-find-shipments.md](briefs/10-find-shipments.md)  | Shipments search screen | 00, 01, 02, 05    |

Briefs 03–07 are independent of each other and can run in parallel once 00–02 land. Briefs 08–10 each depend on their corresponding detail brief (so the search row's tap target exists), but are independent of each other.

## Definition of done

The app is "done" for the Order Manager role when all of the following are true:

- A user can log in via the standard accxui Login screen (OMS URL → username/password) and reach `/orders`.
- The five legacy entry-point screens (find / view order / view shipment / view return / view customer) render real data from Moqui endpoints, with the section coverage listed in [LEGACY_SCREENS.md](LEGACY_SCREENS.md).
- Sidebar entry points exist for **Find returns**, **Find customers**, and **Find shipments** (briefs 08–10), each backed by real Moqui search and linking into the corresponding detail screen.
- Every user action listed in `LEGACY_SCREENS.md` either works or is explicitly documented as out-of-scope with a follow-up issue.
- Permissions gate the same actions the legacy app gated (see `LEGACY_SCREENS.md § Permissions`).
- Build passes `pnpm --filter order-manager build` from the accxui root.
- No `OrderGateway`, `data/orders.ts`, mock-data fallback, or `OMS_URL` / `USERNAME` / `PASSWORD` env vars remain in the codebase.

## Where to look when stuck

- **API shape uncertain?** → `/Users/adityapatel/Documents/GitHub/oms/service/oms.rest.xml`, `/Users/adityapatel/Documents/GitHub/hotwax-poorti/service/poorti.rest.xml`, `/Users/adityapatel/Documents/GitHub/hotwax-maarg-util/service/admin.rest.xml`. Catalog in [ENDPOINTS.md](ENDPOINTS.md).
- **Convention uncertain?** → Copy from `accxui/apps/job-manager/`. It's the most-recent reference.
- **Legacy behavior uncertain?** → `hotwax-oms/applications/order/widget/ordermgr/OrderViewScreens.xml`. Catalog in [LEGACY_SCREENS.md](LEGACY_SCREENS.md).
- **Auth uncertain?** → `accxui/common/composables/useAuth.ts` and `accxui/common/components/Login.vue`.
