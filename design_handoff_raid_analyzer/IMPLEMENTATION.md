# Implementation Notes — wiring the redesign to the real codebase

This redesign is a **view-layer change** for `apps/web`. Keep `packages/core` (analysis),
`packages/data` (reference JSON), and `apps/api` (WCL proxy/normalize/cache) unchanged. Every
screen maps to data that the app already computes — below is the mapping. **Do not port the
prototype's mock-data generators.**

## View → data source

| Redesign view | Real data source (already exists) |
|---|---|
| Home / paste link | `apps/web/src/pages/HomePage.tsx` (URL/id parse) → route to report |
| Report header (title/zone/date) | `ReportData.title`, `.zoneName`, `.startTime` via `useReport(reportId)` |
| Lens: fight chips | `ReportData.fights` filtered to bosses (`isBoss`, `kill`); use `filterFights` / `listGearFights` |
| Lens: player roster | `ReportData.players` (id, name, class); colors via `lib/classColors.ts` |
| **Summary (rankings)** | `ReportData.rankings` (`ReportRanking[]`, WCL parse percentiles per ranked boss, grouped by role). Color with the parse scale in README. If `rankings` is undefined (older cache) show the existing "Refresh from WCL" notice. |
| Performance (per role) | `rpb(report, cfg)` from `@wcl/core` → `RpbRow[]` (deaths, interrupts, `totalAvoidableDamageTaken`, activity/uptime, severity). Group by `row.role`; role auto-detect + per-character override already in `lib/storage.ts` (`loadRoleOverrides`). Consumables column from `rpbConsumables(report, …)`. |
| Gear (per fight) | `gearListing(report, fightId)` + `gearIssues(...)` from `@wcl/core`; slots `LISTING_SLOTS`/`SLOT_NAMES`; severity → heat classes (existing `GearListingView.tsx` does exactly this). |
| Consumables matrix | `rpbConsumables(report, rpbConsumablesData)` → `RpbConsumableRow[]` (existing `ConsumableMatrix.tsx`). |
| Drums | `drums(report, { drums: drumSpells })` → rows (existing `DrumsView.tsx`). |
| **By-Player profile** | Aggregate the SAME functions per player: pick the player's `RpbRow` (across boss fights), their `gearListing`/`gearIssues` rows, their `rpbConsumables` row, and per-boss numbers by running/reading metrics per fight. No new core logic needed — it's a re-projection of existing outputs keyed by player instead of by fight. |
| Settings | `apps/web/src/pages/SettingsPage.tsx` — `loadCredentials/saveCredentials` + webhook helpers in `lib/storage.ts` + `lib/discord.ts` (`isValidWebhookUrl`). Just restyle to the cards in the README. |
| validate / shadow resi / fight timeline | Not in the prototype. Add as additional By-Boss-Fight categories using existing `ValidateView` / `ShadowResView` / `TimelineView`. |

## Reuse, don't rebuild
- **Heatmap**: `apps/web/src/lib/heatmap.ts` (`heatClass`, `relativeHeat`, `deathsHeat`,
  `uptimeHeat`, etc.) — the prototype's green/amber/red is the same model. Map the README hex
  values into the existing `sev-*` / heat CSS or theme vars.
- **Class colors**: `lib/classColors.ts` (`classColor`, `classColorVar`, `CLASS_ORDER`). The
  prototype lightened Priest/Shaman/Warlock for the dark bg — apply those only in dark theme.
- **Severity**: core results already carry `severity` (`IssueSeverity`, `RpbSeverity`); render
  with the existing `SeverityLegend` + `sev-*` classes (`index.css`).
- **Theme**: app is CSS-variable driven with a `[data-theme="dark"]` block in `theme.css`. The
  redesign IS the dark direction — make these tokens the dark theme (and/or a new "raid" theme).
- **Refresh-notice pattern**: views already show a "cached before X — Refresh from WCL" message
  when an optional `ReportData` field is missing (`rpb()` / `drums()` return `null`). Keep it
  for Summary (`rankings`) and any newer fields.

## Suggested file plan (apps/web)
- Replace the separate CLA/RPB routes with one report shell, e.g. `pages/ReportPage.tsx`
  holding the **lens toggle** + **context strip** + **category subnav**, reading
  `?lens=&fight=&player=&cat=` from the URL (so links are shareable, matching today's model).
- New components:
  - `components/LensBar.tsx` (toggle + fight chips + roster search/chips)
  - `components/SummaryRankings.tsx` (role-grouped parse tables from `report.rankings`)
  - `components/PlayerProfile.tsx` (the By-Player dashboard; composes existing analyses)
- Keep/restyle: `RpbView`/`RpbRowsView` (Performance), `GearListingView`, `ConsumableMatrix`,
  `DrumsView`, `SettingsPage`, `HomePage`.
- Sidebar: the old `Home / CLA / RPB / Settings` nav can stay or simplify; CLA/RPB become the
  two lenses of one report rather than separate destinations.

## Theming approach
Implement the palette as CSS variables (extend `theme.css`). The prototype uses inline styles
only because of its authoring environment — in `apps/web` use the existing variable system and
component CSS. Numbers/ids/durations → a monospace token (JetBrains Mono); headings → Marcellus;
everything else → Archivo. Add the three font `<link>`s (or self-host) and a `--font-mono` /
`--font-display` var.

## Starter prompt for Claude Code
> Restructure `apps/web` to a single report experience with a **two-lens model** (By Boss Fight
> / By Player), per the attached `design_handoff_raid_analyzer/` (open `Raid Analyzer.dc.html`
> and read `README.md` + this file). Keep `packages/core`, `packages/data`, and `apps/api`
> unchanged — wire each view to the existing functions in the table in `IMPLEMENTATION.md`
> (`rpb`, `gearListing`/`gearIssues`, `rpbConsumables`, `drums`, and `report.rankings` for the
> new Summary tab). Add a Summary/rankings category as the default landing view. Reuse
> `lib/classColors.ts`, `lib/heatmap.ts`, `SeverityLegend`, and the `theme.css` variable system;
> make the dark palette in the README the dark theme. Add the By-Player profile as a
> re-projection of the existing per-player analysis outputs (no new core logic). Restyle
> `HomePage` and `SettingsPage` to match. Keep selection state in the URL so report links stay
> shareable. The prototype uses mock data — do not port it.
