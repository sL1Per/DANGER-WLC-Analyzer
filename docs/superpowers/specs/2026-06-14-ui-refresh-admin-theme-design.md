# UI Refresh — Admin Dashboard Theme

**Date:** 2026-06-14
**Scope:** `apps/web` only. Visual reskin + new app shell. No business logic, data, or API changes.

## Goal

Refresh the WCL Raid Analyzer web UI to match the look and feel of a reference
admin dashboard (`/Users/pviegas/Documents/Pica/docs/images/admin-dashboard.png`):
a light, calm interface with a persistent white left sidebar, a soft cool-gray
canvas, rounded white cards, an indigo primary accent, coral warnings, green
positives, and serif display headings.

The current UI is a plain centered single-column layout with a text-link top nav
and unstyled tables. This refresh keeps all existing functionality and routes; it
only changes layout shell, structure of page chrome, and styling.

## Decisions (locked)

- **Layout:** adopt the reference's **sidebar shell**.
- **Typography:** **serif display headings**, **system serif stack** (no webfont
  download) — `"Iowan Old Style", "Palatino", Georgia, serif`. Body/tables remain
  sans-serif.
- **Severity colors:** keep the red/yellow/green semantics from the original
  sheet, **harmonized** to the new palette.
- **Sidebar contents:** **Home** and **Settings** only (no Recent reports list
  this pass).
- **Primary accent:** indigo `#2f3ae0`.

## Design tokens (`apps/web/src/theme.css`, CSS custom properties on `:root`)

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#eef1f5` | page background |
| `--surface` | `#ffffff` | sidebar + cards |
| `--border` | `#e6e8ee` | card borders |
| `--hairline` | `#eceef2` | table/list dividers |
| `--text` | `#14161c` | primary text |
| `--text-muted` | `#5b6472` | secondary text |
| `--text-subtle` | `#8a93a3` | captions, meta |
| `--primary` | `#2f3ae0` | buttons, active nav, links |
| `--primary-hover` | `#2530c4` | button/link hover |
| `--primary-tint` | `#eaecfb` | active nav bg, focus ring |
| `--danger` | `#b3261e` | warning text, "wipe" |
| `--danger-bg` | `#fde9e6` | warning surfaces |
| `--danger-border` | `#f6c9c2` | warning borders |
| `--warn` | `#8a6d00` | moderate severity text |
| `--warn-bg` | `#fdf4e3` | moderate severity bg |
| `--positive` | `#1f7a3e` | "kill", positive text |
| `--positive-bg` | `#e7f6ee` | positive surfaces |
| `--radius-card` | `16px` | cards |
| `--radius-control` | `10px` | inputs, buttons |
| `--radius-pill` | `999px` | chips, segmented controls |
| `--shadow-card` | `0 1px 3px rgba(16,24,40,.06)` | card lift |
| `--font-serif` | `"Iowan Old Style", "Palatino", Georgia, serif` | display headings |
| `--font-sans` | `system-ui, "Segoe UI", Roboto, Arial, sans-serif` | body |

## Components / files

### New: `apps/web/src/components/AppShell.tsx`
- Persistent left sidebar (~250px, `--surface`): brand mark + "WCL Raid Analyzer";
  nav items (icon + label) **Home**, **Settings**, with active state via
  `NavLink` (`--primary-tint` bg, `--primary` text); small footer.
- Icons: inline SVG (no dependency).
- Main region: `--canvas` background, content max-width container holding page cards.
- Responsive: below ~720px the sidebar collapses to a top bar (CSS only, no JS
  state required for first pass — a simple horizontal nav).

### Changed: `apps/web/src/App.tsx`
- Wrap `<Routes>` in `<AppShell>`. Routes unchanged.

### Changed: `apps/web/src/index.css`
- Import `theme.css`.
- Replace `#root` centered-column rules (shell now owns layout).
- Restyle globally using tokens: cards (`.card`), tables (light header row,
  hairline rows, no heavy borders), inputs/buttons (rounded controls, primary +
  outline variants), `[role=alert]`/`[role=status]`, chips.
- Add `.segmented` pill nav style for tab/filter rows.
- Harmonize `.sev-*` rules to the new tokens (semantics unchanged).

### Changed pages (markup-light, structure only)
- `HomePage.tsx`: wrap in a centered `.card`; serif `h1`; pill input + primary button.
- `ReportPage.tsx`: header card (serif title); tab nav → `.segmented`; "Refresh
  from WCL" → outline button; each tab body in a `.card`.
- `SettingsPage.tsx`: form inside a `.card`; labeled rounded inputs.
- `ReportSummary.tsx`: header into card; fight-filter `fieldset` → segmented
  toolbar; tables restyled (inherited); players list optionally rendered as
  initial chips.

## Non-goals

- No change to report tabs' data, columns, or computations.
- No webfont download.
- No Recent reports tracking.
- No card/widget redesign of individual report tabs beyond wrapping them in cards
  and inheriting the new table style.

## Testing / verification

- Existing component tests must still pass (`pnpm --filter @wcl/web test` /
  `npm test`); they assert on roles/text, not styling, so should be unaffected.
- Manual: run the dev server, confirm Home, Settings, and a report's 8 tabs render
  in the new shell with the palette applied, and severity colors still read
  correctly. Confirm narrow-width collapse.

## Risks

- Tests query `nav`, `[role=alert]`, labels — keep these roles/labels intact when
  restructuring markup. Verify after each page change.
