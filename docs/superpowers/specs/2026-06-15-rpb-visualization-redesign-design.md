# RPB Visualization Redesign — Design

**Date:** 2026-06-15
**Status:** Approved (design); pending implementation plan
**Scope:** Frontend only — `apps/web` RPB view. No `packages/core` data-model changes.

## Problem

The current RPB view (`apps/web/src/components/RpbView.tsx`) renders, per role, one
wide table with one row per player. Secondary metrics (absorbed, reflected, class
ability uptimes) are crammed into a `colSpan` "badge" sub-row beneath each player.
Result: many empty `0`/`—` cells, broken grid alignment, no value heatmap, and it is
hard to compare players on a single metric. Users find the original Excel tool (which
uses class-colored player columns and green→red conditional-format heatmaps) easier to
read.

## Goals

1. Add a **Rows ⟷ Cards view toggle** so users pick the layout that suits the task.
2. **Heatmap-color** every metric cell (green = good, yellow = watch, red = problem),
   not just severity flags on a few cells.
3. **Group players by class within each role section**, and **color-code players by
   class** using standard WoW Classic class colors.
4. Preserve everything RPB already does: role auto-detection + per-character role
   override (persisted), Kalecgos exclusion, all existing metrics, accessibility.

## Non-Goals

- No transposed metric-as-row matrix (design option A was rejected in favor of B+C).
- No change to role grouping structure (class grouping nests *inside* role, it does not
  replace it). Confirmed with user.
- No new metrics, no `packages/core` (`rpb.ts`) computation changes. `RpbRow` already
  carries `className` and `role`.
- No "group by class instead of role" toggle (rejected — class always nests in role).

## Approach (chosen)

Rework `RpbView.tsx` presentation only. Two render modes over the same `RpbRow[]`:

- **Rows view** — the current per-role table shape, but: (a) each metric cell gets a
  heatmap class; (b) the secondary metrics currently in the badge sub-row are promoted
  to real columns; (c) within a role, players are sorted/clustered by class under a
  small class sub-heading, and the player-name cell shows a class-color dot + left
  border.
- **Cards view** — one card per player; class-tinted header with class dot; the worst
  issues surfaced as colored chips; remaining metrics as compact key/value lines. Cards
  flow responsively (wrap), good for narrow screens.

A single toggle switches between them. The selected mode is **persisted in
localStorage** (consistent with theme/role overrides).

## Components & Structure

- `RpbView.tsx` — owns the view-mode state, renders the toggle, the legend, and maps
  over `ROLES`. Within each role it groups rows by class (stable class order), then
  delegates to the active view.
- **Grouping helper** — given the role's `RpbRow[]`, return an ordered list of
  `{ className, rows[] }`. Class order: a fixed canonical order (e.g. the WoW class
  list) with any unknown class appended; players within a class sorted by name (matches
  the existing `playerName` sort).
- **Rows view** (`RpbRowsTable` or inline) — one `<table>` per class group under a
  class sub-heading, OR one table per role with class sub-heading rows. Decide in
  planning; mockup used one table per class group under a class band heading.
- **Cards view** (`RpbCards` or inline) — `.cardgrid` of `.pcard` per player.
- **Class color map** — new constant mapping WCL class name (`Player.class`, e.g.
  `"Warlock"`) → hex color, plus a helper for a legible header tint (white/Priest and
  yellow/Rogue need a darkened or low-alpha variant on light backgrounds, and must also
  work in dark mode). Lives in `apps/web` (presentation concern), e.g. `lib/classColors.ts`.
- **Heatmap classifier** — maps a metric value to a severity bucket → CSS class. Reuse
  the existing `severity` convention where it already exists; extend with value-based
  buckets for metrics that currently have none (deaths, active %, uptimes…). Keep the
  per-tab `sev-*` CSS-class convention already used across tabs.

## Data Flow

`report` → `rpb(report, cfg)` (unchanged) → `RpbRow[]` → apply role overrides
(unchanged) → **group by class within role (new)** → render via active view (new). View
mode read from / written to localStorage (new `storage.ts` helpers, mirroring
`saveTheme`/`loadTheme`).

## Styling

- Add view-toggle, class-band heading, heatmap cell, and card styles to the web CSS
  (`theme.css`/`index.css`), following the existing severity-color convention
  (core `severity` + `sev-*` classes). Heatmap greens/yellows/reds must have dark-mode
  variants.
- Class colors as CSS custom properties so dark mode can adjust tints.

## Error / Edge Handling

- `rpb(...) === null` (report cached before RPB support): keep the existing "refresh
  from WCL" message.
- A role group with no players: skip the section (current behavior).
- Unknown / missing `class` string: fall back to a neutral color and an "Unknown" class
  band; never crash.
- Empty metric values render as today (`—` / `0`) but with a neutral (not alarming)
  heatmap class.

## Accessibility

- Toggle is a real button group with `aria-pressed` (or radio group); keyboard operable.
- Class color is never the *only* signal — class name appears as text in the band /
  card header (color-blind safe).
- Heatmap color is never the only signal — the numeric value stays in the cell.
- Preserve existing `sr-only` labels and the per-row role `<select>`.

## Testing

- Extend `RpbView.test.tsx`: renders both views; toggle switches and persists; players
  are grouped under the correct class band within their role; class color applied;
  heatmap class applied to a known good and a known bad value; role override still works;
  null-result message still shown.
- Class color map + grouping helper + heatmap classifier are pure functions → unit test
  directly.

## Open Questions (resolve in planning, not blocking)

- Rows view: one `<table>` per class group vs. one table per role with class sub-heading
  rows. Mockup used per-class-group tables.
- Exact heatmap thresholds per metric (tuning) — start simple, refine later; this mirrors
  the deferred tuning note already in `rpb.ts` `severityFor`.
