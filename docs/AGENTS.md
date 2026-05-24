# For agents (and humans) picking up this work

## Read order

1. **`PROJECT.md`** — what we're building, hard constraints, definition of done.
2. **`CONVENTIONS.md`** — accxui app patterns (login, router, http, env).
3. **`AUDIT.md`** — state of the Codex scaffold (keep / rewrite / delete).
4. **`MIGRATION_PLAN.md`** — sequenced phases.
5. **`ENDPOINTS.md`** — verified Moqui REST catalog.
6. **`LEGACY_SCREENS.md`** — OFBiz screen catalog with features to migrate.
7. The single `briefs/*.md` that matches your assigned stream.

If you're a fresh agent and don't know what stream you're on, default to the next unstarted brief by number.

## File map

```
docs/
├── PROJECT.md            ← start here
├── AGENTS.md             ← (this file) cross-agent coordination
├── CONVENTIONS.md        ← accxui app patterns
├── AUDIT.md              ← Codex scaffold verdict per file
├── MIGRATION_PLAN.md     ← phase-by-phase plan
├── ENDPOINTS.md          ← Moqui REST catalog
├── LEGACY_SCREENS.md     ← OFBiz screen catalog
└── briefs/
    ├── 00-scaffold.md       ← workspace integration
    ├── 01-auth.md           ← login + user store
    ├── 02-app-shell.md      ← menu, settings, theme
    ├── 03-find-order.md     ← order search
    ├── 04-view-order.md     ← order detail (richest)
    ├── 05-view-shipment.md  ← shipment detail
    ├── 06-view-return.md    ← return detail
    └── 07-view-customer.md  ← customer profile
```

## Dependency graph

```
00 ──> 01 ──> 02 ──┬──> 03 ──> 04
                   ├──> 05
                   ├──> 06
                   └──> 07
```

03–07 can run in parallel once 02 lands. 04 is the heaviest brief; the others are roughly equal.

## Where the app actually lives

- **Real directory (and future git repo):** `/Users/adityapatel/Documents/GitHub/orders manager/`
- **Symlinked into the monorepo at:** `/Users/adityapatel/Documents/GitHub/accxui/apps/order-manager`
- This matches every other accxui app — `job-manager`, `transfers`, `fulfillment`, `bopis`, etc. are all top-level repos at `/Users/adityapatel/Documents/GitHub/<app>/` and the accxui monorepo references them via symlinks under `apps/`.
- The order-manager app does not yet have its own `.git`; once initialized, it'll be its own repo. The `.gitignore` is already in place excluding `.env*`.

## Hard rules (recap from PROJECT.md)

1. **Moqui only.** No OFBiz endpoints except `/login`.
2. **`@common` for shared concerns.** Don't reinvent auth, axios, i18n, theme.
3. **`api` from `@common`.** No new HTTP clients, no `fetch`, no manual URL construction.
4. **No mock data in production paths.** Mocks live in `src/mock/` and are test-only.
5. **No `OMS_URL` / `USERNAME` / `PASSWORD` env vars.** Use the login UI.

## Coordination protocol

- **One agent per brief.** If you start brief 04, complete it or hand off explicitly.
- **Update the brief in place when you finish.** Add a "## Status" section at the bottom with: branch / commit, what's done, what's deferred, any new follow-ups.
- **If you discover the docs are wrong, update them in the same PR.** Authoritative source > matching prior text.
- **When a brief uncovers a missing DataDocument or endpoint**, document it in `ENDPOINTS.md` so the next brief doesn't repeat the discovery.

## Verifying before you act

Memory and notes can rot. Before relying on a fact in these docs, especially when about to write code that depends on it:

- **Endpoint exists?** `grep` the relevant `*.rest.xml`.
- **Field name correct?** Look at the entity definition in `hotwax-oms` / `oms` Moqui side, not memory.
- **Permission ID correct?** `GET admin/groups` on a real instance.
- **Reference app does it this way?** Open the actual file in `accxui/apps/job-manager/` and read.

## When you finish

Update the dependency graph status block in this file:

```
00 [✅ commit abc1234]
01 [✅ commit def5678]
02 [🟡 in progress — @alice]
03 [⬜]
04 [⬜]
05 [⬜]
06 [⬜]
07 [⬜]
```

(Update this block in your PR so the next agent knows what's live.)
