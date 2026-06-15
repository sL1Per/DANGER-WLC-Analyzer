# WCL Raid Analyzer — Session Handoff

> Update this file every time a milestone finishes.

## What this is

Rebuild of Shariva's CLA + RPB Google Sheets (WoW Classic TBC raid analysis) as a
webapp. The two xlsx files in the repo root are the read-only functional spec
(see `CLAUDE.md`). Design: `docs/superpowers/specs/2026-06-11-wcl-raid-analyzer-design.md`.

## Current state (2026-06-15)

- **Roster fix (post-M7):** WCL `friendlyPlayers` can include people who were briefly
  raid-flagged but never actually raided — they showed up as extra player chips (often class
  "Unknown"), e.g. report `rc4FNbCG3t6TzWKA` listed 29 players for a 25-man (5 inert: Adorjan,
  Lilljägarn, Lillvalpen, Aquamendir, Delindru — all zero damage/healing/casts/gear). `normalize.ts`
  now applies a **second roster gate** after `filterToParticipants`: `collectActiveIds()` unions every
  combat footprint (combatantInfo, DamageDone/Healing/DamageTaken tables, casts, damage events, drum
  casts, buffs, deaths) and keeps only friendly players with ≥1 signal; falls back to the full
  friendly list when there's no activity data (trash-only / minimal caches). Verified against the
  real report: 24 kept / 5 dropped, no real raider affected. 282 tests (api 62→64). **Cached reports
  re-normalize on refresh** — to see it, restart the API and hit "Refresh from WCL" (or wait out the
  24h cache).

