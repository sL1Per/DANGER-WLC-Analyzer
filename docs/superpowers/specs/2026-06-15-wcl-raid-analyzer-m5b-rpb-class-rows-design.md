# M5b — Role Performance Breakdown (RPB): class/role-specific ability rows + M5a deferred items

**Date:** 2026-06-15
**Status:** Approved design (pending user review of this doc)
**Source spec:** the RPB xlsx export in the repo root (V1.6.0a, see `CLAUDE.md`),
the parent design `docs/superpowers/specs/2026-06-11-wcl-raid-analyzer-design.md`,
and the M5a design `docs/superpowers/specs/2026-06-14-wcl-raid-analyzer-m5a-rpb-design.md`.

## Goal

Complete the Role Performance Breakdown by adding the **class/role-specific ability
rows** (Bucket B from the M5a spec) on top of M5a's universal metrics, and fold in
the technical items M5a explicitly deferred.

M5a shipped role detection + universal per-player metrics. M5b adds, per player, the
buff/debuff uptimes and ability-usage rows that are specific to their **class** —
e.g. a mage's Winter's Chill uptime on the boss, a warlock's Curse of the Elements
uptime, a warrior's Sunder Armor, a paladin's Judgement of Wisdom — with
**rank-checking** ("mostly lower rank used if only max rank is optimal").

**Kalecgos remains excluded from all RPB numbers** (portal mechanic) — already
enforced in `rpb.ts` and must stay enforced for the new metrics.

## Critical constraint: the class ability lists are NOT in the xlsx

The xlsx `trans` sheet contains only the **universal** RPB labels plus a single
class-specific key (`winterChill` = "winter chill?"). The original tool built its
per-class buff/debuff lists **in Apps Script**, which is not part of the xlsx export.
Therefore M5b's per-class ability databases must be **hand-curated and
Wowhead-verified** — the same situation as M3 (consumable spell ids) and M4 (speedrun
npc ids). Per the established convention, every curated id is Wowhead-verified, and
anything uncertain is flagged `verified: false` and surfaced in the UI.
**Curation completeness/accuracy is the primary risk of this milestone**, so the
mechanism is fully data-driven: adding a class or ability is a data edit, never a
code change.

## Scope (decided)

Maximal scope, confirmed with the user:

1. **Class/role-specific ability rows** — full per-class coverage for all 9 classes.
2. **Rank-checking** — the "mostly lower rank used if only max rank is optimal" flag.
3. **All M5a deferred items:**
   - (a) **Absorbs** — add a fetcher so `report.absorbs` is populated and
     `RpbRow.totalAbsorbed` becomes real (currently dormant, always 0).
   - (b) **True avoidable-damage filtering** — replace today's "all boss damage taken"
     relabel with a curated per-boss avoidable/environmental ability filter; keep a
     "total (partly) avoidable" figure alongside the raw-by-tracked-ability figure.
   - (c) **Reflected / Friendly-Fire / PvP-hostile partitioning** — fix the
     currently mis-sourced `damageReflectedOrHostile` and surface it correctly.
   - (d) **Fetch scoping to boss fights** — scope `fetchAllCasts/DamageTaken/
     DamageDone` and the two new fetchers to `bossFightIds` to respect the WCL
     points budget (they currently page the whole report and discard).

## Decisions

| Topic | Decision |
| --- | --- |
| Mechanism | One data-driven `ClassAbility` table drives all class rows; `measure` discriminator covers debuff-uptime / self-buff-uptime / cast-count |
| Enemy debuffs | New `Debuffs` fetcher (source = player, scoped to boss fights) → `report.enemyDebuffs` |
| Rank-checking | Curated `ranks: [{spellId, rank}]` + `optimalRank` inline per ability; runs off the **already-normalized `report.playerCasts`** (no new fetch) |
| Self-buffs | Extend `TRACKED_BUFF_IDS` with curated self-buff ids; uptime read from existing player-buff intervals |
| Avoidable filtering | New curated `avoidableAbilities` per-boss table; `totalAvoidableDamageTaken` becomes the filtered raw figure |
| Absorbs | New fetcher; validate event shape via the probe before trusting it |
| Fetch scoping | Add `fightIDs` to the events query; pass `bossFightIds` everywhere |
| Verification | Every spell id Wowhead-verified; uncertain ids `verified: false` + UI badge; real WCL shapes validated via `apps/api/scripts/probe-damage.ts` |
| Stack / patterns | Unchanged: `@wcl/core` (pure) + `@wcl/data` (JSON/TS data) + `apps/api` (Hono normalize) + `apps/web` (React); severity color convention applies |

