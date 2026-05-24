# Brief 02 — App shell, menu, theme

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`. Briefs 00 & 01 must be complete.

## Goal

The app looks and behaves like a sibling of `job-manager` / `transfers`. Sidebar menu, user/store selector, theme, settings page, version banner.

## Inputs

- Reference shell: `accxui/apps/job-manager/src/App.vue`, `accxui/apps/job-manager/src/components/Menu.vue`, `accxui/apps/job-manager/src/views/Settings.vue`.
- Current state: `src/App.vue` (13 lines), `src/components/AppMenu.vue` (60 lines).

## Tasks

1. **`src/App.vue`.** Mirror job-manager's. Add unauthorised-event listener if not already wired by `@common`.

2. **`src/components/Menu.vue`** (rename from `AppMenu.vue`; update import in App.vue). Sections to include, top to bottom:
   - **App logo** (use `@common`'s `Logo.vue` if it exists, else copy job-manager's pattern)
   - **User card**: avatar / initials, name, email, current OMS chip — backed by `useUserStore().current`
   - **Store selector**: dropdown from `useUserStore().current.stores` — order managers often work across multiple product stores
   - **Navigation links**:
     - Find orders (`/orders`)
     - (Future, briefs 08–10) Find returns (`/returns`), Find customers (`/customers`), Find shipments (`/shipments`)
     - Settings (`/settings`)
   - **Footer**: app version (from `@hotwax/app-version-info`), logout button

3. **`src/views/Settings.vue`.** Mirror job-manager. Sections:
   - Current OMS (read-only, with "Switch OMS" → logout)
   - User profile card
   - Timezone selector (`useUserStore().setUserTimeZone` already exists)
   - Language selector
   - Cache + log-level toggles (optional, if relevant)
   - Logout button

4. **`src/router/index.ts`** — add `/settings` route guarded by `authGuard`.

5. **Theme.** Copy `accxui/apps/job-manager/src/theme/variables.css` to start. Adjust the primary color if order-manager should be visually distinct. Keep palette consistent with other accxui apps.

6. **i18n.** Copy `accxui/apps/job-manager/src/locales/en-US.json` as a starter; add order-manager-specific strings (e.g. "Find an order", "Order detail", "View shipment", "View return") as needed. Replace every literal user-facing string in the new menu/settings with `translate('...')`.

7. **Empty / error states.** Create `src/components/EmptyState.vue` and `src/components/ErrorState.vue` matching job-manager's visual language. Wire into the existing 5 views as placeholders for the "no data yet" state until briefs 03–07 fill them.

## Don't do

- Don't paint over Codex's existing 5 views with placeholder content. Briefs 03–07 own those.
- Don't introduce a router-link inside the menu for routes that don't exist yet.

## Done when

- Sidebar mirrors the visual hierarchy of job-manager.
- Settings page renders user profile, timezone, language.
- Version banner shows a real version string.
- Logout from the menu works.
- The five legacy-screen routes are reachable from the menu (or via the find-orders deep links).

## Hand off

Briefs 03–07 can now run in parallel. Note any reusable components you created so they get adopted.

Implemented locally without a git commit per instruction. Reusable components: `src/components/EmptyState.vue` and `src/components/ErrorState.vue`. Styling/theme changes were intentionally skipped because project instructions currently prohibit CSS edits unless explicitly requested.
