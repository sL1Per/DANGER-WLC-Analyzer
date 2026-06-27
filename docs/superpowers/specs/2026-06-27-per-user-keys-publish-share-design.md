# Per-user keys + publish-to-share — design

**Date:** 2026-06-27
**TODO item:** #10 — "Make WCL API credentials and Discord webhook local settings and
not stored in the backend like now. Idea is that in the future I will have this app
online and anyone can use it with their own keys."

## Problem & goal

The app will be hosted online for multiple users. The owner's requirement:

> Everyone who uses the hosted app must provide their **own** WCL key (and own Discord
> webhook). The owner's key/webhook must **never** be used by anyone else. Sharing a
> report link with someone should still let them view it **without** their own key —
> but only for snapshots the owner **deliberately publishes**, not by free-riding on
> the owner's live key.

### Current state (what's actually true today)

- **Discord webhook** — already fully local: stored in `localStorage`, posted
  browser→Discord directly (`apps/web/src/lib/discord.ts`, `storage.ts`). Never
  touches the backend. No change required.
- **WCL credentials** — already stored only in `localStorage` (not persisted
  server-side). **But** the client *secret* is POSTed to the backend `/api/token`
  endpoint on every token refresh, so it *transits* the server in memory.
- **Report fetching + shared cache** — the backend (`apps/api`) does all GraphQL
  fetching and normalization with the caller's Bearer token, and caches the normalized
  result in an in-memory `TtlCache` keyed by report id, **shared across all visitors**.
  `GET /api/report/:id` returns cached data *before* checking for a token
  (`app.ts:107-113`), so any visitor — even keyless — can read a report another user's
  key fetched. **This shared cache is the one real "my key used by others" leak.**

### Decisions taken during brainstorming

1. **Sharing model = publish a key-free snapshot** (mirrors the original Shariva tool,
   which exported a shareable, key-stripped spreadsheet). The automatic shared cache is
   removed; sharing becomes an explicit publish action.
2. **Live WCL fetching moves into the browser.** WCL's `/oauth/token` and v2 GraphQL
   endpoints both send permissive CORS headers (verified 2026-06-27: they reflect any
   `Origin` and allow `POST` with `authorization`/`content-type`), so the browser can
   talk to WCL directly. No credential or token ever touches a server.

## Core principle

No shared server state tied to anyone's key. Each user's browser drives WCL with that
user's own credentials, end to end. The only thing any server holds is a snapshot the
user **deliberately publishes**, which is stripped of all credentials. This makes "my
key is never used by anyone else" a structural guarantee, not a rule that a bug could
bypass.

## Architecture

### §1 — Move WCL fetching to the browser (Phase 1)

Today `apps/api` owns token exchange, GraphQL fetching, normalization, and the shared
cache. Move all of it into the web app.

- **Token exchange** → browser calls WCL `https://www.warcraftlogs.com/oauth/token`
  directly. Replace Node's `Buffer.from(\`${id}:${secret}\`).toString("base64")` with
  `btoa(\`${id}:${secret}\`)` (client id/secret are ASCII). The access token continues
  to live only in this browser's `localStorage` (existing `saveToken`/`loadToken`).
- **GraphQL fetching + normalization** → `apps/api/src/wcl.ts` and
  `apps/api/src/normalize.ts` move into `apps/web/src/lib/wcl/`. The orchestration
  currently in `apps/api/src/app.ts` (the two `Promise.allSettled` batches, building
  `actorNames` / `abilityMeta` / `petOwners`, the call to `normalizeReport`) becomes a
  browser function `loadReport(id, token): Promise<ReportData>`. The analysis packages
  `@wcl/core` and `@wcl/data` are already browser-safe and are imported unchanged.
