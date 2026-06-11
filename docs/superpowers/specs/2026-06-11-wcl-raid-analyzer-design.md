# WCL Raid Analyzer — Design

**Date:** 2026-06-11
**Status:** Approved
**Source spec:** the two xlsx exports in the repo root (CLA + RPB V1.6.0a, see `CLAUDE.md`)

## Goal

A web app reproducing Shariva's CLA and RPB Google Sheets for WoW Classic TBC:
paste a WarcraftLogs report URL, get raid-hygiene audits (gear issues, gear
listing, consumables, drums, speedrun validation, shadow resistance, fight
timeline comparison) and per-role performance breakdowns (RPB).

## Decisions

| Topic | Decision |
|---|---|
| Audience | Private guild tool, but anyone can use it by bringing their own key |
| Auth model | Bring-your-own WCL **v2** API client (client ID + secret); no user accounts |
| API | WCL **v2 GraphQL** (not the legacy v1 the spreadsheets used) |
| Sharing | Shareable URLs `/report/<id>`; server-side report cache means viewers need no key once a report has been loaded once |
| Scope order | CLA first, then RPB, broken into milestones |
| Stack | TypeScript monorepo: React + Vite SPA, Hono API (Cloudflare Workers + KV in prod, Node locally), pnpm workspaces |
| Languages | English only (drop the original's 5-language system — YAGNI) |
| Discord webhook | Deferred to final polish milestone |
| Persistence | No database. Server cache (TTL ~24h) only; user settings in browser localStorage |

## Architecture

```
apps/web        React + Vite SPA (UI only, no business logic)
apps/api        Hono server — OAuth token exchange, WCL GraphQL proxy, report cache
packages/core   Pure analysis engine, one module per analysis:
                gearIssues, gearListing, consumables, drums, validate,
                shadowRes, fightTimeline, roles, rpb/* (per-role metrics).
                No I/O, no framework deps. ReportData in → typed results out.
packages/data   Static reference JSON extracted from the xlsx files:
                - item id → socket count (~1,505)
                - item id → shadow resistance value (~1,492)
                - spell id → spell-haste cast values (~543)
                - cheap/bad enchant list (enchant id, slot, name)
                - excluded/fun item list
                - per-zone speedrun trash requirements (NPC ids, min kills)
                - consumable & drum spell-id sets
                scripts/extract-xlsx regenerates these from the xlsx files.
```

## Data flow

1. **Key setup:** user pastes WCL v2 client ID + secret on a settings page →
   localStorage only. API holds credentials in memory just long enough to mint
   an OAuth token; nothing persisted server-side.
2. **Run report:** SPA requests `/api/report/<id>`. Cache hit → return
   normalized `ReportData`. Miss → API pulls from WCL GraphQL with the caller's
   token (fights, masterData/actors, combatantInfo events, buffs/casts/
   damage-taken/deaths/interrupts tables), normalizes, caches by report ID
   (TTL ~24h, manual refresh available), returns.
3. **Analyze:** SPA runs `packages/core` analyses client-side. Filters
   (trash & bosses / only bosses / only trash, each ± wipes; fight id or
   `last`; start–end time range; player name list) are applied in core with no
   refetch. Fight-id and time-range filters are mutually exclusive (as in the
   original).
4. **Share:** guildmate opens `/report/<id>` → cache hit → full analysis, no
   key needed. Miss + no key → prompt: "ask whoever has a key to load this
   report first."

## WCL v2 mapping notes

- Gear/gems/enchants come from `combatantInfo` events at boss-pull start —
  same limitation as the original: gear known only at boss fight starts; some
  T6 fights lack combatantInfo (surface as a badge, analyze what exists).
- All v2 query specifics are contained in `apps/api`; `packages/core` only
  sees normalized `ReportData`, so an API change never touches analysis code.
- One normalized pull per report + caching keeps WCL points usage far below
  the original (~300 points per CLA run).

## Milestones

- **M0 — Foundation:** monorepo scaffold; xlsx→JSON extraction script;
  reference data committed; CI running tests.
- **M1 — Report loading:** key settings page; report URL input; API proxy +
  cache; fight list + filter UI; report summary page (zone, fights, players,
  kills/wipes). Rejects non-TBC reports.
- **M2 — CLA gear:** `gear issues` (no/bad/cheap/suboptimal enchant, missing/
  low-quality/uncut gems vs. configurable minimum quality, inactive meta gems
  per boss, spell-hit on non-caster / melee-hit on caster, vs-undead items on
  wrong targets, useless SR/PvP/riding/slowfall/engi gear, empty slots,
  configurable exclusions, "list players with no issues" toggle,
  "exclude Mother Shahraz" toggle) + `gear listing` (17 slots per player for a
  chosen boss fight, default = last fight with gear info).
- **M3 — CLA consumables + drums:** per-player boss-fight uptime scores for
  battle elixir / guardian elixir / flask / combined, food, scrolls (with type
  letters and lvl<5 marker), weapon enhancement, JC neck usage + inactive-neck
  flags, suboptimal-consumable names, total average; drums: battle/war/resto
  counts, casts on Tinnitus (wasted), lesser-version flag, ⌀ buffs per drum,
  weighted score.
- **M4 — CLA speedrun tools:** `validate` (per-zone trash NPC requirements,
  boss-kill minimums incl. split MH/BT rule, valid starting point, character
  count, overall verdict, manual zone override); `shadow resi` (Shahraz /
  Kaz'rogal / Azgalor; SR from gear vs. buffs, per-slot contributing items and
  enchants, kill-or-longest-wipe selection); fight timeline comparison of two
  logs (per-pull idle/start/duration/end, per-boss time difference, total idle).
- **M5 — RPB:** role auto-detection (Tank/Healer/Caster/Physical), manual
  override persisted per character name in localStorage; per-role tables:
  ability/buff uptimes & effective usage (boss-only unless 'total'; lower-rank
  flags), activity % (seconds active ST/AoE, relative %, spell-haste corrected
  via reference table; melee caveat surfaced), avoidable damage taken (raw +
  total, linked to WCL queries), deaths, interrupts (+ names/sources),
  friendly fire / reflected / damage to hostiles, absorbs (with exclusions,
  absorb-neck attribution), temporary weapon enhancement uptime, engineering &
  Oil of Immolation damage, trinkets equipped, Battle Shout uptime,
  class-specific checks (winter chill, paladin twisted swings). Kalecgos
  excluded from all numbers. Ability definitions ported one role at a time.
- **M6 — Polish:** Discord webhook posting, dark mode, deploy hardening.

## Error handling

Distinct user-facing states: bad/expired credentials (401), WCL rate limit
exhausted (show points guidance), report not found/private, non-TBC report,
fights missing combatantInfo (partial results + badge), WCL outage (serve
stale cache with "cached at" timestamp).

## Testing

- `packages/core`: fixture-driven unit tests per analysis using recorded,
  sanitized WCL v2 responses normalized to `ReportData`; cross-check expected
  numbers against the xlsx sample data where visible (consumable averages,
  drum scores, validate counts).
- `apps/api`: integration tests with mocked WCL endpoints (token + GraphQL).
- `apps/web`: smoke test per tab.

## Out of scope (explicitly)

- User accounts, databases, saved snapshots.
- Multi-language UI.
- Vanilla / WotLK / retail support (TBC zones only, like the original).
- WCL v1 API support.
