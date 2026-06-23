# Performance Summary Tab — Design

**Date:** 2026-06-23
**Status:** Approved (design), pending implementation plan

## Goal

Rebuild the WarcraftLogs single-fight **Summary** view as a new report tab. The
reference is `https://fresh.warcraftlogs.com/reports/GPAaJQBnF19VLft4?fight=65`,
which renders four panels: **Damage Done By Source**, **Healing Done By Source**,
**Damage Taken By Ability**, and **Deaths**.

Two user-facing changes:

1. **Rename** the current `Performance` tab (per-player role tables: deaths,
   avoidable damage, interrupts, uptime, consumables, gear flags) to **Summary**.
2. **Add** a new `Performance` tab that shows the four WCL panels (DPS, HPS, etc.),
   scoped to the selected card (ALL / a specific boss / TRASH) like every other tab.

## Tab Lineup (after change)

`Rankings · Summary · Performance · Gear · Consumables · Shadow Resi`

- `Rankings` — unchanged (parse-percentile grid; internal key `summary`).
- `Summary` — the *current* `PerformanceView` role tables, relabeled. Logic
  untouched; component/file renamed to `SummaryView` for clarity.
- `Performance` — **new**, the four WCL panels (internal key `performance`).
- `Gear`, `Consumables`, `Shadow Resi` — unchanged.

### Internal key handling

The existing `Rankings` tab already owns the internal key `summary`, so renaming a
*second* tab to the label "Summary" must not reuse that key. Plan:

The label "Performance" must move from the role-tables tab to the new DPS/HPS tab,
so the role-tables tab needs a fresh internal key (it currently owns `performance`).
Assigned keys:
  - `Rankings` → key `summary` (unchanged, no URL churn for existing links)
  - `Summary` (role tables, relabeled) → key `roles`
  - `Performance` (new WCL panels) → key `performance`
- `TRASH_HIDDEN_CATS` currently hides `summary`, `gear`, `shadowresi` on the TRASH
  card. The role-tables tab (now `roles`) stays visible on TRASH as it is today.
  The new `performance` tab is event-sourced (damage/healing/deaths) so it is
  **visible on TRASH** too.

## The Four Panels

Each panel is a card with a sorted (descending by amount) table. Each data row has:
a name cell, a `%` of panel total, an **Amount** cell containing a proportional
horizontal bar plus the formatted number, and a per-second column.

1. **Damage Done By Source** (per player)
   - Source: existing `playerDamage` events (`PlayerDamageEvent`), already fetched
     for **all** fights. Aggregate by `sourceId` within the scoped fights.
   - Columns: Name (class-colored) · % · Amount (bar) · **DPS**.
   - No API change.

2. **Healing Done By Source** (per player)
   - Source: **new** raw `HealingDone` events, fetched symmetric to damage-done.
   - Aggregate by source within scoped fights (effective healing amount).
   - Columns: Name (class-colored) · % · Amount (bar) · **HPS**.

3. **Damage Taken By Ability** (aggregated by ability, raid-wide)
   - Source: existing `damageTakenEvents` (have `abilityId` + `amount`) plus
     **new** ability-name resolution.
   - Aggregate by `abilityId` within scoped fights.
   - Columns: Name (ability) · % · Amount (bar) · **DTPS**.

