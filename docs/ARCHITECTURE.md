# Architecture

This document describes the design of the WCL Raid Analyzer: how the pieces fit
together, how data flows from WarcraftLogs to the screen, and the conventions and
trade-offs behind the implementation.

For a high-level overview and getting-started instructions, see the
[README](../README.md).

## Goals & principles

- **Bring-your-own-key, client-side first.** Every user supplies their own
  WarcraftLogs (WCL) API client. All log fetching, normalization, and caching
  happen in the browser. No credential or access token ever reaches a server we
  host. This makes the app cheap to host (effectively a static site plus a tiny
  share service) and keeps each user's WCL quota their own.
- **Pure analysis core.** All domain logic lives in a side-effect-free library
  (`@wcl/core`) that takes a normalized `ReportData` object and returns results.
  It performs no I/O and never imports the reference-data package — reference data
  is injected via config objects. This keeps it trivially unit-testable.
- **Reference data is data, not code.** TBC item/spell tables live as JSON and
  small curated TypeScript tables in `@wcl/data`, separate from logic.
- **Explicit sharing.** Reports are private to your browser until you choose to
  publish a credential-free snapshot.

## Monorepo layout

A [pnpm workspace](../pnpm-workspace.yaml) with two libraries and two apps:

```
packages/core   →  pure analysis engine        (@wcl/core)
packages/data   →  reference + curated data     (@wcl/data, depends on core for types)
apps/web        →  React SPA + WCL client       (depends on core + data)
apps/api        →  snapshot store (Hono)        (depends on core for the ReportData type)
```

Dependency direction is one-way: `core` depends on nothing internal; `data`
depends on `core` only for shared types; `web` depends on both; `api` depends on
`core` for the `ReportData` type only. There are no cycles.

```
        ┌──────────┐
        │   core   │◄────────────┐
        └────▲─────┘             │
             │ types             │ types
        ┌────┴─────┐        ┌────┴─────┐
        │   data   │        │   api    │
        └────▲─────┘        └──────────┘
             │
        ┌────┴─────┐
        │   web    │
        └──────────┘
```

## Data flow

```
 Browser (apps/web)
 ─────────────────────────────────────────────────────────────────
  Settings: WCL client id + secret  ──► localStorage (wcl.credentials)
                │
                ▼
  api.ts: exchange id/secret ──► OAuth token (cached in localStorage)
                │
                ▼
  loadReport(id, token)                       lib/wcl/
    ├─ wcl.ts        GraphQL queries to classic.warcraftlogs.com (CORS)
    ├─ normalize.ts  raw WCL shapes ──► versioned ReportData
    └─ reportCache.ts  ReportData ──► IndexedDB (per-browser, keyed by report id)
                │
                ▼
  @wcl/core analyses (gearIssues, consumables, drums, rpb, rankings, …)
                │
                ▼
  React UI (ReportView + tab components)

 Publish (optional)
 ─────────────────────────────────────────────────────────────────
  PublishShare ──► POST /api/share (apps/api) ──► { shareId }
                                  │
                                  ▼  stripCredentials()
                          in-memory ShareStore
  /s/:shareId ──► GET /api/share/:id ──► ReportData ──► read-only ReportView
```

### 1. Authentication (`apps/web/src/lib/api.ts`)

The user's WCL client id + secret are stored in `localStorage` (`wcl.credentials`)
and exchanged in-browser for an OAuth client-credentials token (HTTP Basic auth
against `warcraftlogs.com/oauth/token`). The token is cached in `localStorage`
(`wcl.token`) and reused until it expires.

### 2. Fetch (`apps/web/src/lib/wcl/wcl.ts`)

All queries go directly from the browser to the WCL **v2 GraphQL API**
(`classic.warcraftlogs.com`), which serves permissive CORS headers. The fetchers
are thin, typed wrappers around GraphQL queries (`fetchRawReport`,
`fetchCombatantInfo`, `fetchBuffEvents`, `fetchCastEvents`, `fetchDamageTaken`,
`fetchTable`, `fetchRankings`, `fetchEnemyDebuffs`, `fetchAbsorbs`, …).

