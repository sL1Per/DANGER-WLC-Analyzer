# WCL Raid Analyzer

A web app for analyzing **World of Warcraft Classic (TBC)** raid logs from
[WarcraftLogs](https://classic.warcraftlogs.com). It audits raid hygiene and
per-player performance — gear, enchants, gems, consumables, drums, shadow
resistance, role breakdowns, ability uptimes, and WCL parse rankings — and lets
you publish a read-only snapshot to share with your guild.

It's an independent, from-scratch rebuild of Shariva's **Combat Log Analytics
(CLA)** and **Role Performance Breakdown (RPB)** Google Sheets (see
[Credits](#credits)), reimagined as a fast single-page app instead of a
spreadsheet generator.

> **Bring your own key.** Each user supplies their own WarcraftLogs API client.
> All log fetching happens in your browser; no credentials ever touch a server.

## Features

- **Gear** — equipped items per boss pull with enchant/gem/socket problems
  flagged (missing/bad/suboptimal enchants, low-quality or missing gems,
  wrong-purpose gear).
- **Consumables** — per-player flask/elixir/food/scroll/weapon-enhancement
  discipline on boss fights, JC-neck usage, and suboptimal-consumable callouts.
- **Drums** — Leatherworking drum effectiveness, wasted "on Tinnitus" casts,
  averages and a weighted score.
- **Resistances** — Shadow Resistance breakdown (gear + enchants + buffs) for
  the SR-relevant bosses.
- **Role breakdown & Summary** — per-player metrics grouped by auto-detected role
  (tank / healer / caster / physical): activity, deaths, interrupts, avoidable
  damage, class-specific ability uptimes, and more.
- **Rankings** — WCL parse-percentile grid (player × boss) in WCL's color scale.
- **Lenses** — view any fight, all bosses, all trash, or drill into a single
  player; everything is colour-coded red / yellow / green by severity.
- **Share** — publish a credential-free snapshot to a `/s/<id>` link, optionally
  posted to a Discord webhook.

## Quick start

Prerequisites: **Node 22+** and **pnpm 9**.

```sh
pnpm install
pnpm dev          # web on http://localhost:5173, snapshot API on :8787
```

Then:

1. Create a free WarcraftLogs **v2 API client** at
   <https://classic.warcraftlogs.com/api/clients/> (any name; the redirect URL
   is unused — `https://localhost` is fine).
2. Open <http://localhost:5173/settings> and paste the client **ID** and
   **secret**. They're stored in your browser's `localStorage` only.
3. Paste a TBC report URL or id on the home page and analyze.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web + snapshot API in parallel |
| `pnpm test` | Run all test suites (484 tests) |
| `pnpm typecheck` | Type-check every package (`tsc`) |
| `pnpm build` | Build all packages |

## Project structure

A pnpm monorepo:

| Package | Role |
| --- | --- |
| [`packages/core`](packages/core) | Pure analysis engine — `ReportData` in, results out. No I/O. |
| [`packages/data`](packages/data) | Reference data (item sockets, shadow res, spell cast times, gem quality) + curated TBC spell-id tables. |
| [`apps/web`](apps/web) | React 19 + Vite SPA. **All WarcraftLogs fetching, normalization, and caching happen here, in the browser.** |
| [`apps/api`](apps/api) | Tiny Hono service — a credential-free snapshot store for sharing. Nothing else. |

For the full design — data flow, the fetch/normalize/cache pipeline, the sharing
model, conventions, and the security posture — see
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## How it works (in brief)

1. The browser exchanges your WCL client id/secret for an OAuth token and queries
   the WarcraftLogs **v2 GraphQL API** directly (WCL allows CORS).
2. The raw report is normalized into a versioned `ReportData` shape and cached
   per-browser in IndexedDB.
3. `@wcl/core` runs the analyses purely over that data; the React UI renders them.
4. Publishing POSTs a credential-stripped snapshot to `apps/api`, which returns a
   shareable `/s/<id>` link that needs no key to view.

## Tech stack

TypeScript · React 19 · Vite · React Router · Hono · pnpm workspaces · Vitest ·
WarcraftLogs v2 GraphQL API.

## Caveats

Inherent to WCL data, surfaced in the UI where relevant:

- Gear and consumables are only recorded at **boss pull** (`combatantInfo`); some
  T6 fights miss it, and trash fights have none.
- Melee activity % is approximate.
- Many spell/enchant ids in `@wcl/data` are hand-curated and Wowhead-verified
  (the originals lived in the spreadsheet's Apps Script, not the data export).

## Credits

The original **Combat Log Analytics** and **Role Performance Breakdown** Google
Sheets (v1.6.0a) are the work of **Shariva** (Discord: <https://discord.gg/nGvt5zH>).
This project is an independent reimplementation that reuses none of the original
code; it was built by studying the tools' published inputs, outputs, and
behavior. All WoW data and names are property of Blizzard Entertainment.

## License

[MIT](LICENSE).
