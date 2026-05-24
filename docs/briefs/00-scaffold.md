# Brief 00 — Workspace scaffold

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`, and `../AUDIT.md`. Briefs assume you have. Don't skip them.

## Goal

Get `accxui/apps/order-manager/` building inside the accxui monorepo with the same scaffold as `accxui/apps/job-manager/`. Nothing functional yet — just the plumbing.

## Inputs

- Canonical path: `/Users/adityapatel/Documents/GitHub/accxui/apps/order-manager/`
- Reference app to mirror: `/Users/adityapatel/Documents/GitHub/accxui/apps/job-manager/`
- Shared package: `/Users/adityapatel/Documents/GitHub/accxui/common/` (alias `@common`)
- Audit verdict per file: `../AUDIT.md`

## Tasks

1. **Replace `package.json`.** Copy `apps/job-manager/package.json`, change `name` to `order-manager`, keep version `0.1.0`. This pulls in `@capacitor/*`, `@ionic/*`, `pinia-plugin-persistedstate`, `pinia`, `vue`, `vue-router`, `vue-i18n`, `vue-logger-plugin`, `mitt`, `qs`, `luxon`, `papaparse`, `cronstrue`, `cron-parser`, `boon-js`, `@casl/ability`, `@hotwax/app-version-info`, `@vitejs/plugin-legacy`, etc. Confirm against the catalog versions used by other accxui apps.

2. **Replace `vite.config.js`** with the job-manager copy. Critical pieces:
   - `dedupe: ['vue', 'pinia']`
   - `'@': path.resolve(__dirname, 'src')`
   - `'@common': path.resolve(__dirname, '../../common')`
   - `plugins: [vue(), legacy()]`
   - `test: { globals: true, environment: 'jsdom' }`
   - **Delete** the existing `envPrefix: ['VITE_', 'USERNAME', 'PASSWORD', 'OMS_URL', ...]` line — it leaks env-naming Codex invented.

3. **Replace `tsconfig.json`** with the job-manager copy. Critical: `@common` and `@common/*` path entries.

4. **Update `ionic.config.json`** — add `"appId": "co.hotwax.ordermanager"`.

5. **Add `capacitor.config.json`** mirroring job-manager. Use `appId: 'co.hotwax.ordermanager'`, `appName: 'Order Manager'`, `webDir: 'dist'`. Include the splashscreen plugin block.

6. **Add `manifest.json`** for PWA — mirror job-manager's, change name + theme color if you want a distinct identity.

7. **Add `.env.example`**:
   ```
   VITE_I18N_LOCALE=en-US
   VITE_I18N_FALLBACK_LOCALE=en-US
   VITE_CACHE_MAX_AGE=3600
   VITE_VIEW_SIZE=10
   VITE_ALIAS=
   VITE_DEFAULT_LOG_LEVEL=error
   VITE_LAUNCHPAD_URL=http://launchpad.hotwax.io/login
   ```

8. **Add directory skeletons** that don't exist yet:
   - `src/composables/` (empty)
   - `src/event-bus/` (empty placeholder or copy job-manager's)
   - `src/locales/en-US.json` — start with `{}`, briefs will fill it.
   - `src/logger/index.ts` — copy job-manager's
   - `src/theme/variables.css` — copy job-manager's
   - `src/mock/` (empty, for test fixtures)
   - `src/utils/index.ts` exporting `showToast` (copy job-manager's)
   - `src/store/util.ts` — copy job-manager's `util` store, strip job-manager-specific actions, keep fetchEntities + status flow basics.
   - `src/shims-vue.d.ts` — copy job-manager's
   - `src/vite-env.d.ts` — copy job-manager's

9. **Update `src/main.ts`** to mirror job-manager's exactly (lines 1–62). Key requirements:
   - Import `IonicVue`, `createApp`, `createPinia`, `piniaPluginPersistedstate`, `createDxpI18n` from `@common`, `initialiseConfig` from `@common`, `useUserStore` from `./store/user`, `logger`, theme CSS, `@common/css/settings.css`, `@common/css/theme.css`, all the Ionic CSS imports.
   - Build pinia with `piniaPluginPersistedstate`.
   - `initialiseConfig({ postLogin: useUserStore().postLogin, postLogout: useUserStore().postLogout, oms getter/setter, current getter/setter, router })`.
   - Mount only after `router.isReady()`.
   - **Wire the dev auto-login shim** so a developer with `.env.local` set up skips the Login UI. Add immediately before `router.isReady()`:
     ```ts
     if (import.meta.env.DEV) {
       import('./dev/autoLogin').then(({ tryDevAutoLogin }) => tryDevAutoLogin());
     }
     ```
     The shim file `src/dev/autoLogin.ts` is already present. The dynamic import + guard ensures the production bundle does not contain dev credentials code paths. See [`../DEV_TESTING.md`](../DEV_TESTING.md).

10. **Update `index.html`** — copy job-manager's. Includes PWA meta tags and a version comment.

11. **Run `pnpm install` from `/Users/adityapatel/Documents/GitHub/accxui/`.**

12. **Run `pnpm --filter order-manager build`** and confirm it succeeds. There will be type errors from the existing `OrderService.ts` referencing undefined env vars and from `main.ts` until the user store exists — fix or stub these to unblock the build. Specifically: defer the user-store / api integration to brief 01; for this brief it's acceptable to leave `OrderService.ts` and `data/orders.ts` in place but switch the views to render a "Hello" until brief 02 wires real UI.

## Don't do

- Don't write any business logic. This brief is plumbing only.
- Don't touch `src/views/*.vue` substantively. If you have to stub for a clean build, leave a `// TODO(brief-02)` comment.
- Don't add new dependencies the sibling apps don't have. If you think you need one, ask.

## Done when

- `pnpm --filter order-manager build` succeeds without errors.
- `pnpm --filter order-manager dev` boots and serves a page (even if blank).
- Importing `import { api, commonUtil } from '@common'` resolves in TypeScript.
- The diff vs. `apps/job-manager/` is approximately: app name, route definitions, view components, the existing legacy `Order/Shipment/Return/Customer` types — everything else parity.

## Hand off

Drop a one-line note in `briefs/00-scaffold.md` saying which commit hash this landed in and any open follow-ups. Next agent picks up brief 01.

Landed locally without a git commit per instruction; open follow-up: brief 01 owns real auth/profile UX beyond the scaffolded `@common` wiring. App-level permission gating is intentionally omitted for now.