WCL gotchas encoded here:

- Event queries default to `hostilityType: Friendlies`; enemy-debuff queries pass
  `hostilityType: Enemies` so player→boss debuffs are captured.
- `combatantInfo` gear entries have **no `slot` field** — the array index is the
  slot id (id-0 placeholders keep indices aligned).
- Gem quality is **not** exposed by WCL at all, so it comes from a static table
  (see [Reference data](#reference-data)).

### 3. Orchestration (`apps/web/src/lib/wcl/loadReport.ts`)

`loadReport(id, token)` ports the old server handler: it fetches the report
skeleton, derives boss vs. trash fight ids, then issues two batches of
`Promise.allSettled` fetches (best-effort — a failed sub-query degrades that
feature rather than failing the whole load). Summary tables and rankings are
fetched **boss-only** to respect the WCL points budget; event streams are fetched
across **all** fights so the trash views have data.

### 4. Normalization (`apps/web/src/lib/wcl/normalize.ts`)

Raw WCL shapes are converted into a single versioned `ReportData` object
(`packages/core/src/types.ts`). Highlights:

- **Roster gating.** WCL's `friendlyPlayers` can list people who were briefly
  raid-flagged but never raided. Players are filtered to fight participants and
  then to those with at least one combat footprint (combatantInfo / damage /
  healing / casts / etc.).
- **Buff intervals** are built from Buffs events, seeded with each boss pull's
  `combatantInfo` auras (seed-before-sweep).
- Magic vs. physical damage, deaths, interrupts (keyed on the interrupter),
  enemy-debuff intervals, absorbs, and rankings are all mapped to typed fields.

### 5. Caching (`apps/web/src/lib/reportCache.ts`)

Normalized `ReportData` is cached **per browser in IndexedDB**, keyed by report
id. Each payload carries `schemaVersion` (`SCHEMA_VERSION` in `core/types.ts`).
When the analyzer's output shape changes, bump `SCHEMA_VERSION`; cached reports
then read as **stale** (`isStaleSchema`) and the UI shows a "Refresh from WCL"
banner. `refreshReport` deletes the local entry and re-fetches.

## The analysis engine (`@wcl/core`)

Each analysis is a pure function over `ReportData` (plus an injected config from
`@wcl/data` where needed). The main modules:

| Module | Produces |
| --- | --- |
| `gearIssues`, `gearListing`, `slots`, `itemName` | Equipped gear + enchant/gem/socket problems |
| `consumables`, `rpbConsumables` | Flask/elixir/food/scroll/weapon/JC-neck discipline |
| `drums` | Drum counts, wasted casts, weighted score |
| `shadowResistance` | Per-slot SR from gear + enchants + buffs |
| `roles`, `activity`, `classMetrics`, `rpb`, `rpbSheets` | Role detection + per-player RPB metrics |
| `performance` | Damage/healing/deaths summary panels |
| `rankings` | WCL parse-percentile grid |
| `filters`, `zones`, `reportInput` | Fight scoping, zone matching, input parsing |

### Fight scoping invariant

Report-wide analyses (`drums`, `rpb`, `rpbConsumables`, `activity`) derive their
fight set from `report.fights` **only**. The caller narrows the report first via
`scopeReportToFight` (in `apps/web/src/lib/scopeReport.ts`); analyses must **not**
re-apply an internal `isBoss` filter. Doing both yields `trash ∩ boss = ∅` and
empties the trash views. Kalecgos is excluded inside `rpb`/`rpbConsumables` (its
portal mechanic breaks the numbers).

Trash-capable views are **event-sourced** (drums, deaths, interrupts, avoidable
damage, activity, consumable cast counts). Views that need `combatantInfo`
(gear, buff-uptime consumables, shadow res) or parse data (rankings) are
boss-only, because WCL only emits `combatantInfo` at boss pull.

## Reference data (`@wcl/data`)

Two kinds of data:

- **Extracted JSON** (`packages/data/json/`) — item sockets, item shadow
  resistance, spell haste, spell cast times, gem quality, bad enchants, excluded
  items. Originally derived from the reference spreadsheets and the TBC client DB
  via `scripts/extract_xlsx.py` (`pnpm --filter @wcl/data extract`).
- **Curated TypeScript tables** (`packages/data/src/`) — consumable/drum/JC-neck
  spell ids, class abilities, avoidable abilities, trinket racials, role signals.
  These did not exist in the spreadsheet export (they lived in its Apps Script),
  so they are hand-curated and verified against Wowhead / the TBC 2.5.4 client DB.
  Unverified entries are flagged and badged in the UI.

## The web app (`apps/web`)

React 19 + Vite, React Router. Routes (`src/App.tsx`):

| Route | Page |
| --- | --- |
| `/` | Home — enter a report, see rankings |
| `/settings` | WCL credentials + Discord webhook |
| `/report/:reportId?cat=…` | Main report view |
| `/s/:shareId` | Read-only shared snapshot |

`/cla` and `/rpb` are legacy redirects into `/report?cat=`.

### The report view

`ReportView` is the single presentational component for both the live report and
shared snapshots. It is driven entirely by URL search params:

- **Lens** (`lens=fight|player`) — audit a fight/card, or drill into one player.
- **Fight card** (`fight=`) — a specific fight, all bosses (`ALL_FIGHTS`), or all
  trash (`ALL_TRASH`).
- **Category tab** (`cat=`) — Rankings, Summary, Role breakdown, Gear,
  Consumables, Buff consumables, Resistances. Tabs hide themselves on cards where
  they have no data.

`ReportPage` is a thin loader (live data via the `useReport` hook);
`SharedReportPage` renders the same `ReportView` read-only from a snapshot.

### Severity colour convention

Core results carry a `severity` (`major` / `moderate` / `minor` / `ok`); the web
renders `sev-*` CSS classes — red (major), yellow (moderate), green (minor/ok) —
with a `<SeverityLegend />`. WCL parse percentiles use a separate `parse-*` scale.
Every analysis tab assigns severities in core, not in the UI.

## The snapshot store (`apps/api`)

A deliberately minimal [Hono](https://hono.dev) service. It does **no** live WCL
fetching — that all moved to the browser. It exposes exactly two endpoints:

- `POST /api/share` — accepts a `ReportData` body, runs `stripCredentials()` to
  defensively drop any credential-like fields, stores it, and returns `{ shareId }`.
- `GET /api/share/:shareId` — returns the stored snapshot, or 404.

The storage backend is a `ShareStore` interface (`put` / `get`) injected via
`createApp(store)` for testability. The development adapter is an in-memory map
(`createMemoryShareStore`).

> **Production note.** The dev in-memory store is an unauthenticated, unbounded
> write endpoint — fine locally, **not** for public deployment. A production
> adapter (e.g. Cloudflare KV/R2) must add authentication, a payload size cap, an
> eviction policy, and rate-limiting.

## Sharing model

Publishing is explicit (`apps/web/src/lib/share.ts`, `PublishShare`): the current
report's `ReportData` is POSTed to `/api/share`, and the returned `/s/<id>` link
renders read-only with no WCL key, no fetching, and no refresh. The Discord
webhook (if configured) is called directly from the browser — Discord webhook
endpoints send permissive CORS — and the webhook URL is stored in `localStorage`
only.

## Security posture

- WCL credentials and tokens live **only** in the user's `localStorage`; they
  are never sent to any server in this project.
- Published snapshots are credential-free by construction (`stripCredentials`,
  covered by a test) and are shared deliberately by the user.
- The Discord webhook URL is user-supplied and currently validated only
  client-side (host allow-list regex).
- Outstanding before any public deployment: lock down the snapshot `POST`
  endpoint (auth / size cap / eviction / rate-limit) and CORS for the deployed
  origin.

## Testing & CI

- **Vitest** across all four packages (`pnpm test`) — core, data, api (Hono via
  injected store), and web (React Testing Library + jsdom + fake-indexeddb).
- **`pnpm typecheck`** runs `tsc` over every package and is stricter than the
  test runner (`noUncheckedIndexedAccess` is on) — keep it green.
- GitHub Actions runs install + typecheck + test on push/PR
  ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
