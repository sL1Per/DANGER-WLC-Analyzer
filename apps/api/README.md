# @wcl/api

A deliberately minimal [Hono](https://hono.dev) service: a **credential-free
snapshot store** for sharing reports. It does no live WarcraftLogs fetching — that
all happens in the browser ([`@wcl/web`](../web)).

Endpoints:

- `POST /api/share` — accepts a gzip-compressed `ReportData` body (≤ 24 MB; the
  browser strips credential-like fields before upload), stores it, returns
  `{ shareId }`.
- `GET /api/share/:shareId` — returns the stored gzip snapshot, or `404`.
- `GET` / `PUT /api/ingest/state` — state for the auto-post job, behind
  `Authorization: Bearer <INGEST_TOKEN>`.

Storage is a `ShareStore` interface (`put` / `get`) injected via `createApp(store)`
for testing. Production runs as a Cloudflare Worker (`src/worker.ts`) on KV, with
CORS locked to the web origin and a cron trigger that starts the auto-post
workflow; dev uses an in-memory map (`src/server.ts`). Snapshots expire after 30
days. See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#the-snapshot-store-appsapi)
and [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).

```sh
pnpm --filter @wcl/api dev          # tsx watch on :8787
pnpm --filter @wcl/api test
pnpm --filter @wcl/api typecheck
pnpm --filter @wcl/api deploy       # wrangler deploy (Cloudflare Worker)
```
