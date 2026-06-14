# WCL Raid Analyzer — Session Handoff

> Update this file every time a milestone finishes.

## What this is

Rebuild of Shariva's CLA + RPB Google Sheets (WoW Classic TBC raid analysis) as a
webapp. The two xlsx files in the repo root are the read-only functional spec
(see `CLAUDE.md`). Design: `docs/superpowers/specs/2026-06-11-wcl-raid-analyzer-design.md`.

## Current state (2026-06-14)

- **M0–M4 + M5a (RPB framework + universal metrics): on `main`, E2E-verified.** (Committed directly to main at the user's request; **235 tests pass** — core 123, data 22, api 57, web 33 — web build + core/api tsc clean.)
- **RPB is its own left-sidebar item + `/rpb/:reportId` route** (moved out of the CLA tab nav at user request, 2026-06-14); CLA and RPB pages share a `useReport` hook (`apps/web/src/lib/useReport.ts`).
- **M5a notes (2026-06-14):** new "rpb" web tab. Role auto-detection (`packages/core/src/roles.ts`,
  hybrid: output ratios + curated tank aura/cast signals in `@wcl/data` `roleSignals`) with a
  per-character localStorage override (`wcl.roles` key; `loadRoleOverrides`/`saveRoleOverride` in
  `apps/web/src/lib/storage.ts`; override always wins). Activity (`packages/core/src/activity.ts`):
  active seconds ST/AoE + spell-haste correction (`corrected = base/(1+pct)`) using a **reconstructed
  cast-time table** `packages/data/json/spell-cast-times.json` (6,714 rows, deci-seconds, from
  wago.tools SpellMisc×SpellCastTimes build 2.5.4.44833 via `packages/data/scripts/extract_cast_times.py`).
  Orchestrator `packages/core/src/rpb.ts`: per-player rows grouped by role with deaths, interrupts
  (+sources), friendly fire, total damage taken, engineering/oil-of-immolation damage, Battle Shout
  uptime, activity, severity (death→major, friendly fire→moderate). **Kalecgos excluded** (filtered
  before bossFightIds AND passed into `activity()` so it can't leak — regression-tested).
  API: `apps/api/src/wcl.ts` adds `fetchAllCasts/fetchInterrupts/fetchDamageTaken/fetchDamageDone`
  (no-filter pagers) + `fetchTable` (cheap per-actor summary totals for role detection);
  `normalize.ts` `buildRpb` maps them to optional `ReportData` fields; `app.ts` fetches them in a
  second best-effort `Promise.allSettled` block and builds `actorNames` from masterData.
  Pre-M5a caches → `rpb()` returns null → refresh notice (same pattern as M3/M4).
  Final-review fixes (2026-06-14): haste + Battle Shout buff ids are now added to `TRACKED_BUFF_IDS`
  (were missing → those metrics silently 0); the always-0 "absorbed" column was dropped and
  "avoidable taken" relabeled "total dmg taken" (honest until true avoidable-filtering exists).
- ✅ **M5a E2E DONE (2026-06-14)** against real cached report `C4Zm2Rcgq6Tb7Mxn` (SSC / TK, 25
  players, 86 fights) by curling the keyless cache (`curl localhost:8787/api/report/<id>`) and
  running the actual `rpb()` over the normalized data. **Assumed WCL shapes all validated** —
  playerTotals (25), playerCasts (63k), damageTakenEvents (15.8k), playerDeaths (134), interrupts,
  buffs (incl. haste/shout) all populated; no NaN/Infinity; haste-saved (20 players) + Battle Shout
  uptime (10) confirm the buff-id fix works. **Key bug found + fixed (`2c0ca3e`):** role split was
  `{caster:19, physical:0}` because the WCL summary-table `type` field is the actor's CLASS, not the
  damage school → magic-share made every DPS a caster. Replaced with class-based caster/physical
  (`casterClasses` in `@wcl/data`); distribution is now realistic `{caster:9, physical:10, healer:5,
  tank:1}`. **Also fixed (`f3a031d`):** zone matcher rejected `"SSC / TK"` (combined-instance reports)
  — now normalizes slash spacing.
- ⚠️ **E2E follow-ups still open (tune later, none blocking):** (a) **tank under-detection** — only
  1 tank found (prot pala via Righteous Fury signal); warrior tanks fall to physical because
  Defensive Stance isn't in their combatantInfo pull auras — rely on manual override or add a
  taken-share+plate-class tank heuristic. (b) **interrupts** — `interruptedSpells` is 0 for everyone
  (the 3 events are on trash and/or the source/target direction is reversed); the original likely
  counts interrupts the player PERFORMED (source=player) — re-check direction. (c) **melee activity%**
  looks inflated (warrior ~77% active) — the cast-time table includes some melee/hunter ability cast
  times; documented "melee approximate" caveat. (d) `PlayerTotals.magicDamageDone` is now unused
  (school unavailable from tables) — remove in a cleanup. (e) hybrid class defaults (enh shaman→caster,
  feral druid→physical) are guesses — override fixes them.
- **M5a deferred (carry into M5b / a follow-up):** (1) **absorbs** — no fetcher exists; `report.absorbs`
  is never produced, `RpbRow.totalAbsorbed` is dormant (marked DEFERRED in rpb.ts), column dropped from
  UI. (2) **true avoidable-damage filtering** — `totalAvoidableDamageTaken` is currently ALL boss damage
  taken (relabeled in UI); WCL avoidable/environmental filtering + per-boss raw-by-tracked-ability list
  deferred. (3) **reflected / PvP-hostile partitioning** — `damageReflectedOrHostile` computed but
  mis-sourced (uses DamageDone self-target + friendly-as-hostile) and NOT surfaced in UI; needs
  real-data design (marked DEFERRED). (4) **fetch volume** — `fetchAllCasts/DamageTaken/DamageDone`
  page the WHOLE report (all trash+boss, all actors) then discard; scope them to `fightIDs:
  bossFightIds` to respect the WCL points budget before/within E2E.
- Architecture notes (M5a): `@wcl/data` now depends on `@wcl/core` for the `Role` type (`import type`,
  one-directional, no cycle since core never imports data); `RoleSignal` is duplicated in core+data
  (structurally identical — unify by exporting from core in a cleanup). `@testing-library/jest-dom/vitest`
  is now wired in `apps/web/src/test-setup.ts` (benefits all web tests). Pre-existing `@wcl/data`
  `tsc --noEmit` error in `data.test.ts` (a `new Set` over a mixed-type array) predates M5a — still open.
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
- Bugfix (2026-06-13): **gem-quality detection was silently dead in production.**
  WCL's `gameData.item` (GameItem) exposes NO `quality` field, so `fetchItemMeta`'s
  quality query always 502'd and silently fell back to name-only → `itemMeta.quality`
  was `undefined` for every gem → `gearIssues` flagged "missing gem(s)" (socket count)
  but NEVER "uncommon/rare gem used". Unit tests missed it because the fixtures
  hand-populated `quality`. Fix: gem quality now comes from a static table
  `packages/data/json/gem-quality.json` (295 TBC gems, extracted from Wowhead's gem
  listing `WH.Gatherer.addData`, XML-spot-verified), exported as `gemQuality` and
  injected via `GearIssueConfig.gemQuality`. `ItemMeta.quality` removed; `fetchItemMeta`
  is now name-only (no more pointless 502+retry per load). Verified against real cached
  report `Mcva2nh39kHzfjqC`: Anjinho now gets 7 uncommon-gem flags, 21 report-wide
  (was 0). Note: combatantInfo enriches the equipped *item* with quality but NOT gems,
  and gem item level → quality is not a clean mapping — hence the static table.

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
- **M5a — RPB framework + universal metrics: DONE (code) on `main`; manual E2E pending** (see
  Current state). Spec/plan: `docs/superpowers/{specs,plans}/2026-06-14-wcl-raid-analyzer-m5a-rpb*.md`.
  The spell-haste gap is resolved differently than feared — we built a comprehensive cast-time table
  from wago.tools instead of the original's 143-row partial.
- **M5b — RPB class/role-specific ability rows** (next; needs its own plan): per-class buff/debuff
  uptimes with rank-checking (mage "winter chill?", paladin "twisted swings", etc.) — the curated
  per-class ability lists that aren't in the xlsx. Also fold in the M5a deferred items above (absorbs,
  true avoidable-damage filtering + raw-by-tracked-ability, reflected/hostile partitioning, fetch
  scoping to boss fights).
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
