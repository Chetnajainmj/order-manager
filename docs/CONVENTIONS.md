# Accxui App Conventions

> What every accxui app does the same way. Copy the patterns; do not invent new ones.
> Canonical reference: `/Users/adityapatel/Documents/GitHub/accxui/apps/job-manager/`.

## Where this app lives

- **Canonical path:** `/Users/adityapatel/Documents/GitHub/accxui/apps/order-manager/`
- **Workspace root:** `/Users/adityapatel/Documents/GitHub/accxui/` (pnpm workspaces)
- **Shared package:** `/Users/adityapatel/Documents/GitHub/accxui/common/` aliased as `@common`
- **Sibling reference apps:** `apps/job-manager` (newest), `apps/transfers`, `apps/fulfillment`, `apps/bopis`, `apps/receiving`, `apps/available-to-promise`
- **Run from the workspace root:** `pnpm --filter order-manager dev` / `pnpm --filter order-manager build`

## Folder structure (mirror job-manager)

```
src/
  assets/            # images, fonts
  components/        # reusable Vue components specific to this app
  composables/       # Vue composables (useFoo.ts)
  event-bus/         # mitt emitter wrapper (or use @common emitter)
  locales/           # i18n message JSON per locale
  logger/            # vue-logger-plugin setup (or use @common logger)
  mock/              # fixtures used ONLY by tests / explicit fixture mode
  router/index.ts    # Ionic vue-router routes + authGuard
  store/             # Pinia stores: user.ts, util.ts, order.ts, shipment.ts, etc.
  theme/variables.css
  types/             # TS interfaces shared across features
  utils/             # showToast, helpers
  views/             # one Vue file per route
  App.vue
  main.ts
  shims-vue.d.ts
  vite-env.d.ts
```

Naming: PascalCase for `.vue` and `.ts` files that export components / stores / composables; camelCase for utility modules.

## main.ts — the wiring template

Copy `apps/job-manager/src/main.ts` (verified at lines 1–62). Key points:

1. Create Pinia with `pinia-plugin-persistedstate`.
2. Create i18n via `createDxpI18n(localeMessages)` from `@common`.
3. Install Ionic with `mode: 'md'` and `innerHTMLTemplatesEnabled: true`.
4. Install logger, i18n, pinia, router, in that order.
5. Call `initialiseConfig({ postLogin, postLogout, oms getter/setter, current getter/setter, router })` from `@common`. This is what `useAuth.login()` calls back into.
6. Mount only after `router.isReady()`.

## Login flow (exactly as job-manager / transfers)

Verified files:
- Login UI: `/Users/adityapatel/Documents/GitHub/accxui/common/components/Login.vue`
- Auth composable: `/Users/adityapatel/Documents/GitHub/accxui/common/composables/useAuth.ts`
- HTTP client + interceptors: `/Users/adityapatel/Documents/GitHub/accxui/common/core/remoteApi.ts`
- URL helpers: `/Users/adityapatel/Documents/GitHub/accxui/common/utils/commonUtil.ts` (lines 360, 373)

Login sequence (from `useAuth.ts` lines 75–117):

1. User lands on `/login`. The Login screen first prompts for the **OMS instance URL** (e.g. `myinstance` → expanded to `https://myinstance.hotwax.io/api/`). The instance is stored in cookie key `oms`.
2. `useAuth().fetchLoginOptions()` calls `GET checkLoginOptions` on the OMS base URL — returns SSO config + `maargInstanceUrl` (the Moqui base URL). Stored in cookie `maarg`.
3. User submits username + password. `useAuth().login(username, password)` calls:
   ```
   POST {OMS_URL}/login
   body: { USERNAME, PASSWORD }
   ```
   This is **the one OFBiz endpoint** we are allowed to call. It returns `{ token, expirationTime }`.
4. Token + expiration are stored in cookies. On every subsequent `api(...)` call, `requestInterceptor` (remoteApi.ts:8–31) injects `Authorization: Bearer <token>` and validates `isAuthenticated`.
5. `accxuiConfig.value.postLogin()` runs — i.e. the app's user store fetches profile, permissions, etc.
6. The router's `authGuard` (vue-router `beforeEnter`) redirects to `/login` if `useAuth().isAuthenticated.value` is false.

After login, every Moqui call goes to `commonUtil.getMaargURL()` (default), every legacy OMS-side call goes to `commonUtil.getOmsURL()` via `baseURL` override. The `api()` function (remoteApi.ts:110) defaults to Maarg.

