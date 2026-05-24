# Order Manager migration — docs

Start with [`PROJECT.md`](PROJECT.md). If you're an agent picking up work, follow [`AGENTS.md`](AGENTS.md).

## Index

- [PROJECT.md](PROJECT.md) — mission, constraints, definition of done
- [AGENTS.md](AGENTS.md) — cross-agent coordination protocol
- [CONVENTIONS.md](CONVENTIONS.md) — accxui app patterns (login, router, http, env)
- [AUDIT.md](AUDIT.md) — verdict on the existing Codex scaffold, file by file
- [MIGRATION_PLAN.md](MIGRATION_PLAN.md) — phases, milestones, risks
- [ENDPOINTS.md](ENDPOINTS.md) — verified Moqui REST catalog
- [LEGACY_SCREENS.md](LEGACY_SCREENS.md) — OFBiz screen-by-screen catalog of what we're replacing
- [DEV_TESTING.md](DEV_TESTING.md) — provisioning credentials so you (and agents) can test against live Moqui APIs
- [swagger/](swagger/) — fetched OpenAPI specs from `dev-maarg.hotwax.io` + live probe results, used to verify ENDPOINTS.md

## Briefs (one per work stream)

| #   | Brief                                                    | Status |
|-----|----------------------------------------------------------|--------|
| 00  | [Workspace scaffold](briefs/00-scaffold.md)              | ⬜     |
| 01  | [Auth + user store](briefs/01-auth.md)                   | ⬜     |
| 02  | [App shell + menu + theme](briefs/02-app-shell.md)       | ⬜     |
| 03  | [Find Order](briefs/03-find-order.md)                    | ⬜     |
| 04  | [View Order](briefs/04-view-order.md)                    | ⬜     |
| 05  | [View Shipment](briefs/05-view-shipment.md)              | ⬜     |
| 06  | [View Return](briefs/06-view-return.md)                  | ⬜     |
| 07  | [View Customer](briefs/07-view-customer.md)              | ⬜     |
| 08  | [Find Returns](briefs/08-find-returns.md)                | ⬜     |
| 09  | [Find Customers](briefs/09-find-customers.md)            | ⬜     |
| 10  | [Find Shipments](briefs/10-find-shipments.md)            | ⬜     |
