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

1. **Web (Cloudflare Pages):** Connect the repo in the Pages dashboard.
   - Build command: `pnpm --filter @wcl/web build`
   - Output dir: `apps/web/dist`
   - Set the API base URL as a build env var.
2. **API (Cloudflare Workers):**
   - Add a `wrangler.toml` to `apps/api`.
   - Write the KV adapter (`createKvShareStore()`).
   - Bind a KV namespace.
   - Deploy with `wrangler deploy`.
3. **Lock CORS:** Set `WEB_ORIGIN` (the Pages URL) so `/api/*` is not `*` in prod — `app.ts` already wires `corsOrigin`.

## Caveat

`POST /api/share` is an open, unauthenticated write. On Workers, add Cloudflare's free rate-limiting rule (or a Turnstile check) so it can't be spammed.

## Alternative

Vercel or Netlify for the frontend are fine for a pure SPA, but you then need a separate KV (Vercel KV / Upstash Redis free tier) for the share store — two vendors instead of one. Cloudflare keeps it unified, and `TODO.md` already names Cloudflare KV/R2 as the intended target.
