# @wcl/api

A deliberately minimal [Hono](https://hono.dev) service: a **credential-free
snapshot store** for sharing reports. It does no live WarcraftLogs fetching — that
all happens in the browser ([`@wcl/web`](../web)).

Two endpoints:

- `POST /api/share` — accepts a `ReportData` body, strips any credential-like
  fields (`stripCredentials`), stores it, returns `{ shareId }`.
- `GET /api/share/:shareId` — returns the stored snapshot, or `404`.

Storage is a `ShareStore` interface (`put` / `get`) injected via `createApp(store)`
for testing. The dev adapter is an in-memory map.

> **Not production-ready as-is:** the dev store is an unauthenticated, unbounded
> write endpoint. A production adapter (e.g. Cloudflare KV/R2) must add auth, a
> size cap, eviction, and rate-limiting. See
> [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#the-snapshot-store-appsapi).

```sh
pnpm --filter @wcl/api dev          # tsx watch on :8787
pnpm --filter @wcl/api test
pnpm --filter @wcl/api typecheck
```
