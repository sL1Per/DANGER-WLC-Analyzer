# Deploying for free (Cloudflare)

The app is two deployable pieces with different hosting needs:

| Piece | What it is | Hosting need |
|---|---|---|
| `apps/web` | Vite + React 19 SPA. Does **all** WCL fetching browser-side (user's own key + IndexedDB). | Static file hosting |
| `apps/api` | Hono app, tiny snapshot store. Routes: `POST /api/share`, `GET /api/share/:id`. Currently **in-memory** (dies on restart). | A persistent KV store |

## Recommendation: all-in on Cloudflare (free)

- **`apps/web` → Cloudflare Pages** — static SPA hosting, free, global CDN, auto-deploy from GitHub.
- **`apps/api` → Cloudflare Workers + KV** — the Worker runs the Hono app; KV is the persistent snapshot store.

### Why this fits the code

1. **Hono is already Workers-native.** `apps/api/src/app.ts` exports a standard `app.fetch` handler — that *is* the Workers entry point. Only `server.ts` (the `@hono/node-server` wrapper) is Node-specific and is simply unused on Workers. Near-zero rewrite.
2. **KV solves the TODO #14 worries for free.** The in-memory store needs a size cap + eviction policy. Cloudflare KV has native `expirationTtl` — the 30-day TTL becomes one parameter on `put`, eviction is automatic, and the LRU bookkeeping in `shareStore.ts` goes away.
3. **One vendor, generous free tier.** Workers free = 100k requests/day; KV free = 100k reads + 1k writes/day, 1 GB.

The only new code is a `createKvShareStore()` adapter implementing the existing `ShareStore` interface (`put`/`get`) — the seam already designed in `shareStore.ts`. The HTTP layer (`app.ts`) does not change.

## Steps

1. **Web (Cloudflare Workers static assets):** Connect the repo in the Workers dashboard.
   - Build command: `pnpm --filter @wcl/web build`
   - Deploy command: `npx wrangler deploy --config apps/web/wrangler.jsonc`
   - Root directory: leave empty (repo root) so pnpm resolves the `@wcl/core` / `@wcl/data` workspace deps.
   - Env var: `VITE_API_BASE` = the API Worker's origin (e.g. `https://danger-wlc-api.<subdomain>.workers.dev`, no trailing slash). `share.ts` prefixes `/api/...` with it; leaving it unset keeps the relative path the dev Vite proxy uses.

   The `--config apps/web/wrangler.jsonc` flag is required in a pnpm workspace: a bare `wrangler deploy` runs from the repo root, detects `pnpm-workspace.yaml`, and fails with *"detection logic has been run in the root of a workspace instead of targeting a specific project."* Pointing at the config file bypasses that auto-detection. The config also sets `not_found_handling: single-page-application`, so react-router routes like `/s/:shareId` survive a hard refresh (no `_redirects` file needed).
2. **API (Cloudflare Workers + KV):** already wired — `apps/api/src/worker.ts` (Workers entry) + `apps/api/wrangler.jsonc`. From `apps/api`:
   - Create the KV namespace: `npx wrangler kv namespace create SHARE_KV`, then paste the returned `id` into `wrangler.jsonc` (`kv_namespaces[0].id`, replacing `REPLACE_WITH_KV_NAMESPACE_ID`).
   - Set `vars.WEB_ORIGIN` in `wrangler.jsonc` to the deployed web origin (locks CORS; `app.ts` already wires `corsOrigin`).
   - Deploy: `pnpm --filter @wcl/api deploy` (runs `wrangler deploy`).

   `createKvShareStore()` in `shareStore.ts` uses KV's native `expirationTtl` (30 days) — no LRU/TTL bookkeeping. `worker.ts` reuses the same Hono `createApp`; only the store adapter and CORS origin differ from the Node entry.

### First-time order (resolving the origin chicken-and-egg)

The web build needs the API's origin (`VITE_API_BASE`) and the API needs the web's origin (`WEB_ORIGIN`), so deploy in this order:

1. **Deploy the API first** to mint its URL — create the KV namespace, paste its `id` into `wrangler.jsonc`, then `pnpm --filter @wcl/api deploy`. Note the resulting `https://danger-wlc-api.<subdomain>.workers.dev`.
2. **Deploy the web** with `VITE_API_BASE` set to that API URL. Note the resulting web URL.
3. **Set `WEB_ORIGIN`** in `apps/api/wrangler.jsonc` to the web URL and **re-deploy the API** so `/api/*` CORS locks to it.

Rename the placeholder Worker names (`danger-wlc-api`, `danger-wlc-analyzer.example.workers.dev`) to your real subdomain before the first deploy.

## Caveat

`POST /api/share` is an open, unauthenticated write. On Workers, add Cloudflare's free rate-limiting rule (or a Turnstile check) so it can't be spammed.

## Alternative

Vercel or Netlify for the frontend are fine for a pure SPA, but you then need a separate KV (Vercel KV / Upstash Redis free tier) for the share store — two vendors instead of one. Cloudflare keeps it unified, and `TODO.md` already names Cloudflare KV/R2 as the intended target.