- **M7 (E2E validation + tuning): creds-free half DONE (code) on `main`; live-data half queued.
  280 tests pass** (data 28→31). Split because the live scripts need WCL creds (user runs them,
  I never touch the secret — agreed 2026-06-15).
  - **`classAbilities` fully verified + 1 bug fixed.** Audited all 80 curated ids against the
    **TBC 2.5.4.44833 client DB** (`wago.tools` `SpellName` CSV — the project's trusted source,
    stronger than a Wowhead UI check). 79/80 resolved to the expected spell; **Judgement of the
    Crusader was wrong** — `20304` doesn't exist and `20305–20308` are *Seal* of the Crusader (the
    paladin self-buff), not the enemy debuff. Fixed `spellIds` → `[20188,20300,20301,20302,20303,
    21183,27159]`. Confirmed each rank-checked ability's max-rank id is the genuine TBC top rank
    (Sunder 25225 / Hunter's Mark 14325 / Expose Armor 26866 / CoE 27228 / Curse of Shadow 27229).
    **All 20 abilities flipped `verified:true`.** New regression suite `classAbilities.test.ts`-style
    block in `data.test.ts` (all-verified, JoC-not-Seal, max-rank-id-listed).
  - **`avoidableAbilities` placeholder bug fixed + seeded.** The old single entry (`37098`
    "Static Charge", `encounterId:undefined`) was doubly wrong — `37098` is actually **"Rain of
    Bones"**, and it was mis-marked global. Replaced with a name-verified seed of unambiguous
    stand-out-of/dodge mechanics (Void Reaver Arcane Orb, Kael Flame Strike, Shahraz Fatal
    Attraction, Illidan Flame Crash, Naj'entus Needle Spine), `verified:false`, no `encounterId`
    (ids are boss-unique so global is safe). **Full per-boss population + flip stays for the live
    pass** (which exact same-named id lands as the DamageTaken event needs real logs).
  - **`e2e-m5b.ts` harness extended** with a "TUNING DIAGNOSTICS" stage so the user's single run
    yields everything the live commit needs: (1) raw **interrupt** event shape + sample + a
    source-is-player vs target-is-player tally (proves the `normalize.ts` direction bug —
    interrupts should key on `sourceID`, see below); (2) **top-25 DamageTaken ability ids per boss**
    with a ★ marker for currently-curated avoidable ids (confirm seeds + pick the zone's real ones);
    (3) **role assignment by class** (surfaces warriors/feral landing `physical` instead of `tank`).
- **M7 live pass — run 1 (Gruul/Magtheridon, 26 players): in progress.** Findings + fixes applied:
  - ✅ **Absorbs shape VALIDATED** — `DamageTaken` events with `absorbed>0`, keys as assumed
    (15 events, 16,006 absorbed). No change.
  - ✅ **DamageDone/DamageTaken + summary-table shapes VALIDATED** via `probe-damage.ts` (keys,
    `hitType` distribution, table `abilities/gear/talents` all as assumed).
  - ✅ **Interrupt-direction fix APPLIED + validated.** Real shape confirmed: `sourceID`=interrupter
    (player) `2/2`, `targetID`=enemy `0/2`, `extraAbilityGameID`=interrupted spell. The code/fixtures
    had it **backwards**. Flipped across the stack: core `InterruptEvent.targetPlayerId` →
    `interrupterPlayerId` (+ `sourceName` now the enemy whose cast was kicked); `normalize.ts` keys on
    `sourceID`; `rpb.ts` filters `interrupterPlayerId`; RpbView header `interrupted`→`interrupts` + a
    title; fixtures flipped; added a normalize regression (enemy-sourced interrupt is dropped).
  - ✅ **Avoidable — Gruul ids added (verified).** Real `DamageTaken` top-25 mapped via the SpellName
    CSV: **Cave In (36240)** + **Shatter (33671)** are the avoidable Gruul mechanics (the rest are
    tank/targeted/self-inflicted: Hurtful Strike, Arcing Smash, Greater Fireball, Death Coil, Seal of
    Blood, Sapper Charges, Dark Rune…). Added both `verified:true`.
  - ✅ **`enemyDebuffs` root-caused, FIXED (fetch layer), and CONFIRMED.** Run-2's breakdown was
    decisive: of 797 raw events, 719 *targeted players* and only 4 were player→enemy — normalize was
    *correct*; the fetch was returning debuffs **on friendlies**. WCL's `events(dataType: Debuffs)`
    defaults to `hostilityType: Friendlies`; we now pass **`hostilityType: Enemies`** (added an
    optional `hostilityType` to `EVENTS_QUERY`/`fetchAllEvents` — null→Friendlies default keeps
    casts/damage/interrupts/deaths correct) + a `wcl.test.ts` assertion. **Run-3 confirmed:** 989
    player→enemy debuffs → **274 intervals**, and 11 curated debuffs now show real uptimes (Curse of
    Recklessness 94%, JoC 93%, Misery 87%, CoE 74%, Faerie Fire 69%, Expose Armor 57%, JoW 47%,
    Flame Shock 37%, Feral FF 15%, Hunter's Mark 9%, Sunder 6%). Real player→enemy ids include
    **27159 (JoC) and 27164 (JoW)** — re-confirming the M7 JoC id fix.
  - ✅ **Shadow Weaving id corrected (15334 → 15258).** Run-3 showed Shadow Weaving at 0% despite a
    shadow priest present (Mind Flay observed). Root cause: `15334` is a *talent rank* (self-aura,
    never lands on enemies); the applied enemy debuff is **"Shadow Vulnerability" `15258`** (distinct
    from warlock ISB `17794-17800`), which appeared 72× player-sourced. Fixed + `verified:true`.
  - **The still-zero curated debuffs are legitimate comp/spec zeros, not id bugs** (DB-confirmed ids):
    Curse of Shadow (warlocks ran CoE + CoRecklessness), Demoralizing Shout (DPS warriors), Inner
    Fire / Molten Armor (self-buffs, spec-dependent), Winter's Chill / Improved Scorch (mage spec),
    Expose Weakness (no survival hunter). No action needed.
  - **M7 verification gate essentially CLOSED** for M5b shapes (Debuffs/absorbs validated, class-row
    uptimes live, ids confirmed). Remaining tuning (non-blocking): tank under-detection
    (run-1/3 inconclusive — warriors plausibly DPS here), M4 E2E (npcKills/shadow-resi/timeline),
    melee-activity inflation.
  - ⏳ Tank under-detection: run-1 showed `Warrior:{physical:2}` but this raid's tanks were a feral
    druid + prot pala (2 warriors plausibly DPS), so inconclusive — revisit with a clearer report.
- **M6 (Discord webhook + dark mode): DONE (code) on `main`. 277 tests pass** — core 130,
  data 28, api 62, **web 57** (+23) — web build + tsc clean; the one `eslint` error is
  pre-existing in `useReport.ts` (a newer `react-hooks/set-state-in-effect` rule), untouched by M6.
  Web-only; no `apps/api`/core/data changes. Both features visually verified in light + dark
  via Playwright against the dev server.
  - **Dark mode:** the whole app was already CSS-variable-driven, so dark = a
    `:root[data-theme="dark"]` override block in `apps/web/src/theme.css` (surfaces/text/primary/
    semantic tints + deeper shadows + `--row-tint` token replacing a hardcoded `rgba(0,0,0,.02)` and
    `color-scheme` so native controls follow). `apps/web/src/lib/theme.ts`: `resolveInitialTheme()`
    (stored choice wins, else `prefers-color-scheme`, else light), `applyTheme()` sets
    `document.documentElement.dataset.theme`, `setTheme()` persists+applies. `main.tsx` applies the
    theme before first paint (no flash). `components/ThemeToggle.tsx` sun/moon button in the sidebar
    footer; choice persisted to `wcl.theme` localStorage.
  - **Discord webhook (browser→Discord direct, user's call):** webhook URL stored only in
    localStorage (`wcl.discordWebhook`, `saveWebhookUrl/loadWebhookUrl/clearWebhookUrl` in storage.ts;
    blank = clear). `components/ShareToDiscord.tsx` "Share to Discord" button on both `/cla/:id` and
    `/rpb/:id` headers — posts `window.location.href` + report title/zone straight to the webhook
    (`lib/discord.ts`: `isValidWebhookUrl` regex-validates discord(app).com/ptb/canary hosts,
    `buildShareMessage`, `postToDiscord` POSTs `{content}` JSON, throws on non-2xx). No API change —
    Discord webhook endpoints send `Access-Control-Allow-Origin: *`. Webhook field added to the
    Settings page (validates on save). When no webhook is set, the button is replaced by a
    "Set a Discord webhook" link to Settings. **Webhook URL handling is flagged for the M9 security
    review** (it's user-supplied and only client-side regex-validated today).
- **M5b (RPB class/role-specific ability rows + M5a deferred items): on `main` (code).**
  **254 tests pass** — core 130, data 28, api 62, web 34 — web build + tsc clean. Manual
  E2E + Wowhead id verification still pending (see follow-ups under Next milestones → M5b).
  - **Class rows:** data-driven `packages/data/src/classAbilities.ts` (20 abilities across all 9
    classes; `measure` ∈ enemy-debuff-uptime / self-buff-uptime / cast-count; rank tables inline)
    drives a pure core `classMetrics()` (`packages/core/src/classMetrics.ts`): per-player uptime%
    (merged intervals over boss duration), cast counts, and a **rank-misuse flag** (`computeRankFlag`:
    fires when `optimalRank:"max"` and >½ of that ability's casts used a below-max rank). `RpbRow`
    gained `classRows: ClassAbilityResult[]`; `RpbView` renders them as a per-player detail row with
    severity colors, `⚠ low rank`, and an **`unverified` badge** (all curated ids ship `verified:false`).
  - **Deferred items folded in:** (a) **absorbs** now real — `fetchAbsorbs` (DamageTaken events with
    `absorbed>0`) → `report.absorbs` → `RpbRow.totalAbsorbed`, shown as a detail-row badge. (b) **true
    avoidable filtering** — curated `packages/data/src/avoidableAbilities.ts` + `avoidableAbilityIds`;
    `totalAvoidableDamageTaken` now sums only curated avoidable ability ids, with `totalPartlyAvoidable`
    (all boss dmg taken) retained as hover context. (c) **reflected/hostile split** — replaced the
    mis-sourced `damageReflectedOrHostile` with `damageReflected` (self-target) + `damageToHostilePlayers`
    (PvP), both surfaced as detail-row badges. (d) **fetch scoping** — `EVENTS_QUERY` now takes
    `fightIDs`; `fetchAllCasts/Interrupts/DamageTaken/DamageDone` + the two new fetchers are scoped to
    `bossFightIds` (WCL points budget).
  - **New fetcher:** `fetchEnemyDebuffs` (`Debuffs` events, player source / enemy target) →
    `report.enemyDebuffs` (`EnemyDebuffInterval`), normalized as merged open/close intervals.
  - ⚠️ **WCL shapes for `Debuffs` + absorb events are ASSUMED** (no creds in build env) — validate via
    `apps/api/scripts/probe-damage.ts` before claiming E2E, same posture as M4/M5a.
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
- **M5b — RPB class/role-specific ability rows + M5a deferred items: DONE (code) on `main`; manual
  E2E + id verification pending.** Spec/plan:
  `docs/superpowers/{specs,plans}/2026-06-15-wcl-raid-analyzer-m5b-rpb-class-rows*.md`. The per-class
  ability lists are NOT in the xlsx (they lived in the original's Apps Script) — they were hand-curated
  like M3/M4. **E2E + verification follow-ups (all open):**
  - Validate enemy `Debuffs`, absorb event shapes, and damage source flags via
    `apps/api/scripts/probe-damage.ts` against a real cached report (build env had no creds).
  - **Flip `classAbilities` / `avoidableAbilities` `verified` flags to true once each id is
    Wowhead-confirmed; fix any wrong ranks** (Classic ranks are distinct spell ids — the most
    error-prone part; current values are a knowledge-based starter set).
  - Populate `avoidableAbilities` per boss from real ability ids (currently a single placeholder entry).
  - Re-check debuff-uptime on multi-target/cleave fights (documented melee/multi-target caveat — uptime
    is unioned across all enemies, can inflate).
  - Optional: surface a `self-buff-uptime` test with real buff intervals; the double-filter micro-nit in
    `classMetrics` (cast list filtered twice for cast-count) is cosmetic.
- **M6 — polish (features): DONE (code) on `main`.** Discord webhook (browser→Discord direct;
  URL in localStorage; "Share to Discord" on both report pages + Settings field) + dark mode
  (`[data-theme="dark"]` CSS-var override, OS-default-then-remembered toggle in the sidebar).
  See Current state for detail. *(Only these two — deploy/CORS moved to M10.)*
  Follow-up for M9: the webhook URL is user-supplied, client-side-validated only.
- **M7 — E2E validation + tuning follow-ups: creds-free half DONE (on `main`); live-data half
  queued** (see Current state for what landed). **Remaining (needs the user's creds + reports):**
  - Run the harness once per representative report and read the new diagnostics:
    `! WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api exec tsx scripts/e2e-m5b.ts <code>`
    (a casters + SR-boss report, e.g. the old `C4Zm2Rcgq6Tb7Mxn`), plus `probe-damage.ts <code>` for
    the raw DamageDone/Taken key+hitType dump.
  - **Apply the interrupt-direction fix** (`normalize.ts` key on `sourceID`; update core
    `InterruptEvent` shape + tests) once the harness confirms source-is-player is the larger tally.
  - **Populate `avoidableAbilities` per boss** from the ★/top-DamageTaken dump; flip `verified:true`
    for ids confirmed present as damage events.
  - Validate the assumed **`Debuffs` + absorb** shapes from the harness's RAW SHAPE DIAGNOSTICS.
  - **Tank under-detection** (warriors/feral in `physical`): add a Defensive/Bear-form signal or a
    damage-taken-ratio heuristic, tuned against the `[roles]` dump.
  - Still-open **M4 E2E** (npcKills vs WCL Deaths, shadow-resi on Shahraz/Hyjal, two-log timeline,
    correct MH/BT/ZA npc ids) and **melee activity** inflation (documented-approximate).
  This is the gate that turns M4/M5a/M5b from "code-complete, shapes assumed" into "verified."
- **M8 — code + dependencies cleanup:** unify duplicated types (`BossRequirement`/`ZoneValidation`,
  `RoleSignal`) across `@wcl/core`/`@wcl/data`; remove dead exports (`PlayerTotals.magicDamageDone`,
  `ZoneTrashRule`, the `classMetrics` double-filter nit); add an `apps/api` `typecheck` script and fix
  the pre-existing `@wcl/data` `data.test.ts` tsc error; dependency audit/bump.
- **M9 — security review:** run `/security-review` over the branch; lock down anything it flags
  (input validation on report ids, the DELETE-cache auth trade-off, webhook URL handling from M6, etc.).
- **M10 — Cloudflare Workers deploy:** swap the in-memory `TtlCache` → Workers KV and lock down CORS
  for the deployed origin.

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
- Reports cached before M5b lack `enemyDebuffs`/`absorbs` → class-row uptimes + real absorbs
  need a refresh from WCL (graceful: missing fields read as empty, no crash).
- Folder name has a **double space** (`WOW  RPB_CLA`) — always quote paths.