## Architecture

Follows the established monorepo pattern. `@wcl/core` stays pure (no I/O, never
imports `@wcl/data` — reference data injected via config objects).

### `@wcl/data` — new curated databases (the bulk of the work)

**`classAbilities.ts`** — per class, a list of tracked abilities:

```ts
export type ClassAbilityMeasure = "enemy-debuff-uptime" | "self-buff-uptime" | "cast-count";

export interface ClassAbility {
  className: string;            // "Mage" (matches Player.class)
  key: string;                  // stable slug, e.g. "winters-chill"
  name: string;                 // display name, e.g. "Winter's Chill"
  measure: ClassAbilityMeasure;
  /** spell ids that count toward the measure (all ranks). */
  spellIds: number[];
  /** rank-checking: rank number per spell id (omit if not rank-checked). */
  ranks?: { spellId: number; rank: number }[];
  /** "max" = top rank is optimal → flag if lower ranks dominate. */
  optimalRank?: "max" | number;
  /** false when the id set is not yet Wowhead-confirmed (UI badge). */
  verified?: boolean;
}
```

Coverage target (all 9 classes; representative, not exhaustive — extend during
curation/E2E):

- **Raid-wide debuffs (`enemy-debuff-uptime`):** Curse of the Elements / Curse of
  Shadow / Curse of Recklessness (Warlock), Misery / Shadow Weaving (Priest),
  Winter's Chill / Improved Scorch (Mage), Sunder Armor (Warrior), Expose Armor
  (Rogue), Faerie Fire (Druid), Judgement of Wisdom / Judgement of the Crusader
  (Paladin), Hunter's Mark / Expose Weakness (Hunter).
- **Personal/`self-buff-uptime`:** stances, armors (Molten/Mage), forms, auras
  (Hunter aspects), Slice and Dice (Rogue), Inner Fire (Priest), etc.
- **Key cooldowns (`cast-count` / effective usage):** e.g. Combustion, Death Wish,
  Recklessness — where uptime is not the right measure.

**`avoidableAbilities.ts`** — curated per-boss (or global) avoidable/environmental
ability ids for true avoidable-damage filtering: `{ encounterId?, abilityId, name,
verified? }`. A global "always avoidable" set (e.g. standing in fire patterns) plus
per-boss entries.

### `apps/api` — fetching & normalize

- **`wcl.ts`:**
  - Add `fightIDs` to `EVENTS_QUERY` and thread `bossFightIds` through
    `fetchAllEvents` / `fetchAllCasts` / `fetchDamageTaken` / `fetchDamageDone`
    (item d — fetch scoping).
  - **New `fetchEnemyDebuffs(code, token, fightIds)`** — `Debuffs` dataType,
    keep `applydebuff/removedebuff/refreshdebuff`, source = player / target = enemy.
  - **New `fetchAbsorbs(code, token, fightIds)`** — absorb events (shape validated
    via the probe; `absorbed`/shield events).
- **`normalize.ts`:** `buildRpb` maps the new raw events into two new optional
  `ReportData` fields: `enemyDebuffs?` and a now-populated `absorbs?`. Best-effort
  (`Promise.allSettled`) like the other M5a fetches; pre-M5b caches simply lack the
  fields → `rpb()` degrades gracefully (class rows that need them show empty, with a
  refresh notice on the new block — same pattern as M3/M4/M5a).
- **`app.ts`:** wire the new fetchers into the existing best-effort RPB fetch block,
  scoped to `bossFightIds`.

