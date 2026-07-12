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

## Deploying from the Cloudflare dashboard (no local CLI)

You can drive the whole thing from the browser via **Workers Builds** (Git-connected). Both Workers still deploy with `wrangler deploy`, so a few values live in the committed `wrangler.jsonc` files rather than the dashboard — those spots are called out below.

**One-time: create the KV namespace (UI).**
1. Dashboard → **Storage & Databases → KV → Create a namespace**. Name it `SHARE_KV`.
2. Copy the namespace **ID** and paste it into `apps/api/wrangler.jsonc` (`kv_namespaces[0].id`), commit, and push. The binding *name* (`SHARE_KV`) stays in the config file — the dashboard only mints the ID.

**Deploy the API Worker.**
1. Dashboard → **Workers & Pages → Create → Workers → Import a repository**; authorize GitHub and pick this repo.
2. **Build settings:**
   - Build command: *(leave empty)* — Workers Builds installs deps automatically; `wrangler deploy` does the bundling.
   - Deploy command: `npx wrangler deploy --config apps/api/wrangler.jsonc`
   - Root directory: *(leave empty)* so pnpm resolves the workspace deps.
3. KV binding and `WEB_ORIGIN` come from `apps/api/wrangler.jsonc`, **not** the dashboard's *Settings → Bindings/Variables* panel — a `wrangler deploy` overwrites those from the config file each time. Edit them in the file and push.
4. **Save and Deploy.** Note the resulting `…workers.dev` URL — that's your `VITE_API_BASE`.

**Deploy the web Worker.**
1. Same flow: **Create → Workers → Import a repository → this repo** (a second Worker).
2. **Build settings:**
   - Build command: `pnpm --filter @wcl/web build`
   - Deploy command: `npx wrangler deploy --config apps/web/wrangler.jsonc`
   - Root directory: *(leave empty)*.
3. **Settings → Build → Variables** (build-time, not runtime): add `VITE_API_BASE` = the API URL from the step above. This is baked into the bundle at build time, so changing it later needs a fresh deploy. *(This one genuinely lives in the dashboard — Vite consumes it before `wrangler` runs, so it is not a Worker binding.)*
4. **Save and Deploy.** Note the web URL.

**Close the CORS loop.** Put the web URL into `WEB_ORIGIN` in `apps/api/wrangler.jsonc`, commit, and push — the API Worker rebuilds and locks `/api/*` to that origin.

> Dashboard vs. config, at a glance: **KV namespace** → created in UI, ID pasted into `wrangler.jsonc`. **KV binding + `WEB_ORIGIN`** → `apps/api/wrangler.jsonc`. **`VITE_API_BASE`** → dashboard build variable. **Build/deploy commands + repo connection** → dashboard.

## Snapshots are gzip-compressed (free-tier constraint)

A full raid report serializes to **tens of MB** — past Cloudflare KV's **25 MiB** per-value ceiling — and a free-tier Worker gets only **~10 ms CPU**, far too little to decompress/parse it server-side. So:

- The **browser** gzips the report before upload and decompresses shared snapshots on read (`apps/web/src/lib/share.ts`, ~10x on JSON).
- The **API** is a pure pass-through: it checks the gzip magic bytes and stores/serves the opaque bytes (`Content-Type: application/gzip`). It does **not** parse the report.
- Because the API can't inspect the payload, **shape validation and the credential-strip run client-side** before compression. The server keeps only the cheap gzip-magic check + the 24 MB body limit.

## Caveat

`POST /api/share` is an open, unauthenticated write (and, per the above, its contents are not server-validated beyond being gzip). Before sharing the app widely, rate-limit it (below) or add a Turnstile check so it can't be spammed.

## Rate-limiting the share endpoint

**Important:** Cloudflare's dashboard **WAF → Rate limiting rules** only apply to a **zone (a custom domain)** — they do **not** cover a `*.workers.dev` URL. Since the API runs on `danger-wlc-analyzer-api.slipviegas.workers.dev`, use the in-code **Workers Rate Limiting binding** instead (free, works on `workers.dev`).

### Option A — Workers Rate Limiting binding (works on workers.dev)

1. **Declare the binding** in `apps/api/wrangler.jsonc`. `namespace_id` is any unique integer string you pick; `period` must be `10` or `60` (seconds):

   ```jsonc
   "ratelimits": [
     {
       "name": "SHARE_RATE_LIMITER",
       "namespace_id": "1001",
       "simple": { "limit": 20, "period": 60 }
     }
   ]
   ```

   (20 publishes per minute per key — tune to taste.)

2. **Add it to the Worker's `Env`** in `apps/api/src/worker.ts`:

   ```ts
   import type { RateLimit } from "@cloudflare/workers-types";

   export interface Env {
     SHARE_KV: KVNamespace;
     WEB_ORIGIN?: string;
     SHARE_RATE_LIMITER: RateLimit;
   }
   ```

3. **Enforce it on `POST /api/share`** — pass the limiter into `createApp` and check it before storing. Key by client IP (`cf-connecting-ip`) so one abuser can't exhaust everyone:

   ```ts
   // in the POST handler, before store.put(...)
   const ip = c.req.header("cf-connecting-ip") ?? "anon";
   const { success } = await c.env.SHARE_RATE_LIMITER.limit({ key: `share:${ip}` });
   if (!success) return c.json({ error: "Too many requests, slow down." }, 429);
   ```

   The limiter is per-Worker-instance/region (good enough for basic abuse control; not a global counter). Deploy as usual (`git push` → Workers Builds, or `pnpm --filter @wcl/api deploy`).

### Option B — WAF rate-limiting rule (only if you add a custom domain)

If you put the API behind a custom domain (Workers → your Worker → **Settings → Domains & Routes → Add custom domain**), the zone-level WAF applies and the free plan includes **one** rate-limiting rule:

1. Dashboard → your domain → **Security → WAF → Rate limiting rules → Create rule**.
2. **When incoming requests match:** `URI Path` `equals` `/api/share` **and** `Request Method` `equals` `POST`.
3. **Rate:** e.g. `20` requests per `1 minute`, counting by **IP**.
4. **Then:** `Block` for `1 minute` (or return a custom 429).
5. Deploy the rule.

## Alternative

Vercel or Netlify for the frontend are fine for a pure SPA, but you then need a separate KV (Vercel KV / Upstash Redis free tier) for the share store — two vendors instead of one. Cloudflare keeps it unified, and `TODO.md` already names Cloudflare KV/R2 as the intended target.
