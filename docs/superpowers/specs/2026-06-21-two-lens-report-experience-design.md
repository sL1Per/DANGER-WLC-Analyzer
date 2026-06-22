# Two-Lens Report Experience — Design

**Date:** 2026-06-21
**Scope:** `apps/web` view-layer / information-architecture redesign.
**Source:** `design_handoff_raid_analyzer/` (`README.md`, `IMPLEMENTATION.md`, `Raid Analyzer.dc.html`).

## Goal

Collapse today's two separate destinations — CLA (`/cla/:id`) and RPB (`/rpb/:id`) —
into **one report experience** with a persistent **two-lens toggle**:

- **By Boss Fight** — pick a pull, see everyone (categories: Summary · Performance ·
  Gear · Consumables · Drums, plus Validate · Shadow Resi).
- **By Player** — pick a raider, see everything they did all night (single profile).

Visual language: the dark "raid-tool" aesthetic from the handoff README, WoW class
colors, and the problem/watch/fine heatmap. This is a **view-layer change only**:
`packages/core`, `packages/data`, and `apps/api` are unchanged, and the prototype's
mock data is **not** ported — every view wires to existing `@wcl/core` functions.

## Confirmed decisions

1. **Fight scoping:** selecting a fight chip re-scopes Performance / Consumables /
   Drums to that single pull (not report-wide). Implemented via a web-layer report
   projection, no new core logic.
2. **Theme:** the README dark palette becomes the dark theme; the existing light
   theme stays functional via the same CSS vars (not pixel-matched). ThemeToggle kept.
3. **Extra tabs:** Validate + Shadow Resi fold in as By-Boss-Fight categories; Fight
   Timeline stays reachable but outside the single-fight lens (it's a two-log tool).

## Routing & URL state

One route replaces the two; selection lives in the URL so links stay shareable.

- `/report/:reportId` with query params:
  - `lens` = `fight` | `player` (default `fight`)
  - `fight` = fightId (default: last boss fight)
  - `player` = playerId (default: first roster player)
  - `cat` = `summary` | `performance` | `gear` | `consumables` | `drums` | `validate`
    | `shadowresi` (default `summary`)
  - `q` = roster search text
- Each lens keeps its own selection (separate params), matching the prototype.
- Read/write via `useSearchParams`. No new state library.
- **Back-compat redirects:** `/cla/:id` → `/report/:id?cat=gear`,
  `/rpb/:id` → `/report/:id?cat=performance`. Preserves bookmarks and the
  `loadLastReportId()`-driven nav.

## Component architecture (`apps/web/src`)

- `pages/ReportPage.tsx` — report shell. `useReport(reportId)`; renders `ReportHeader`
  + `LensBar` + the active view selected from URL state. **Replaces** today's
  `ReportPage` and `RpbPage`.
- `components/ReportHeader.tsx` — sticky top bar: brand lockup (→ Home), report
  identity (title · zone · N players · date), `SeverityLegend`, and Settings /
  New report / Refresh-from-WCL buttons. Refresh shown only when credentials exist
  (`loadCredentials() !== null`), reusing today's `reload` from `useReport`.
- `components/LensBar.tsx` — segmented By-Boss-Fight / By-Player toggle + the context
  strip:
  - *fight*: wrapping row of fight chips (boss name + Kill/Wipe pill + duration · N
    players), sourced from `report.fights` filtered to bosses.
  - *player*: 240px "Filter raiders…" search + class-colored player chips, sorted by
    class (`CLASS_ORDER`) then name, from `report.players`.
  - All selections write to the URL.
- `components/report/SummaryRankings.tsx` — `buildRankingsGrid(report.rankings)` → three
  role tables (DPS/Healers/Tanks), Player | Avg | one column per ranked boss, rows
  sorted by Avg desc, numeric cells colored by the parse-percentile scale. Refresh
  notice when `report.rankings` is undefined. (Restyle of existing `RankingsGrid`.)
  **Report-level — ignores the selected fight.**
- `components/report/PerformanceView.tsx` — the hero view. Runs the **fight-scoped**
  `rpb` + `consumables` + `gearIssues`, groups by `row.role` (Tanks → Healers → Casters
  → Melee), README's slim columns: Player · Spec · Deaths · Avoidable dmg · Interrupts ·
  Uptime · Consumables · Gear flags. Avoidable/Uptime via `relativeHeat` over that
  fight's raid min–max; deaths/flags via absolute heat. Interrupts show "—" for
  tank/healer. The Consumables cell shows the Full/Partial/Missing **status rollup**
  (see By-Player). Player cells link to the By-Player lens. Summary banner: boss name +
  Kill/Wipe pill + Duration / Deaths / Under-consumed / Gear flags readouts.
- `components/report/GearMatrix.tsx` — restyled gear table from `gearListing(report,
  fightId)` + `gearIssues(report, cfg)`; README's 8-slot subset (Head, Neck, Shoulders,
  Cloak, Chest, Hands, Legs, Weapon); flagged cells tinted (major/moderate) with a
  `title` reason. Reuses core fns + `SLOT_NAMES`, same model as `GearListingView`.
- Consumables tab reuses `ConsumableMatrix` (per-row relative heatmap), fight-scoped +
  restyled. Drums reuses `DrumsView`, fight-scoped + restyled to README columns
  (Player | Battle | War | Restoration | Wasted | Total | Score).
