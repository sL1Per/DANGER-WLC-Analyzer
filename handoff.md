# WCL Raid Analyzer — Session Handoff

> Update this file every time a milestone finishes.

## What this is

Rebuild of Shariva's CLA + RPB Google Sheets (WoW Classic TBC raid analysis) as a
webapp. The two xlsx files in the repo root are the read-only functional spec
(see `CLAUDE.md`). Design: `docs/superpowers/specs/2026-06-11-wcl-raid-analyzer-design.md`.

## Current state (2026-06-12)

- **M0 (foundation), M1 (report loading), M2 (gear issues + gear listing): merged to `main`, 100 tests passing.**
- Bugfix after first real-data test (2026-06-12): Classic combatantinfo gear
  entries have **no `slot` field — array index = slot id** (id-0 placeholders keep
  indices aligned); and `masterData.actors` includes every player the logger
  walked past, so players are now filtered to the union of `fights.friendlyPlayers`.
- Manual E2E with real credentials: report loads; user should re-verify gear tabs
  after the bugfix (old cache entries are stale — use "Refresh from WCL").
- `pnpm --filter @wcl/api probe <reportCode>` (with WCL_CLIENT_ID/SECRET env) dumps
  live WCL shapes to validate schema assumptions — run if anything looks off.

## Architecture

pnpm monorepo:
- `packages/core` — pure analysis lib. NO I/O, never imports `@wcl/data`
  (reference data injected via config objects). `ReportData` in → results out.
- `packages/data` — JSON extracted from the xlsx via `scripts/extract_xlsx.py`
  (item sockets, shadow res, spell haste, bad enchants, excluded items, trash reqs).
- `apps/api` — Hono proxy, port 8787. OAuth token mint, report fetch + normalize,
  in-memory 24h TtlCache keyed by report id. DI via `createApp(deps)` for tests.
- `apps/web` — React 19 + Vite, port 5173, `/api` proxied. Credentials live in
  localStorage only (`wcl.credentials`, `wcl.token`); keyless users can view
  cached reports (share model).

Commands: `pnpm dev` (api+web), `pnpm -r test`, `pnpm --filter @wcl/api probe <code>`.

## Workflow

Each milestone: superpowers brainstorm → spec → writing-plans →
subagent-driven-development (implementer + spec review + quality review per task,
final whole-branch review) → finishing-a-development-branch. User has always
chosen **merge to main locally**. Plans live in `docs/superpowers/plans/`.

## Next milestones

- **M3 — CLA consumables + drums** (next; needs its own plan): elixir/flask/food/
  scroll/weapon-enhancement uptimes on boss fights, JC necks, suboptimal list,
  total average; drums counts, Tinnitus waste, lesser-version flag, ⌀ buffs,
  weighted score ≈ round(count × ⌀buffs).
- **M4 — validate + shadow resi + fight timeline.** Must first extract per-zone
  trash tables from CLA `trans` sheet cols W–AA (current JSON has SW only).
- **M5 — RPB.** Spell-haste JSON has only 143 of ~543 rows (rest hidden behind a
  Google IMPORTRANGE not cached in the export); role auto-detection heuristic and
  per-role ability lists must be defined (spec "Known unknowns").
- **M6 — polish:** Discord webhook, dark mode, Cloudflare Workers deploy (swap
  TtlCache → KV), lock down CORS.

## Known gotchas / deferred

- Gear recorded only at boss-pull (`combatantInfo`); some T6 fights miss it.
- Deferred gear-issue rules (don't add unasked): inactive meta gems, role-dependent
  hit gear, vs-undead items, riding/slowfall/engineering gear.
- DELETE /api/report/:id requires a Bearer header but can't validate authenticity
  (documented M1 trade-off).
- Kalecgos must be excluded from all RPB numbers (M5).
- Folder name has a **double space** (`WOW  RPB_CLA`) — always quote paths.
