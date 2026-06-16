# RPB Consumable Counts — Design

**Date:** 2026-06-16
**Status:** Approved (design); spec pending user review
**Subsystem:** 1 of 4 on the road to full RPB parity

## Context

The rebuilt RPB tool currently computes a subset of the original's metrics
(deaths, interrupts, absorbs, friendly fire, reflected/PvP damage, avoidable
damage, curated per-class ability rows, engineering/oil damage, Battle Shout
uptime, activity — see `packages/core/src/rpb.ts`). The original RPB **General**
tab also shows a **Consumables** section: per-player *use counts* of combat
consumables on boss fights (Haste Potion, Free Action Potion, Demonic Rune, mana
gems, etc.). This is the most visible gap when comparing our output to the
original spreadsheet.

This subsystem adds those consumable counts. It is the first of four pieces
toward full RPB parity (the others, out of scope here: per-ability `-casts`
matrices; per-role summary tabs; any remaining General-tab rows).

### Key findings driving the design

- **No fetch change needed.** `normalize.ts:118` already pulls *every* player
  cast (`events.allCasts` → `report.playerCasts`, unfiltered). Consumable use is
  a cast event, so counts are computable from data we already have.
- **Spell ids are not in the xlsx.** The `trans` sheet holds metric *labels*
  only; the consumable rows are raw spell/item names the original's Apps Script
  emitted. So the spell-id lists must be **hand-curated and verified** against
  the TBC 2.5.4 client DB (wago.tools) — the same pattern used for
  `classAbilities` in M5b/M7.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| First subsystem | Consumable counts |
| Cell coloring | Relative heatmap (per-row min-max across the raid) |
| Placement | New **General** tab now; existing role view moves under a **Roles** tab (this build also stands up the tab shell) |
| Spell-id verification | Verify **all** ids against TBC 2.5.4 (wago.tools) before shipping |

## Approach

Mirror the existing `rpb` / `classMetrics` architecture: a **pure core
function** fed by an **injected curated data table**, rendered by a new UI
component. Core stays dependency-free; `@wcl/data` supplies the spell ids; the
web app wires them together.

*Rejected:* folding counts into `RpbRow` (bloats the row, couples General-tab
data to per-player role rows); computing in `normalize.ts` (breaks the
pure-core / injected-data separation the codebase keeps).

## Components

### 1. Data — `packages/data/src/rpbConsumables.ts`

```ts
export interface RpbConsumable {
  key: string;        // stable slug
  name: string;       // display label (matches original where possible)
  spellIds: number[]; // all ids that count toward this row (grouped rows sum)
  verified: boolean;  // true once confirmed against TBC 2.5.4 wago.tools
}
export const rpbConsumables: RpbConsumable[];
```

All ids verified against the TBC 2.5.4.44833 client DB before shipping
(`verified: true`), with a comment block matching the `classAbilities.ts`
convention.

**Proposed row catalog** (best read of the General-tab screenshot + the TBC
consumable set — to be confirmed/edited in spec review):

- Drums of Battle
- Flame Cap
- Destruction Potion
- Haste Potion
- Insane Strength Potion
- Living / Free Action Potion
- Super Mana/Healing Potion *(grouped)*
- Major Mana/Healing Potion *(grouped)*
- Demonic / Dark Rune *(grouped)*
- Mana Tide Totem
- Innervate
- Mana Gems — all ranks *(grouped)*
- Thistle Tea
- Healthstone
- Temporary weapon enhancement — oils/stones *(grouped)*

"Grouped" = several spell ids summed into one row, mirroring the original's
"equivalents" / "all other" rows.

### 2. Core — `packages/core/src/rpbConsumables.ts`

```ts
export interface RpbConsumableSpec { key: string; name: string; spellIds: number[]; verified?: boolean; }
export interface RpbConsumableRow {
  playerId: number;
  playerName: string;
  className: string;
  counts: Record<string, number>; // consumable key → count on boss fights
}
export function rpbConsumables(
  report: ReportData,
  spec: RpbConsumableSpec[],
): { rows: RpbConsumableRow[] } | null;
```

- Same boss-fight scoping as `rpb()`: boss fights only, **Kalecgos excluded**.
- `count` = number of `report.playerCasts` events for that player whose
  `spellId` is in the consumable's `spellIds`, within boss fights.
- Grouped rows: a single key whose `spellIds` covers all member ids → the count
  is the sum naturally.
- Returns `null` when `report.playerCasts` is absent (report cached before casts
  were fetched), so the UI shows the same "refresh from WCL" message `rpb()`
  already uses.

### 3. UI — tab shell + matrix

- **`RpbView` gains a tab bar:** `General` | `Roles`. The existing role-section
  view (rows/cards toggle, collapsible role sections) moves under **Roles**,
  unchanged.
- **General tab** renders a new `ConsumableMatrix` component:
  - Rows = consumables (catalog order).
  - Columns = players, **grouped and colored by class** (reuse
    `lib/classColors`), matching the original layout.
  - **Relative heatmap per row:** each consumable row is min-max scaled across
    the raid — non-users at the red end, top users at the green end — via a
    small relative-mode addition to `lib/heatmap.ts`. A row where every value is
    0 stays neutral.
- Tab selection persisted in localStorage alongside the existing
  `rpbViewMode` preference (`lib/storage.ts`).

## Data flow

`useReport` → `ReportData` → `RpbView`
→ (General tab) `rpbConsumables(report, rpbConsumables-data)` → `ConsumableMatrix`
→ (Roles tab) existing `rpb(...)` → `RpbRowsView` / `RpbCardsView`.

## Error handling

- `report.playerCasts` undefined → core returns `null` → General tab shows the
  existing refresh-from-WCL notice.
- Empty roster / no boss fights → empty matrix with a neutral "no boss-fight
  data" note.
- A player who used no consumables → all-zero row of neutral cells (not red).

## Testing (TDD)

**Core (`rpbConsumables.test.ts`):**
- counts only casts within boss fights; trash casts excluded.
- Kalecgos casts excluded.
- grouped consumable sums all member spell ids.
- per-player isolation (caster's casts don't count for another player).
- `null` when `playerCasts` absent.

**UI:**
- `ConsumableMatrix`: renders one row per consumable, one column per player,
  players grouped by class; relative-heatmap class applied per row; all-zero row
  stays neutral.
- `RpbView`: tab bar switches General/Roles; selection persists.
- `heatmap` relative mode: min→red bucket, max→green bucket, single-value and
  all-equal edge cases.

## Out of scope (later subsystems)

- Per-ability `-casts` matrices (needs spell-name resolution in normalize).
- Per-role summary tabs (Caster/Physical/Tank) beyond the General/Roles split.
- Any General-tab rows that are not consumable counts.