- `components/report/PlayerProfile.tsx` — By-Player dashboard (see "By-Player" below).
- `pages/HomePage.tsx` — restyled to the centered "Analyze a raid" card (URL/id parse
  unchanged; Enter/Analyze → `/report/:id`; "load a sample" → demo id; ⚙ → Settings).
- `pages/SettingsPage.tsx` — restyled to two cards (WCL credentials + Discord webhook),
  reusing `loadCredentials/saveCredentials`, webhook helpers, and `isValidWebhookUrl`.
- `components/AppShell.tsx` — the CLA/RPB sidebar is removed; the in-report
  `ReportHeader` and the full-viewport Home/Settings layouts replace it. Shell keeps
  only theme/layout scaffolding + `ThemeToggle`.

## Fight-scoping helper — no new core logic

`lib/scopeReport.ts`:

```ts
export function scopeReportToFight(report: ReportData, fightId: number): ReportData {
  return { ...report, fights: report.fights.filter((f) => f.id === fightId) };
}
```

`rpb`, `rpbConsumables`, and `drums` derive their boss-fight set from `report.fights`
while keeping `playerTotals` (role detection) and all event arrays intact (those filter
by `fightId` internally). So projecting `fights` to one boss re-scopes the analyses to a
single pull with zero core changes. `gearListing` already takes an explicit `fightId`.

`lib/analysisConfig.ts` assembles the `RpbConfig` and the consumable/drum specs from
`@wcl/data` once (today this is inline in `RpbView`), so `PerformanceView`,
`PlayerProfile`, and the scoped runs share one config source instead of duplicating it.

## By-Player profile (re-projection)

Keyed by player, composing existing outputs — no new analysis:

- Report-wide `rpb` row + `rpbConsumables` row + `gearListing`/`gearIssues` (last gear
  fight) for the selected player.
- **Per-boss breakdown**: run the fight-scoped `rpb` per boss fight (small N, memoized)
  and read that player's row → Deaths / Avoidable / Uptime per boss.
- **Header**: class-colored avatar + name (class color) + Class · Spec · Role + verdict
  pill + one-line note.
- **Stat tiles**: Deaths, Avoidable dmg, Avg uptime, Interrupts, Consumables, Gear flags.
- **Body**: left = per-boss table + consumables/buffs list; right = gear & enchants panel
  (clean-flag summary + per-slot item + issue pill).

Two **web-layer presentation rollups** (the only new judgement logic; documented
thresholds; pure functions of existing core outputs, not new core analysis):

- **Consumables status** (Full / Partial / Missing) — derived from the buff-`consumables()`
  `ConsumableRow` (`elixirOrFlask` / `food` / `weaponEnhancement` uptimes). This is the
  meaningful discipline source; the Consumables **matrix tab** keeps using
  `rpbConsumables` (utility-potion counts heatmap) per the handoff.
- **Verdict pill** (Exemplary / Solid / Needs attention / Major concerns) — derived from
  `RpbRow.severity` + death/flag counts.

The By-Player "Consumables & buffs" list shows the same buff-`consumables()` disciplines
(elixir/flask, food, weapon enhancement, scrolls) colored good/ok/missing via `uptimeHeat`.

## Theming

Extend `theme.css`:

- Pour the README dark palette into `:root[data-theme="dark"]`: gold accent + gradient,
  on-accent text, severity heat hexes (good/watch/problem/neutral), the WCL
  parse-percentile scale, role accents (tank/healer/caster/physical).
- Add `--font-display` (Marcellus), `--font-mono` (JetBrains Mono); add the three Google
  Font `<link>`s in `index.html`. Numbers/ids/durations → mono; headings → display.
- Map README severity hexes onto the existing `sev-*` / heat classes so `heatmap.ts`
  consumers need no change.
- The three lightened class colors (Priest `#E6E7EC`, Shaman `#3D8BEF`, Warlock
  `#9A86D6`) become dark-theme overrides of the existing class-color vars.
- Light theme stays functional through the same vars (not pixel-matched).

New component styling goes in `index.css` using the variable system (the prototype's
inline styles are an authoring artifact and are not copied).

## Known data gaps (flagged, non-blocking)

- **Spec** is not on `RpbRow`; it's only on `RankingCharacter`. Performance/Profile show
  spec when resolvable from `report.rankings` by name, else fall back to class.
- Validate + Shadow Resi reuse `ValidateView` / `ShadowResView` as categories. Fight
  Timeline (`TimelineView`) stays reachable but outside the single-fight lens.
- Older caches: `rankings`, `rpb`, `rpbConsumables`, `drums` return `null`/undefined →
  reuse the existing "cached before X — Refresh from WCL" notice pattern.

## Testing

Vitest + React Testing Library, matching the existing per-component `.test.tsx` pattern:

- `scopeReportToFight` — unit: only `fights` is filtered; other fields preserved.
- `LensBar` — toggle + chip selection write the expected URL params; roster search filters.
- `SummaryRankings` — renders the parse grid; shows refresh notice when `rankings` undefined.
- `PerformanceView` — groups by role; reflects fight scoping; relative heat over raid min–max.
- `PlayerProfile` — re-projection renders tiles + per-boss rows; rollup functions covered.
- `ReportPage` — URL state round-trips; `/cla` and `/rpb` redirects resolve.

`packages/core`, `packages/data`, `apps/api` and their tests are untouched.

## Out of scope

- Any change to `packages/core`, `packages/data`, `apps/api`.
- Porting the prototype's mock-data generators.
- New analysis logic beyond the two flagged web-layer presentation rollups.