- **Cache** → the server `TtlCache` is replaced by a **per-browser cache in
  IndexedDB** (a normalized report can exceed `localStorage`'s ~5 MB limit). It stores
  `{ data, cachedAt }` per report id and preserves the existing staleness behavior:
  `isStaleSchema(data.schemaVersion)` still drives the "refresh to update" banner.
  `refreshReport` deletes the local entry and re-fetches from WCL.
- `apps/web/src/lib/api.ts` becomes a thin shim that preserves the existing
  `fetchReport` / `refreshReport` / `ApiError` surface (so `useReport`, `ReportPage`,
  etc. change minimally) but now calls `ensureToken` (direct to WCL) + `loadReport` +
  the IndexedDB cache instead of the backend.
- Delete the Vite `/api` dev proxy entry for WCL routes and the WCL/token/report
  endpoints in `apps/api`. (`apps/api` survives only to host the snapshot store in §3.)

**Result after Phase 1:** every user must enter their own key; nobody can read data
another user's key fetched. A shared link at this point prompts the recipient for their
own key — §3 fixes that.

### §2 — Credentials & webhook (the literal TODO item)

Already per-browser in `localStorage` and already correct. No behavioral change beyond
what §1 delivers: once token exchange is in the browser, the secret no longer transits
any server, making the Settings page copy ("Stored only in this browser") literally
true for the secret as well. Update Settings copy if it implies otherwise; webhook
handling is unchanged.

### §3 — Publish-to-share (Phase 2, restores key-free sharing)

A deliberate **Publish** action replaces the old automatic shared cache.

- **Snapshot store** = the minimal remainder of `apps/api`:
  - `POST /api/share` — body is a normalized `ReportData`; stores it under a random
    `shareId`; returns `{ shareId }`. Stored **key-free** (`ReportData` already
    contains no credentials — asserted by a test).
  - `GET /api/share/:shareId` — returns the stored `ReportData` (or 404).
  - Storage sits behind a small adapter interface. Local dev uses an in-memory or
    file-backed implementation. The production backend (serverless KV / file / small
    DB) is intentionally left open — see Open Questions.
- **Web — publish:** a "Publish & share" action on the report (and wired into the
  existing *Share to Discord* flow) POSTs the current `ReportData`, receives a
  `shareId`, and builds a `/s/<shareId>` link. *Share to Discord* now posts that
  key-free snapshot link instead of a raw deep link.
- **Web — viewer route** `/s/:shareId`: fetches the snapshot via `GET
  /api/share/:shareId` and renders the existing `ReportPage` in read-only mode — **no
  key prompt, no WCL calls**. A snapshot is a frozen point-in-time view; analyzing a
  *new* report still requires the viewer's own key.

## Phasing

- **Phase 1 (§1–§2):** satisfies the security requirement immediately. Trade-off: until
  Phase 2 ships, a shared link asks the recipient for their own key (the *Share to
  Discord* deep link still navigates, just prompts for a key).
- **Phase 2 (§3):** restores key-free sharing via explicit publish.

## Testing

- `wcl.test.ts` and `normalize.test.ts` move with their code into `apps/web` and keep
  running; swap any Node `Buffer` base64 usage/mocks for `btoa`.
- `cache.test.ts` is replaced by an IndexedDB report-cache test (set/get, `cachedAt`,
  staleness via `isStaleSchema`, refresh clears the entry). Use a fake-IndexedDB shim
  under vitest.
- `app.test.ts` becomes a `loadReport` test (mock the WCL fetch layer; assert the same
  orchestration/normalization output as today).
- Phase 2 adds: snapshot store round-trip (publish → fetch by id), a test asserting the
  stored payload contains no credential fields, and a viewer-route test (renders from a
  snapshot with no key configured and issues no WCL calls).

## Open questions

1. **Production snapshot-storage backend** (serverless KV vs. file vs. small DB). It is
   coupled to *how* the app is deployed for free (TODO #14), so the storage adapter is
   kept swappable and the concrete choice is pinned when deployment is tackled. Local
   dev uses an in-memory/file implementation in the meantime.

## Out of scope

- Deploying the app (TODO #14) — only the storage *adapter seam* is introduced here.
- Dependency cleanup (TODO #11) — though Phase 1 naturally enables dropping the Hono
  fetch/cache layer.
- Any change to the analysis logic in `@wcl/core` / `@wcl/data`.