### `packages/core` — analysis

- **New `classMetrics.ts`:** `classMetrics(playerId, report, abilities): ClassAbilityResult[]`.
  - `enemy-debuff-uptime`: merged debuff intervals (this player as source, tracked
    spell ids) over boss-fight duration → uptime + uptime%.
  - `self-buff-uptime`: reuse the existing player-buff interval logic (as
    `battleShoutUptime` already does).
  - `cast-count`: count matching casts from `report.playerCasts`.
  - **Rank flag:** from `report.playerCasts`, count casts per rank for rank-checked
    abilities; if `optimalRank: "max"` and the majority of casts are below max rank,
    set `rankFlag: true`.
  - Result: `{ key, name, measure, uptimePct?, castCount?, rankFlag, verified, severity }`.
- **`rpb.ts`:**
  - Add `classRows: ClassAbilityResult[]` to `RpbRow`, populated by `classMetrics`
    filtered to the player's class.
  - **Fix `damageReflectedOrHostile`:** correctly partition Damage Reflected vs
    Friendly Fire vs Damage-to-hostile-players against the real damage event source
    flags (validated by the probe), and surface them.
  - **Avoidable filtering:** `totalAvoidableDamageTaken` becomes damage from the
    curated `avoidableAbilities` set only; retain a `totalPartlyAvoidable` (all boss
    damage taken) for context. `totalAbsorbed` now reads real absorbs.
  - **Severity:** a class whose defining debuff has low uptime → moderate; rank
    misuse → minor; keep existing death→major, friendly-fire→moderate.

### `apps/web` — `RpbView`

Render a **class-row block** per player beneath their universal metrics: ability
name, uptime%/cast-count, rank-flag indicator, `verified:false` badge where present.
Reuse the existing `sev-*` severity classes and `<SeverityLegend />`. No new routing
(RPB already has its own `/rpb/:reportId` route and sidebar item).

## New / changed `ReportData` fields

```ts
enemyDebuffs?: EnemyDebuffInterval[];   // NEW — {fightId, sourceId, targetEnemyId, spellId, startTime, endTime}
absorbs?: AbsorbEvent[];                // EXISTING field, now actually populated
```

`EnemyDebuffInterval` is added to `types.ts`. `absorbs` already exists (dormant since
M5a) — M5b just feeds it.

## Validation & risk

- **Real WCL shapes** for enemy `Debuffs`, absorb events, and damage source flags are
  validated via `apps/api/scripts/probe-damage.ts` (already scaffolded) before/within
  E2E — same "assumed shapes, probe to confirm" posture as M4/M5a, because the build
  env has no WCL creds.
- **Curation accuracy** is the main risk: every id Wowhead-verified, uncertain ones
  `verified:false` with a UI badge; rank tables are the most error-prone (Classic
  ranks are distinct spell ids).
- **Melee/multi-target caveat** carried over: debuff uptime is measured on the fight's
  enemies generally; cleave/multi-add fights may inflate it — documented, not solved.

## Plan phasing (one spec, independently reviewable phases)

1. **Infra:** fetch scoping (`fightIDs`) + `fetchEnemyDebuffs` + `fetchAbsorbs` +
   normalize + new `ReportData` fields. (No analysis behaviour change yet.)
2. **Data curation:** `classAbilities.ts` (all 9 classes, rank tables) +
   `avoidableAbilities.ts`, Wowhead-verified, unverified flagged.
3. **Core:** `classMetrics.ts` + rank-checking + `rpb.ts` integration (class rows,
   reflected/hostile fix, avoidable filtering, real absorbs) + severities.
4. **Web:** `RpbView` class-row block + badges + tests.

Phases 1–2 and 3–4 are independently committable so we are never mid-air.

## Out of scope (M6 / later)

- Discord webhook, dark mode, Cloudflare Workers deploy, CORS lockdown (all M6).
- Tuning items still open from M5a E2E (tank under-detection, interrupt direction,
  melee activity inflation) — tracked in the handoff, not part of M5b unless they
  block the class rows.
