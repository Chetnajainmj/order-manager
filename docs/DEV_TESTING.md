# Dev testing against live APIs

This app needs real Moqui credentials to exercise the real endpoints. The setup below lets you store them once in a gitignored file and then (a) skip the Login UI when running `pnpm dev`, and (b) get a Bearer token from the CLI for `curl`-driven API testing.

## One-time setup

1. From the canonical app root (`accxui/apps/order-manager/`), copy the template:

   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and fill in the three secret values:

   ```
   VITE_DEV_OMS=myinstance                # or full https URL
   VITE_DEV_USERNAME=your.user
   VITE_DEV_PASSWORD=your-password
   ```

   `.env.local` is covered by this app's own `.gitignore` (the `.env` / `.env.*` pattern). Once you `git init` the app, sanity-check before your first commit:

   ```bash
   git -C "/Users/adityapatel/Documents/GitHub/orders manager" check-ignore -v .env.local
   ```

   You should see the gitignore rule firing.

## Path A — Auto-login in `pnpm dev`

When all three `VITE_DEV_*` values are set and you boot the dev server, `src/dev/autoLogin.ts` submits the login programmatically on app mount. You'll land on `/orders` instead of `/login`.

Toggle the behavior without removing creds:

```
VITE_DEV_AUTO_LOGIN=false        # leaves credentials in place but exercises the UI
```

The shim is gated by `import.meta.env.DEV` and is tree-shaken out of production builds.

**Wiring in `main.ts` (already part of brief 00's scaffold):**

```ts
if (import.meta.env.DEV) {
  import('./dev/autoLogin').then(({ tryDevAutoLogin }) => tryDevAutoLogin());
}
```

If you skipped that wiring, add it now.

## Path B — Headless API testing with `curl`

When you want to hit Moqui endpoints without the app (smoke-testing a new endpoint, exploring a response shape, etc.) use the login script. It reads the same `.env.local`.

```bash
# From accxui/apps/order-manager/
node scripts/dev-login.mjs
```

Output:

```json
{
  "token": "AAA...",
  "expiresAt": 1706...,
  "oms": "https://myinstance.hotwax.io/api/",
  "maarg": "https://myinstance.hotwax.io/rest/s1/"
}
```

Useful modes:

| Flag       | Output                                                          |
|------------|-----------------------------------------------------------------|
| (none)     | full JSON                                                       |
| `--token`  | bare token (good for piping)                                    |
| `--curl`   | a curl prefix you append a URL to                               |
| `--shell`  | `export TOKEN=…`, `export OMS_URL=…`, `export MAARG_URL=…` lines |

### Recipes

```bash
# Export into the current shell, then curl freely.
eval "$(node scripts/dev-login.mjs --shell)"
curl -sH "Authorization: Bearer $TOKEN" "${MAARG_URL}oms/orders?pageSize=1" | jq

# One-shot lookup of a single order:
TOKEN=$(node scripts/dev-login.mjs --token)
MAARG=$(node scripts/dev-login.mjs | jq -r .maarg)
curl -sH "Authorization: Bearer $TOKEN" "${MAARG}oms/orders/M1001" | jq

# Try a DataDocument view (the endpoint Codex was targeting):
eval "$(node scripts/dev-login.mjs --shell)"
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -X POST "${MAARG_URL}oms/dataDocumentView" \
  -d '{"dataDocumentId":"OrderManagerOrderLookup","format":"json","pageSize":5,"pageIndex":0,"customParametersMap":{"orderTypeId":"SALES_ORDER"}}' | jq
```

## Path C — Claude (or any agent) using these credentials

When an agent in this repo needs to test against the live backend:

1. **Check `.env.local` exists** — if not, ask the user to set it up using this doc.
2. **Get a token** via `node scripts/dev-login.mjs --token` and use it for subsequent `curl` calls. Tokens last `expirationTime` ms; the script can be re-run anytime.
3. **Never read or print the password.** The script is designed to scrub it from error output; don't echo `.env.local`.
4. **Never write the password into other files** — not into the conversation transcript, not into committed source, not into logs.

Agents reading this: when you have shell access in this repo, running `node scripts/dev-login.mjs --shell` and `curl`-ing the Moqui endpoints documented in [ENDPOINTS.md](ENDPOINTS.md) is the fastest way to confirm a payload shape or troubleshoot a 4xx before writing app code.

## Security notes

- `.env.local` lives outside the working tree as far as git is concerned. Confirm with `git check-ignore` before your first commit.
- The script never logs the password in success or failure paths (failure responses are scrubbed before printing).
- Auto-login is **dev-only**. `import.meta.env.DEV` is `false` in `vite build`, so the dynamic import + the `tryDevAutoLogin` call site are dropped from the production bundle. The `VITE_DEV_*` env vars also need a `VITE_` prefix to be visible to the client — they ARE bundled into the dev bundle, so do not run a publicly-accessible `pnpm dev` server against shared credentials.
- If you accidentally commit `.env.local`, rotate the password immediately.

## API reconnaissance tools

These help an agent verify endpoint shapes without spinning up the app:

| Script                                     | Purpose                                                                                  |
|--------------------------------------------|------------------------------------------------------------------------------------------|
| `scripts/dev-login.mjs`                    | Get a Bearer token (`--token`) or shell exports (`--shell`)                              |
| `scripts/fetch-swagger.mjs`                | Pull live Swagger specs into `docs/swagger/*.json` (anonymous; ~1.5 MB total)            |
| `scripts/index-swagger.mjs [<spec>] [--details]` | List every operation across the saved specs                                        |
| `scripts/inspect-op.mjs <spec> <METHOD> '<path-pattern>'` | Print full request/response shape for one operation (resolves `$ref`)          |
| `scripts/api-probe.mjs [--probe <name>]`   | Run safe, read-only probes against the live instance — saves results to `docs/swagger/probe-*.json` |

Example:

```bash
# See every order-related operation:
node scripts/index-swagger.mjs oms-orders --details

# Inspect a single op's payload + response shape:
node scripts/inspect-op.mjs oms-orders GET '/{orderId}'

# Confirm a DataDocument is seeded and queryable:
node scripts/api-probe.mjs --probe dataDocumentsList
```

## File map

| File                                       | Purpose                                                |
|--------------------------------------------|--------------------------------------------------------|
| `.env.local.example`                       | Template (committed)                                   |
| `.env.local`                               | Real credentials (gitignored)                          |
| `.gitignore`                               | Excludes `.env*` (with `!.env.example` carve-outs)     |
| `scripts/dev-login.mjs`                    | Headless CLI login → prints token / shell exports      |
| `scripts/fetch-swagger.mjs`                | Snapshot Swagger specs                                 |
| `scripts/index-swagger.mjs`                | List operations across specs                           |
| `scripts/inspect-op.mjs`                   | Drill into one operation's full shape                  |
| `scripts/api-probe.mjs`                    | Read-only smoke probes against the live API            |
| `src/dev/autoLogin.ts`                     | Vue composable; auto-logs-in during `pnpm dev`         |
