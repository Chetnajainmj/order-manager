# Brief 01 — Auth + user store

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`. Brief 00 must be complete.

## Goal

A user can log in via the standard accxui Login UI and the app holds their profile + permissions. Protected routes redirect to `/login` when unauthenticated. Logout works.

## Inputs

- Login UI: `accxui/common/components/Login.vue` (already exists, do not modify).
- Auth composable: `accxui/common/composables/useAuth.ts` (already exists). Login sequence documented in `../CONVENTIONS.md § Login flow`.
- Reference user store: `accxui/apps/job-manager/src/store/user.ts` (310 lines, copy-then-edit).
- Reference router: `accxui/apps/job-manager/src/router/index.ts:38-42` for the `authGuard`.
- Endpoints catalog: `../ENDPOINTS.md § Auth`.

## Tasks

1. **Create `src/store/user.ts`.** Copy from job-manager, then:
   - Trim job-manager-specific actions: `fetchShopifyConfig`, `setCurrentShopifyConfig`, `currentShopifyConfig`. Leave `shopifyConfigs` in state if the order-manager role doesn't need it.
   - Keep: `current`, `permissions`, `currentProductStore`, `timeZones`, `oms`, `pwaState`, `fetchStatus`.
   - Keep actions: `fetchUserProfile`, `fetchPermissions`, `fetchProductStores`, `fetchProductStorePreference`, `setCurrentProductStore`, `setUserTimeZone`, `fetchAvailableTimeZones`, `postLogin`, `postLogout`, `updatePwaState`.
   - Keep getter `hasPermission` (the OR/AND parser).
   - Set `persist: true` at the bottom.

2. **Pick the app-gate permission.** Today most accxui apps use a `*_APP_VIEW` permission as the umbrella. Pick `ORDERMGR_VIEW` (matches the legacy menu gate). Set `VITE_APP_PERMISSION_ID=ORDERMGR_VIEW` in `.env.example`. The `fetchPermissions` action will refuse login if the user lacks this — that's the desired UX.

3. **Verify the permission IDs exist server-side.** Hit `GET admin/groups` and `GET admin/permissions` against a known instance to confirm `ORDERMGR_VIEW` etc. exist. If they don't, document the actual permission ID for "view orders" and update the env var + brief.

4. **Update `src/router/index.ts`:**
   - Import `Login from '@common/components/Login.vue'`, `useAuth from '@common/composables/useAuth'`, `useUserStore from '@/store/user'`, `showToast from '@/utils'`, `translate from '@common'`.
   - Add a non-guarded `/login` route.
   - Add `beforeEnter: authGuard` to **every** existing route (the five legacy-screen routes + the redirect at `/`).
   - Add the global `router.beforeEach` permission check (job-manager pattern, lines 246–258).
   - Add per-route `meta: { permissionId: 'ORDERMGR_VIEW' }` on order routes, `'FACILITY_VIEW'` on shipment routes, `'PARTYMGR_VIEW'` on customer routes (or the real IDs from step 3).

5. **Verify `main.ts`** still calls `initialiseConfig({ postLogin: useUserStore().postLogin, postLogout: useUserStore().postLogout, ... })` — brief 00 should have wired this. Without it, `useAuth().login()` won't trigger profile fetch.

6. **Add a logout entry point.** Wherever the app menu lives (still `src/components/AppMenu.vue` at this stage), add a logout button that calls `useAuth().logout()`. The composable handles the redirect.

7. **Smoke test:**
   - Boot the dev server.
   - Visit `/` → should redirect to `/login`.
   - Enter an OMS instance (e.g. `myinstance`) → submit.
   - Enter username + password → submit.
   - Expect: token in cookies, `/orders` reachable, `useUserStore().current.userId` populated, `useUserStore().permissions` populated, `useUserStore().hasPermission('ORDERMGR_VIEW')` returns `true`.
   - Logout button clears cookies and returns to `/login`.

## Don't do

- **Don't modify `@common/composables/useAuth.ts` or `@common/components/Login.vue`.** These are shared across apps. If something looks broken there, escalate.
- Don't add a custom login form. Use `@common/components/Login.vue`.
- Don't store tokens anywhere other than via `useAuth` (cookies).
- Don't bypass `authGuard` for "convenience" during development.

## Done when

- Logging in works against a real Hotwax instance.
- Refreshing the browser keeps the session (cookies + Pinia persist).
- Logging out clears everything.
- Visiting any protected route while logged out redirects to `/login`.
- A user without `ORDERMGR_VIEW` is shown the "You do not have permission to access the app" toast and is not let in.

## Hand off

Document any permission ID deltas vs. the legacy app at the bottom of `LEGACY_SCREENS.md § Permissions to mirror`.