## Pinia user store template (mirror job-manager)

Pattern in `apps/job-manager/src/store/user.ts:9–310`:

- State: `current`, `permissions`, `currentProductStore`, `timeZones`, `oms`, `fetchStatus`
- Getter `hasPermission(permissionId)` — supports `' AND '` and `' OR '` strings
- Actions:
  - `fetchUserProfile()` → `GET admin/user/profile` (maarg base URL)
  - `fetchPermissions()` → paginated `POST getPermissions` on OMS base URL (note: this is one place OFBiz `getPermissions` is still used; mirror the pattern)
  - `setUserTimeZone(tzId)`, `fetchAvailableTimeZones()` → `admin/user/getAvailableTimeZones`
  - `postLogin()` — orchestrate post-login fetches
  - `postLogout()` — `this.$reset()`
- `persist: true` at the bottom — leverages `pinia-plugin-persistedstate`.

## Router conventions

- Use `createRouter` from `@ionic/vue-router` with `createWebHistory(import.meta.env.BASE_URL)`.
- `authGuard` is a `beforeEnter` (verified at job-manager router.ts:38–42):
  ```ts
  const authGuard = async () => {
    if (!useAuth().isAuthenticated.value) {
      return { path: '/login' };
    }
  };
  ```
- Login route: `{ path: '/login', name: 'Login', component: Login }` — no guard.
- Each protected route: `beforeEnter: authGuard`.
- Optional per-route `meta: { permissionId: 'ORDERMGR_VIEW' }` checked by a global `router.beforeEach` against `useUserStore().hasPermission(...)`.

## App.vue

Minimal — `<ion-app>` wrapping `<ion-split-pane>` (lg+ shows side menu) with `<app-menu>` and `<ion-router-outlet>`. See job-manager's App.vue for the unauthorised-redirect listener if needed.

## HTTP calls — only via `api`

```ts
import { api, commonUtil } from '@common';

// Default: hits commonUtil.getMaargURL()
const resp = await api({ url: 'oms/orders', method: 'get', params: { ... } });

// Override base URL when calling the OMS-side endpoints (rare in order manager):
await api({ url: 'getPermissions', method: 'post', baseURL: commonUtil.getOmsURL(), data: { viewIndex, viewSize } });
```

DO NOT:
- Construct full URLs manually.
- Read tokens directly from cookies.
- Add new axios instances or interceptors.
- Use `fetch`.

## Environment variables

Copy `apps/job-manager/.env.example`. Required:

```
VITE_I18N_LOCALE=en-US
VITE_I18N_FALLBACK_LOCALE=en-US
VITE_CACHE_MAX_AGE=3600
VITE_VIEW_SIZE=10
VITE_APP_PERMISSION_ID=ORDERMGR_VIEW   # gate-keeper permission for this app
VITE_ALIAS=
VITE_DEFAULT_LOG_LEVEL=error
VITE_LAUNCHPAD_URL=http://launchpad.hotwax.io/login
```

**Do not** add `OMS_URL`, `USERNAME`, `PASSWORD`, or any non-`VITE_*` env vars. Credentials and OMS URL come from the Login UI at runtime.

## vite.config.js / tsconfig

Mirror job-manager exactly. The two alias rules that matter:

```js
// vite.config.js
resolve: {
  dedupe: ['vue', 'pinia'],
  alias: {
    '@': path.resolve(__dirname, 'src'),
    '@common': path.resolve(__dirname, '../../common')
  },
},
plugins: [vue(), legacy()]
```

```json
// tsconfig.json paths
"@/*": ["src/*"],
"@common": ["../../common/index.ts"],
"@common/*": ["../../common/*"]
```

Add `@vitejs/plugin-legacy` for browser support parity with siblings.

## Theming

Use `@common/css/theme.css` and `@common/css/settings.css` (imported in main.ts). Per-app overrides go in `src/theme/variables.css`.

## i18n

Locale messages live in `src/locales/{en-US,...}.json`. `createDxpI18n` is from `@common`. Use `translate('key')` from `@common` for all user-facing strings.

## Testing

Vitest with `environment: 'jsdom'`. Tests live next to the file they test (`Foo.spec.ts` next to `Foo.ts`) or under `__tests__/`. Mock fixtures under `src/mock/`.
