# M5a — Role Performance Breakdown (RPB): framework + universal metrics

**Date:** 2026-06-14
**Status:** Approved design (pending user review of this doc)
**Source spec:** the RPB xlsx export in the repo root (V1.6.0a, see `CLAUDE.md`) +
the parent design `docs/superpowers/specs/2026-06-11-wcl-raid-analyzer-design.md`.

## Goal

Reproduce the second Shariva tool — Role Performance Breakdown — as a new web tab,
showing per-player performance grouped by role (Tank / Healer / Caster / Physical).

M5 is large, so it is **decomposed**:

- **M5a (this spec):** role auto-detection + manual override (persisted per
  character) + per-role table layout + all **universal metrics** (Bucket A) that
  apply to every player regardless of class. Ships a complete, real-data-verifiable
  RPB.
- **M5b+ (future, own specs):** class/role-specific ability uptime rows (Bucket B):
  per-class buff/debuff uptimes with rank-checking (e.g. mage "winter chill?",
  paladin "twisted swings on bosses%"), and the per-boss curated "tracked abilities"
  raw avoidable-damage list. These need curated per-class ability lists that are NOT
  in the xlsx (they lived in the original's Apps Script) and are deferred.

**Kalecgos is excluded from all RPB numbers** (the fight's portal mechanic breaks
them) — carried over from the original.

## Decisions

| Topic | Decision |
| --- | --- |
| Scope | M5a = role framework + Bucket A universal metrics; Bucket B deferred to M5b+ |
| Role detection | Hybrid: output ratios primary + small curated aura/cast signal set as tiebreakers |
| Role override | Manual, persisted per character name in `localStorage`; override always wins over auto-detect |
| Spell-haste data | Reconstruct a **comprehensive** TBC cast-time lookup from wago.tools (not the original's specific ~543 ids) |
| Avoidable damage | Ship generic "Total (partly) avoidable" now; defer per-boss "Raw by tracked abilities" to M5b |
| Engineering / Oil dmg | Include in M5a — curate the small id sets now |
| Stack / patterns | Unchanged: `@wcl/core` (pure) + `@wcl/data` (JSON) + `apps/api` (Hono normalize) + `apps/web` (React tab); severity color convention applies |

## Architecture

Follows the established monorepo pattern. `@wcl/core` stays pure (no I/O, never
imports `@wcl/data` — reference data is injected via config objects).

### New core modules (`packages/core/src/`)

- **`roles.ts`** — `detectRole(player, reportData, signals): Role` where
  `Role = 'tank' | 'healer' | 'caster' | 'physical'`. Pure heuristic (see
  Role detection). Curated signal ids injected via a config arg.
- **`activity.ts`** — `activity(player, reportData, castTimes, hasteBuffIds)`:
  seconds active on single target / AoE, relative active % (ST / AoE / total),
  hits per AoE cast (⌀), and spell-haste-corrected seconds.
- **`rpb.ts`** — orchestrator: `rpb(reportData, config): RpbResult`. Detects each
  player's role, computes every universal metric, groups rows by role, and assigns
  `severity` to results per the color convention. Universal-metric helpers live
  here or in small sibling files; drums reuse the existing `drums.ts`.

All results carry `severity: "major" | "moderate" | "minor"` (or an "ok"/positive
state) so the web renders the existing `sev-*` classes — required by the project's
severity color convention.

### New reference data (`packages/data/`)

- **`json/spell-cast-times.json`** — comprehensive TBC spell-id → base cast time in
  **deci-seconds** (e.g. 3000 ms → `30`). Regenerable via a checked-in
  `scripts/extract_cast_times.py` that joins wago.tools `Spell` / `SpellMisc`
  (`CastingTimeIndex`) / `SpellCastTimes` (`Base`, ms) for build **2.5.4.44833** and
  divides `Base` by 100. Exported from `@wcl/data` as `spellCastTimes`.
- **`src/roleSignals.ts`** — small curated set (~10–15 ids) of role-defining
  auras/casts used as detection tiebreakers (e.g. Defensive Stance 71, Righteous
  Fury 25780, Bear/Dire Bear Form 9634). Wowhead-verified.
- **`src/rpbAbilities.ts`** (or JSON) — curated id sets for the universal metrics
  that need them: engineering damage ability/item ids (~20–40, Wowhead-verified),
  Oil of Immolation spell id, Battle Shout aura id, the `excludedFromAbsorbed`
  set, and the spell-haste **buff** id set (which buffs mean a cast was hasted).

### API (`apps/api`)

Extend `normalize` to carry the events RPB needs as **additive optional**
`ReportData` fields (so pre-M5 caches still load other tabs and show a refresh
notice on RPB, exactly like M3/M4):

- damage-taken events (for avoidable / friendly-fire / reflected / hostile splits),
- interrupt events (interrupted ability + source actor),
- death events,
- absorb events,
- cast events with ability ids + target counts (for activity / AoE).

Fetched with WCL `filterExpression` / event-type queries, batched and cached the
same way as existing event fetches. Run `pnpm --filter @wcl/api probe <code>` to
validate event shapes against live WCL before relying on them (no creds in build
env — shapes must be verified, not assumed; cf. the gem-quality lesson).

### Web (`apps/web`)

- **`components/RpbView.tsx`** — one new tab. Players grouped under role headers
  (Tank / Healer / Caster / Physical); a metric table per player or per role.
  Reuses `sev-*` classes + `<SeverityLegend />`. Shows a refresh notice when the
  cached report predates M5 (missing the new event fields).
- **Role override** — a dropdown per player; selection saved to `localStorage`
  under `wcl.roles.<characterName>` and read before auto-detect so a manual choice
  always wins. Matches the original's "adjustments are saved per character."

## Role detection (hybrid)

`detectRole` runs once per player over the whole report, in order:

1. **Manual override wins** — if `localStorage` has a saved role for that character
   name, use it; auto-detect only fills the blank.
2. **Aura/cast signals** (decisive for known edge cases, from `roleSignals.ts`):
   - **Tank**: Defensive Stance / Righteous Fury / Bear Form presence combined with
     a high damage-taken share. Resolves druid bear (tank) vs cat (physical).
   - **Healer**: meaningful healing-done from healing spells (resolves holy vs
     shadow priest, resto vs balance/feral druid).
3. **Output ratios** (fallback when signals are ambiguous) — per player: healing
   done, damage done, damage taken, and the magic-vs-physical school split of
   damage done:
   - healing share dominant → **Healer**
   - high damage-taken share + a tank signal → **Tank**
   - damage mostly spell-school → **Caster**
   - damage mostly physical → **Physical**
4. **Default** — if everything is ambiguous (e.g. an AFK logger), fall back to
   **Physical** and rely on manual override.

Thresholds (e.g. "healing > 40% of total output") are named constants with comments,
tuned against the real report during E2E. Meaningful healing-done is treated as the
strongest healer signal.

## Universal metrics (Bucket A)

Computed for every player. "Boss fights only unless it says total." Kalecgos
excluded. Grouped by data dependency:

### Clean — generic events, no curated data
- `# of deaths in total` — death events.
- `# of interrupted spells` + `names and sources of interrupted spells` — interrupt
  events (interrupted ability + source actor).
- `total absorbed` — absorb events; JC absorb-neck attribution reuses M3 neck logic;
  a small curated `excludedFromAbsorbed` set is applied.
- `Damage reflected` / `Friendly Fire` (Charges/Plague → counted as done to self) /
  `Damage to hostile players` (PvP → counted as done to self) — damage events
  partitioned by source / target / ability.
- `seconds active on single target` / `on aoe`, `relative active %` (ST / AoE /
  total), `# of hits per aoe cast on average (⌀)` — cast + damage events; an AoE
  cast = a cast hitting more than one target.
- WCL's own `active % overall` (with and without trash) — taken from WCL if exposed,
  else computed.
- `Battle Shout uptime on you %` — buff uptime of the Battle Shout aura.
- `temporary weapon enhancement uptime` — reuse M3's `weaponEnhancementEnchantIds`
  whitelist. Known melee gap (rogue poisons / warrior stones applied via events, not
  combatantInfo) is surfaced as a caveat and deferred (same as the M3 finding).

### Needs small curated data (in `@wcl/data`)
- `damage done with Engineering etc. total` (+ dps as a note) — engineering ability/
  item id set (~20–40, Wowhead-verified).
- `damage done only with Oil of Immolation` — single spell id.
- `spell-haste-corrected seconds` — `spell-cast-times.json` × cast counts, corrected
  using the haste-buff id set (which buffs mean a cast was hasted).
- `trinkets equipped on bosses` — from `combatantInfo` gear (already available);
  hover text listing trinket names.

### Deferred / unknown (flagged, not faked)
- **Avoidable damage taken**: implement the generic `Total (partly) avoidable damage
  taken` now (WCL avoidable/environmental + self-inflicted), each value hyperlinked
  to the WCL query as the original does. The per-boss `Raw avoidable damage taken by
  tracked abilities` requires a curated per-encounter ability list that is **not in
  the xlsx** → shown as "not yet tracked" and deferred to M5b. We under-promise
  rather than display a wrong number.

## Testing & verification

Same discipline as M0–M4.

- **Unit tests in `@wcl/core`** with hand-built `ReportData` fixtures per module:
  - role detection — one fixture per edge case: feral tank vs cat, holy vs shadow
    priest, ambiguous → Physical;
  - activity — haste-corrected seconds with a known cast set;
  - each universal metric — deaths, interrupts, absorbs, reflected, friendly fire,
    hostile, engineering, immolation, battle shout, trinkets.
  - **Fixtures only populate fields real WCL actually returns** (lesson from the
    gem-quality bug — never hand-populate phantom fields; verify shapes against a
    real cached report).
- **Cast-time extraction**: checked-in `extract_cast_times.py` + a smoke test
  asserting row count and spot values (e.g. `3000 ms → 30`).
- **Web component tests** for `RpbView`: role grouping, override-dropdown
  persistence, severity classes, refresh notice on a pre-M5 cache.
- **Manual E2E** against real report `Mcva2nh39kHzfjqC` (Gruul) once built:
  spot-check roles, deaths, interrupts, and activity against WCL's own numbers; tune
  role thresholds here. Real-data-verifiable now (unlike M4's pending speedrun E2E).

## Workflow

brainstorm → spec (this doc) → writing-plans → subagent-driven-development
(implementer + spec review + quality review per task, final whole-branch review) →
finishing-a-development-branch (user has always chosen merge-to-main locally).
Update `handoff.md` when the milestone finishes.

## Known unknowns / risks

- **Comprehensive cast-time table size**: extracting all TBC spells is fine, but
  some cast ids in logs may be channeled/instant/rank-variant — resolve cast time by
  ability id, default to 0 (instant) when absent, and surface a count of unresolved
  ids during E2E.
- **WCL event shapes not yet live-probed** in the build env — validate via `probe`
  before trusting damage-taken / interrupt / absorb shapes.
- **Role thresholds are estimates** until tuned on the real report.
- **Melee temp-weapon-enhancement gap** (poisons/stones) carried over from M3 —
  surfaced as a caveat, full event-based tracking deferred.
- **Spell-haste buff set** (which buffs mean a cast was hasted) must be curated;
  Bloodlust/Heroism + class haste buffs, Wowhead-verified.

## Out of scope (M5a)

- Bucket B per-class ability uptime rows + rank-checking.
- Per-boss curated "tracked abilities" raw avoidable-damage list.
- Discord webhook, dark mode, deploy hardening (M6).
- Multi-language UI (dropped project-wide — English only).
