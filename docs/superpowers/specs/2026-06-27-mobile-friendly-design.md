# Mobile-Friendly WCL Analyzer — Design

**Date:** 2026-06-27
**Status:** Approved (design); pending implementation plan

## Goal

Make the web app (`apps/web`) fully usable on a phone. Every report view must be
readable without sideways page scrolling, all navigation must be reachable, and
touch targets must be comfortable. Desktop and tablet layouts stay as they are
today except for minor fluid tweaks.

The app has three screens:

- **Home** — report setup / load.
- **Report** — a `ReportHeader` + `LensBar` (category tabs, mode/lens toggles,
  fight chips) plus dense data-table views.
- **Settings** — WCL credentials.

The hard part is the Report screen: it contains wide data tables (gear listing
has 17 columns, plus rankings grid, consumables matrix, role casts, shadow res)
that cannot work as tables on a ~375px screen.

## Decisions (from brainstorming)

- **Scope:** fully usable on phone (not just "not broken").
- **Wide tables:** become **per-player cards** on phones.
- **Navigation:** **hamburger drawer** on phones.

## 1. Mechanism & breakpoints

- Add a `useMediaQuery(query: string): boolean` hook in `src/lib/`. It mirrors
  the existing `matchMedia` usage in `src/lib/theme.ts`: read the initial match,
  subscribe to changes, clean up the listener. Must be SSR/jsdom-safe (guard
  `window.matchMedia` existence; default to `false` when unavailable).
- Two breakpoints, kept in sync between JS and CSS:
  - **phone:** `(max-width: 640px)` → card mode for dense views + drawer nav.
  - **tablet:** `641px–900px` → existing/added fluid CSS tweaks only, no cards,
    no drawer.
- Table↔card switching is done by **JS conditional render** (a
  `useMediaQuery("(max-width: 640px)")` branch in each affected view), not by
  CSS `display` hacks on `<table>` — cleaner DOM and unit-testable.
- Everything that is not a table↔card switch is handled with **pure CSS**
  `@media` rules (header slimming, spacing, wrapping, touch-target sizing,
  one-column stacking on Home/Settings).

## 2. Navigation — hamburger drawer (phone only, ≤640px)

- **Slim top bar** replaces the full `ReportHeader` row on phones: report title
  (truncated with ellipsis) + active-category label + a menu (hamburger) button.
- **Drawer:** the menu button opens a slide-out panel containing the controls
  currently spread across the header and lens bar:
  - category tabs
  - mode / lens toggles
  - raid (report) switcher
  - theme toggle
  - share-to-Discord action
- **Drawer behavior:** closes on item selection, on backdrop tap, and on `Esc`.
  Focus is trapped while open; body scroll is locked while open; the menu button
  has correct `aria-expanded` / `aria-controls`.
- **Fight chips** render as a horizontally-scrollable strip directly below the
  slim bar (they are a timeline; cards do not fit). Momentum scroll, no page
  overflow.
- **≥641px:** `ReportHeader` and `LensBar` render exactly as today. The drawer
  and slim bar do not mount.

## 3. Wide tables → per-player cards (phone only, ≤640px)

A shared card primitive backs every view so the look is consistent and we do not
reinvent cards per view:

- **`StatCard`** component + `.stat-card` styles: a card with a header region
  (player name, class-colored exactly as the current table rows) and a body of
  **label/value rows**. Values keep their existing severity classes (`sev-major`
  / `sev-moderate` / `sev-minor` / `sev-ok`) so the red/yellow/green encoding
  still reads. Where a view renders uptime bars / percentages, the card row
  reuses the same formatting component as the table cell.

Each affected view gets a card renderer alongside its existing table renderer and
chooses between them via `useMediaQuery`:

- **Gear listing** (`GearListingView` / `GearMatrix`) → one card per player;
  rows are slot → item.
- **Gear issues** (`GearIssuesView`) → one card per player listing only that
  player's flagged items.
- **Consumables** (`ConsumablesView` / `ConsumableMatrix`) and **Buff
  consumables** → one card per player; rows are each consumable column with its
  uptime/percent formatting.
- **Rankings** (`RankingsGrid` / `SummaryRankings`) → one card per player; rows
  are each metric.
- **Role casts / role sheet / player profile** tables
  (`RoleCastsTable`, `RoleSheetTable`, `PlayerProfile`) → label/value card rows.
- **Shadow res** (`ShadowResView`) → one card per player; rows are per-slot
  contributions.

No data, sorting, filtering, or severity logic changes — only the presentation
layer branches.

## 4. Touch & polish (all small screens)

- Minimum **44px** tap targets on nav items, toggles, chips, and buttons; larger
  tap padding on links rendered inside cards.
- **Home** and **Settings:** stack multi-column grids into one column,
  full-width inputs and primary buttons. (Home is largely there already — verify
  and fix gaps rather than rebuild.)
- No horizontal **page** scroll down to a 320px viewport; long report IDs and
  player names wrap or ellipsize rather than force overflow.

## 5. Testing

- Unit-test `useMediaQuery` with a mocked `window.matchMedia`
  (initial value + change event).
- For each card-switching view, add a test that mocks `matchMedia` to assert the
  **card renderer** appears at ≤640px and the **table** appears at ≥641px.
- Existing table-based tests continue to pass: default jsdom width is desktop, so
  they exercise the table branch unchanged.
- Drawer: test open/close via button, backdrop, and `Esc`; assert
  `aria-expanded` reflects state.

## Non-goals

- No redesign of desktop/tablet layouts beyond minor fluid tweaks.
- No change to analysis logic, data shapes, or `SCHEMA_VERSION` (presentation
  only; cache is unaffected).
- Fight chips remain a scroll strip on phone — not converted to cards.

## Implementation sequence

1. `useMediaQuery` hook + breakpoint constants (+ tests).
2. Drawer nav + slim top bar (phone) wired into `ReportPage`.
3. Shared `StatCard` primitive + `.stat-card` styles.
4. Per-view card renderers (gear listing, gear issues, consumables, buff
   consumables, rankings, role casts/sheet, player profile, shadow res).
5. Touch-target + Home/Settings stacking polish; 320px overflow audit.

Each step is independently verifiable (build + tests + manual check at a phone
viewport).
