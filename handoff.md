# WCL Raid Analyzer — Session Handoff

> Update this file every time a milestone finishes.

## What this is

Rebuild of Shariva's CLA + RPB Google Sheets (WoW Classic TBC raid analysis) as a
webapp. The two xlsx files in the repo root are the read-only functional spec
(see `CLAUDE.md`). Design: `docs/superpowers/specs/2026-06-11-wcl-raid-analyzer-design.md`.

## Current state (2026-06-13)

- **M0 (foundation), M1 (report loading), M2 (gear issues + gear listing), M3 (buff consumables + drums), M4 (validate + shadow resi + fight timeline): on `main`.** (M4 was committed directly to main at the user's request; 196 tests pass, web build + api tsc clean.)
- M4 notes (2026-06-13):
  - **validate** tab: per-zone speedrun rules in `packages/data/src/validateRules.ts`
    (`validateRules` + `zoneCodeByName`). SW is xlsx-verified (`verified:true`);
    **MH/BT/ZA are curated from community rules and flagged `verified:false`** — the
    UI shows an "unverified speedrun rules" badge for them. ⚠️ **Several non-SW npc ids
    are LOW-CONFIDENCE and need human cross-check on WCL** (e.g. MH 17941 resolved to
    "Mennu the Betrayer" on Wowhead; ZA 24143 may be a boss add). minKills for MH/BT/ZA
    are community estimates, not xlsx data. Core `validate()` is whole-report; returns
    null for pre-M4 caches (refresh notice). BT uses a split boss rule (5 MH + 9 BT) —
    only meaningful on a combined log.
  - npc kill counts: API fetches WCL **Deaths** events + NPC `gameID`s (masterData
    `npcs`), normalized into `ReportData.npcKills` (gameId→count) + `firstPullNpcIds`
    (valid-start check). ⚠️ **WCL Deaths/NPC-actor shapes were NOT live-probed** (no
    creds in the build env) — assumed from existing patterns; verify in the manual E2E
    via `pnpm --filter @wcl/api probe <code>`.
  - **shadow resi** tab: SR data in `packages/data/src/shadowResistance.ts`.
    `shadowResEnchants` is keyed by **enchantment id** (804 Lesser +10, 1441 Greater
    +15 — same id space as `bad-enchants.json` / combatantInfo `permanentEnchantId`,
    NOT spell ids — a spell-id keying bug was caught and fixed in review, with a
    regression-guard test). `shadowResBuffs` keyed by **spell id** (Shadow Protection +
    Shadow Resistance Aura ranks, all Wowhead-verified) to match combatantInfo `auras`.
    Item innate SR still from `item-shadow-res.json`. Core `shadowResistance()` analyzes
    the kill or longest wipe; SR-from-buffs read from `GearSnapshot.auras` (new optional
    field, populated by normalize from combatantInfo auras — no extra fetch). Total SR
    coloring is **advisory** (`SR_SOFT_TARGET=100`, not an official threshold).
  - **fight timeline** tab: `compareTimelines(a, b)` in core; the web tab fetches a
    SECOND report via the existing `/api/report/:id` cache (URL or id accepted) and
    renders the two pull lists side by side with per-boss cumulative diff + idle
    coloring. Independent of npcKills/auras, so pre-M4 caches work.
  - New optional `ReportData` fields: `npcKills`, `firstPullNpcIds`, `GearSnapshot.auras`.
  - Known cleanup (deferred, non-blocking): `BossRequirement`/`ZoneValidation` types are
    duplicated in `@wcl/core` (validate.ts) and `@wcl/data` (validateRules.ts) — they're
    structurally identical but not linked (`@wcl/data` doesn't import core today); unify
    in a cleanup pass. `ZoneTrashRule` is an unused export. `apps/api` has no `typecheck`
    script — `tsc --noEmit` caught a latent type error this milestone; consider adding one.
- **M0 (foundation), M1 (report loading), M2 (gear issues + gear listing), M3 (buff consumables + drums): merged to `main`.**
- M3 notes: consumable/drum/JC-neck spell ids are hand-curated in
  `packages/data/src/consumables.ts` (NOT from the xlsx — the originals lived in
  Apps Script); every id Wowhead-verified except two flagged `UNVERIFIED`
  (Tinnitus 369770 for Greater drums; "Increased Intellect" buff 3166). Buff
  uptimes come from WCL Buffs events + combatantInfo pull-aura seeding;
  drums "on Tinnitus" = casts with zero buff applications within 1500 ms (our
  heuristic). Reverse-engineered formulas verified against the xlsx sample:
  totalAverage = mean(elixirOrFlask, food, weaponEnh≠0); weighted score = total
  buff applications. Reports cached before M3 show refresh notices on new tabs.
- Bugfix after first real-data test (2026-06-12): Classic combatantinfo gear
  entries have **no `slot` field — array index = slot id** (id-0 placeholders keep
  indices aligned); and `masterData.actors` includes every player the logger
  walked past, so players are now filtered to the union of `fights.friendlyPlayers`.
- Post-bugfix gear tabs **re-verified against real data (2026-06-13)**: report
  `Mcva2nh39kHzfjqC` (Gruul) refreshed from WCL, driven keyless via Playwright.
  Slots align across all 75 snapshots (0 itemId=0 leaks, 0 dup slots) and across
  two different fights (per-fight combatantInfo confirmed — e.g. a mage in PvE gear
  on Gruul vs. full PvP set on the Maulgar wipe); gear listing + gear issues render
  correctly (slot-specific enchant/gem flags land on the right items); player list
  filtered to fight participants (no phantom bystanders). One edge case: a real
  fight-participant with no combatantInfo shows as class "Unknown" on the summary
  and is absent from gear tabs (handled gracefully; consider labelling "no gear
  logged" so guildmates don't read it as an error).
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

- **M4 — validate + shadow resi + fight timeline: DONE** (on `main`). Spec +
  plan: `docs/superpowers/{specs,plans}/2026-06-13-wcl-raid-analyzer-m4-speedrun-tools.md`.
  ⚠️ **Manual E2E still pending** (run against a real speedrun report once creds are
  available): confirm npcKills vs WCL Deaths view, shadow-resi totals on a Shahraz/Hyjal
  kill, and the two-log timeline; then verify/correct the `verified:false` zone npc ids.
- **M5 — RPB** (next; needs its own plan). Spell-haste JSON has only 143 of ~543 rows
  (rest hidden behind a Google IMPORTRANGE not cached in the export); role auto-detection
  heuristic and per-role ability lists must be defined (spec "Known unknowns").
- **M6 — polish:** Discord webhook, dark mode, Cloudflare Workers deploy (swap
  TtlCache → KV), lock down CORS.

## UI conventions (apply to every new tab)

- **Severity color coding** (user-requested, 2026-06-12, like the original sheets'
  conditional formatting): core results carry `severity: "major" | "moderate" | "minor"`
  (`IssueSeverity` + `SEVERITY_RANK` in `packages/core/src/gearIssues.ts`); web renders
  via `sev-major` (red) / `sev-moderate` (yellow) / `sev-minor` (green) / `sev-ok`
  (green, positive) CSS classes in `index.css`, with `<SeverityLegend />` on each tab.
  M3+ analyses (consumable uptimes, drums scores, validate verdicts, RPB) must assign
  severities in core and reuse these classes.

## Known gotchas / deferred

- Gear recorded only at boss-pull (`combatantInfo`); some T6 fights miss it.
- Deferred gear-issue rules (don't add unasked): inactive meta gems, role-dependent
  hit gear, vs-undead items, riding/slowfall/engineering gear.
- DELETE /api/report/:id requires a Bearer header but can't validate authenticity
  (documented M1 trade-off).
- Kalecgos must be excluded from all RPB numbers (M5).
- Folder name has a **double space** (`WOW  RPB_CLA`) — always quote paths.