4. **Deaths** (per player death)
   - Source: existing deaths fetch **enriched** with the killing ability id and the
     event timestamp.
   - Columns: Name (class-colored) · Killing Blow (ability name) · Time (mm:ss into
     that death's fight: `timestamp − fight.startTime`).
   - Sorted by time ascending.

## Per-second rates

DPS / HPS / DTPS use **total scoped fight duration** = sum of `(endTime − startTime)`
across the fights in the current card (a single boss for a boss card, all bosses+
trash for ALL, all trash for TRASH). This matches WCL's fight-duration basis. Guard
against divide-by-zero (0-duration → rate 0).

## Data / API Additions (small, localized)

All new report fields are **optional** so reports cached before this feature still
load and surface the existing "Refresh from WCL (requires credentials)" notice in
the new tab until re-pulled.

### `apps/api/src/wcl.ts`
- Add `fetchHealingDone(code, token, fightIds)` — `HealingDone` dataType events,
  keep `heal`/`healabsorbed` types as appropriate, modeled on `fetchDamageDone`.
- Extend the deaths query + `RawDeathEvent` to also select the killing ability id
  (`killingAbilityGameID` / equivalent) and keep `timestamp`.
- Add `abilities { gameID name }` to the existing `masterData` block in the report
  query (one cheap field, no extra round-trip).

### `apps/api/src/app.ts`
- Fetch healing-done events (all fights, alongside damage-done).
- Build an `abilityMeta` map from `masterData.abilities`.
- Pass new data into `normalizeReport`.

### `apps/api/src/normalize.ts`
- Emit `healingEvents: HealingEvent[]` (fightId, sourceId, amount), scoped to
  roster players, mirroring how `playerDamage` is normalized.
- Enrich `playerDeaths` with `killingAbilityId` and `timestamp`.
- Pass through `abilityMeta`.

### `packages/core/src/types.ts`
- `HealingEvent { fightId: number; sourceId: number; amount: number }`.
- `ReportData.healingEvents?: HealingEvent[]`.
- Extend `PlayerDeath` with `killingAbilityId?: number` and `timestamp?: number`.
- `ReportData.abilityMeta: Record<string, { name: string }>` (mirrors `itemMeta`).

## Core analysis

New pure function in `packages/core` (e.g. `performance.ts`):

```ts
performanceSummary(report: ReportData): PerformanceSummary | null
```

- Operates on an **already-scoped** report (caller passes `scopeReportToFight(...)`),
  consistent with the project invariant that report-wide analyses derive fights from
  `report.fights` and the caller scopes — no internal `isBoss` filter.
- Returns `null` when the data needed is absent (report cached before this feature),
  driving the refresh notice.
- Output shape:
  ```ts
  interface Ranked { id: number; name: string; className?: string;
                     amount: number; percent: number; perSecond: number }
  interface DeathRow { playerName: string; className?: string;
                       killingBlow: string; timeMs: number }
  interface PerformanceSummary {
    damageBySource: Ranked[];   // sorted desc by amount
    healingBySource: Ranked[];  // sorted desc by amount
    damageTakenByAbility: Ranked[]; // sorted desc by amount
    deaths: DeathRow[];         // sorted asc by timeMs
    durationMs: number;
  }
  ```
- `percent` = amount / panel total; `perSecond` = amount / (durationMs/1000).
- Ability/source names resolved via `abilityMeta` / players list; unknown ids fall
  back to a readable placeholder.
- Unit-tested like the other analyses (fixtures with a couple of fights, asserting
  aggregation, sorting, %, per-second, and the `null`-when-missing path).

## Web component

New `apps/web/src/components/report/PerformanceView.tsx`:

- Calls `performanceSummary(scopeReportToFight(report, fightId))` via `useMemo`.
- Renders four cards in a 2×2 grid (Damage Done, Healing Done, Damage Taken,
  Deaths), each a `scroll-x` table matching the WCL layout: name · % · amount-bar ·
  rate. Bar width = `amount / maxAmountInPanel`.
- Source names use the existing `classColorVar` / `classColors` helper (as the role
  tables already do). Player rows link via `onPlayer` to the player lens.
- Reuses existing card / table / `mono` / `scroll-x` styles; add minimal CSS for the
  inline amount bar.
- The current `PerformanceView` is renamed to `SummaryView`
  (`apps/web/src/components/report/SummaryView.tsx`); its tests move with it.

## Fidelity caveats (accepted)

- **No per-row WoW icons** (class/ability/spell icons) — we have no icon assets.
  Source names stay class-colored (consistent with the rest of the app); ability and
  death rows are name-only. Layout, bars, amounts, and DPS/HPS/DTPS match the
  screenshot otherwise.
- Cached-before-this-feature reports need a one-time **Refresh from WCL** to populate
  healing, enriched deaths, and ability names; until then the tab shows the standard
  refresh notice.

## Testing

- Core: `performance.test.ts` — aggregation, sorting, %, per-second, scoping
  behavior, `null` path.
- API: extend `normalize.test.ts` for `healingEvents`, enriched `playerDeaths`,
  `abilityMeta`; extend `wcl`/`app` tests for the new fetch + masterData field.
- Web: `PerformanceView.test.tsx` (new panels render, bars/rates correct, refresh
  notice when data missing) and the moved `SummaryView.test.tsx`.

## Out of scope

- Per-row icons / tooltips with spell details.
- Overhealing %, absorb breakdowns, multi-target hit counts (WCL has more sub-tabs;
  this delivers the four panels in the screenshot only).
- Any change to the `Rankings` tab.
