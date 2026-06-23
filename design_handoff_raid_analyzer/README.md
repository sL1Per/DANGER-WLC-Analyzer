# Handoff: WCL Raid Analyzer — Frontend Redesign

## Overview
A redesign of the WCL Raid Analyzer (WoW Classic TBC combat-log analysis tool) frontend.
The central change is a **two-lens navigation model** that makes it always possible to
slice the report **by boss fight** (everyone on one pull) or **by player** (everything one
raider did, all night). The visual language is a dark, dense "raid-tool" aesthetic with WoW
class colors and a problem/watch/fine heatmap, designed to be readable by non-expert guild
members.

It covers the full report experience:
- **Home / paste-link** entry screen
- **By Boss Fight** lens → Summary (rankings), Performance, Gear, Consumables, Drums
- **By Player** lens → single-raider profile
- **Settings** (WCL API credentials + Discord webhook)

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype
showing the intended look, layout, and interaction. **They are not production code to copy
directly.** The prototype is a single self-contained component (`Raid Analyzer.dc.html`)
driven entirely by **mock data**.

The task is to **recreate these designs inside the existing codebase**
(`apps/web`, a React 19 + Vite SPA) using its established patterns, and to **wire every view
to the real analysis functions in `@wcl/core`** rather than reimplementing logic or shipping
the mock data. This is fundamentally a **view-layer / information-architecture change** — the
core analysis engine and API stay as they are.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions are specified below and
present in the prototype. Recreate the UI to match using the codebase's existing libraries
(the app is already CSS-variable-driven with a light/dark theme — see `apps/web/src/theme.css`
and `index.css`). Reuse the existing `classColors.ts`, `heatmap.ts`, and `SeverityLegend`
helpers; this redesign extends them rather than replacing them.

---

## Information Architecture (the big change)

Today the app has two separate left-nav destinations — **CLA** (`/cla/:id`: gear issues, gear
listing, buff consumables, drums, validate, shadow resi, fight timeline) and **RPB**
(`/rpb/:id`: role performance). Filtering exists only on the gear-listing tab.

The redesign collapses this into **one report experience with a lens toggle**:

```
Home (paste link) ──Analyze──▶ Report
                                 │
                                 ├── Lens: BY BOSS FIGHT  (pick a pull → see everyone)
                                 │     └── category tabs: Summary · Performance · Gear · Consumables · Drums
                                 │
                                 └── Lens: BY PLAYER       (pick a raider → see everything)
                                       └── single scrolling profile

Settings (gear icon, from header or home)
```

- The **lens toggle** is a persistent segmented control at the top of every report view.
- **By Boss Fight**: a horizontal strip of fight chips (kill/wipe badge, duration) is always
  visible; selecting one re-scopes the category tabs below it.
- **By Player**: a searchable, class-colored roster of chips is always visible; selecting one
  shows that raider's profile. Player names everywhere else (tables) are clickable and jump
  into this lens.
- **Summary** is the default landing category and is **report-level** (spans all ranked
  bosses), so it ignores the selected fight.

The existing `validate`, `shadow resi`, and `fight timeline` tabs are **not** in this
prototype — fold them into the By-Boss-Fight category list when you implement (same pattern).

---

## Screens / Views

### 1. Home / Paste Link
- **Purpose**: Entry point — paste a WarcraftLogs report URL or id to load it.
- **Layout**: Full-viewport, vertically + horizontally centered column on the dark radial
  background. Brand lockup (52px gold rounded-square mark "W" + "Raid Analyzer" in Marcellus
  27px + uppercase subtitle), then a 560px-max card.
- **Card** (`#101218`, 1px `#1c1f29` border, radius 18px, padding 30px, shadow
  `0 24px 70px rgba(0,0,0,.45)`):
  - `h1` "Analyze a raid" (Marcellus 23px, weight 400)
  - copy: "Paste a WarcraftLogs report URL or id to begin." (`#9aa0ac`, 13.5px)
  - input row: `#15171f` bg, 1px `#2a2f3b` border, radius 11px; a faint `↗` glyph + a
    JetBrains-Mono input, placeholder `https://classic.warcraftlogs.com/reports/…`
  - **Analyze** button (gold gradient `linear-gradient(150deg,#d4a84a,#a8842e)`, text `#1a1206`,
    radius 9px, weight 700) + "or load a sample report →" text button (`#9aa0ac`)
  - footer row: 24h-cache note + "⚙ Settings" text button
- **Behavior**: Enter key in the input or clicking Analyze → `loaded = true` (open report).
  "load a sample" → load with a demo id. ⚙ Settings → settings view.

### 2. Report Header (shown in all loaded/settings views)
- Sticky top bar, `#0d0e13`, 1px bottom border `#1c1f29`, padding 16px 28px, `z-index:30`.
- Left: clickable brand lockup (38px gold mark + "Raid Analyzer" Marcellus 19px + uppercase
  subtitle "TBC Classic · Combat Log Analytics"). Clicking it returns Home.
- Center: report identity (title bold 14px + "zone · 25 players · date" 12px muted), with a
  left divider.
- Right: a tiny severity legend (problem/watch/fine swatches), then **Settings**, **New
  report**, **Refresh from WCL** buttons (`#161922` bg, 1px `#262a35`, radius 8px, 12px).

### 3. Lens Bar (sticky, below header at `top:71px`)
- Segmented toggle in a `#15171f` pill (4px padding, 1px `#242935`, radius 11px): two buttons
  **By Boss Fight** / **By Player**. Active button: gold gradient bg, dark text `#1a1206`,
  gold border. Inactive: transparent bg, `#9aa0ac` text.
- A one-line hint to the right ("Reviewing one boss pull — everyone who was there." /
  "Reviewing one raider — everything they did, all night.").
- **Context strip** (changes by lens):
  - *By Boss Fight*: wrapping row of **fight chips** (min-width 170px, `#13151c` bg / selected
    `#1c2030` + gold border): boss name + Kill/Wipe pill (green/red tint) + "duration · 25
    players" in JetBrains Mono.
  - *By Player*: a 240px search input ("Filter raiders…") + a wrapping row of **player chips**
    (class-colored dot with glow + name; selected = class-colored border + `#1c2030`),
    sorted by class then name.

### 4. By Boss Fight → Summary (rankings) — DEFAULT
- **Purpose**: At-a-glance roster ranking across all killed bosses (the requested addition).
- Intro line explaining the percentile colors. Then **three role groups** in order:
  **Damage Dealers** (caster + physical), **Healers**, **Tanks**. Each is a bold 14px label +
  a table card.
- **Table**: columns = `Player | Avg | <one column per ranked boss>`. Rows sorted by **Avg
  descending**. Player cell: 3px class-color left border + class dot + name (`#d4d6dd`,
  clickable → By-Player lens). All numeric cells are the **WCL parse percentile** colored by
  the parse scale (see Design Tokens). `Avg` is bold.
- Header row `#13151c`, sticky first column, uppercase 11px `#7c818d` column labels.

### 5. By Boss Fight → Performance (the hero view)
- **Purpose**: Review one pull — everyone, grouped by role, with plain-language metrics.
- **Summary banner**: boss name (Marcellus 24px) + Kill/Wipe pill, then right-aligned stat
  readouts: Duration, Deaths, Under-consumed, Gear flags (value colored by severity).
- **Category subnav**: tabs `Summary · Performance · Gear · Consumables · Drums` (active = gold
  bottom-border 2px + white text; inactive `#8b909d`).
- **Per-role sections** (Tanks → Healers → Casters → Melee & Ranged): a role label with a
  colored bar + count pill, then a table card. Columns:
  `Player | Spec | Deaths | Avoidable dmg | Interrupts | Uptime | Consumables | Gear flags`.
  - Player cell sticky, class dot + class-colored name, clickable.
  - Numeric cells use the heatmap (green/amber/red bg+text). Deaths: 0=green. Avoidable &
    Uptime are **relative** (min–max across the raid for that fight). Consumables shows
    Full/Partial/Missing. Interrupts show "—" for tanks/healers. Gear flags = issue count.

### 6. By Boss Fight → Gear
- Wide table: `Player | Head | Neck | Shoulders | Cloak | Chest | Hands | Legs | Weapon`
  (sticky player column). Each cell = item name; flagged items get a red (major) or amber
  (moderate) tinted bg and a `title` tooltip with the reason (e.g. "No enchant", "PvP item").

### 7. By Boss Fight → Consumables
- Matrix: rows = consumable types, columns = players (vertical class-colored headers, sticky
  first column). Each cell = a use count, colored as a **per-row relative heatmap** (green =
  top user, red = none). All-zero rows stay neutral. Intro line explains it.

### 8. By Boss Fight → Drums
- Table of the shaman corps: `Player | Battle | War | Restoration | Wasted | Total | Score`.
  Battle/War/Resto show `count (⌀ avg)`. Wasted is heat-colored (0 = green). Score in gold.

### 9. By Player → Profile
- **Purpose**: Everything one raider did, easy for non-experts to read.
- **Header**: 58px class-colored rounded-square avatar (initials) with class glow, name
  (Marcellus 27px in class color), "Class · Spec · Role" subtitle, and a right-aligned
  **verdict pill** (Exemplary/Solid/Needs attention/Major concerns, severity-colored) + a
  one-line plain-language note.
- **Stat tiles** (responsive grid, min 150px): Deaths, Avoidable dmg, Avg uptime, Interrupts,
  Consumables, Gear flags. Each tile: `#101218` card, 3px colored left accent, big JetBrains-
  Mono value (severity colored), uppercase label, sub-caption.
- **Two-column body**:
  - Left: **Per-boss breakdown** table (Boss | Deaths | Avoidable | Uptime, heat-colored) +
    **Consumables & buffs** list (dot + label + count, colored by good/ok/missing).
  - Right: **Gear & enchants** panel — a clean-flag summary + a list of slots (slot label +
    item name + an issue pill when flagged).

### 10. Settings
- Report header (with Done button) over a 620px-max centered column.
- **WCL API credentials** card: intro with a link to `classic.warcraftlogs.com/api/clients`,
  **Client ID** text input, **Client secret** password input, **Save** button (gold) +
  "✓ Saved to this browser" confirmation. Copy: stored only in this browser.
- **Discord webhook** card: explanatory copy (create under Channel Settings → Integrations →
  Webhooks; posted directly to Discord, never reaches the server; blank to remove), **Webhook
  URL** input, **Save webhook** button + confirmation.

---

## Interactions & Behavior
- **Lens toggle**: instant switch; each lens keeps its own context selection.
- **Fight chip / player chip / category tab**: click to select; selected state styled as above.
- **Player names in any table** → navigate to the By-Player lens for that player.
- **Brand lockup / "New report"** → Home. **Settings / ⚙** → Settings. **Done** → back.
- **Home input**: Enter or Analyze loads the report.
- **Heatmaps**: deaths/avoidable/uptime/consumables/flags map to green (good) / amber (watch) /
  red (problem). Avoidable & uptime in the Performance table are relative to the selected
  fight's raid min–max; everywhere else they use absolute thresholds.
- **Settings Save**: shows an inline "✓ Saved to this browser" message (persist to
  localStorage in the real app — see existing `storage.ts`).
- No page-level animations are required (a subtle fade is optional; the prototype's was removed
  to avoid a rendering quirk).

## State Management
Prototype state (recreate with the codebase's routing + hooks, not a single component):
- `lens`: `"fight" | "player"`
- `fightId`: selected boss-fight id (By Boss Fight)
- `playerId`: selected raider id (By Player)
- `cat`: `"summary" | "performance" | "gear" | "consumables" | "drums"`
- `query`: roster search text
- `loaded`: whether a report is open (Home vs Report)
- `settings`: whether the settings view is open
- `wclId` / `wclSecret` / `webhook`: settings field values (→ localStorage)

In the real app these largely already exist: report loading via `useReport(reportId)` and the
router (`/cla/:id`, `/rpb/:id`); per-character role overrides + view mode + tab in `storage.ts`;
credentials + webhook in `storage.ts`. The lens/category/selection state is new local UI state.

## Design Tokens

**Fonts** (Google Fonts): `Marcellus` (display/headings/brand), `Archivo` (400–800, all UI
text/labels), `JetBrains Mono` (400–700, all numbers/ids/durations).

**Core palette**
| Token | Hex |
|---|---|
| App background (base) | `#0c0d11` (radial highlight `#15171f` top-right) |
| Panel / card / table body | `#101218` |
| Header / chip resting | `#0d0e13` / `#13151c` |
| Selected chip / row tint | `#1c2030` / `#15171f` |
| Borders | `#1c1f29` (panel), `#242935` / `#2a2f3b` (controls), `#181b23` (row) |
| Text primary | `#e8e9ee` |
| Text secondary | `#c9ccd4` / `#d4d6dd` |
| Text muted | `#9aa0ac` / `#8b909d` / `#7c818d` |
| Text faint | `#6f7480` / `#5b616d` |
| **Accent gold (primary)** | `#d4a84a` (gradient `linear-gradient(150deg,#d4a84a,#a8842e)`, deep `#7a5a18`) |
| On-accent text | `#1a1206` |

**Severity heatmap**
| State | Text | Background |
|---|---|---|
| good (green) | `#7fd6a0` | `rgba(91,191,134,.13)` |
| watch (amber) | `#e6bd56` | `rgba(214,168,60,.14)` |
| problem (red) | `#f0908f` | `rgba(214,90,90,.16)` |
| neutral | `#8b909d` | transparent |

**WCL parse-percentile scale** (Summary tab) — by percentile value:
`100 → #e6c87d` · `99 → #e87fb0` · `95–98 → #ff8a3d` · `75–94 → #b06bf0` ·
`50–74 → #4a9eff` · `25–49 → #5bbf5b` · `0–24 → #8b909d`.

**WoW class colors** (already in `apps/web/src/lib/classColors.ts`; the prototype lightens two
for dark-bg readability):
Warrior `#C79C6E` · Paladin `#F58CBA` · Hunter `#ABD473` · Rogue `#FFF569` ·
Priest `#E6E7EC` (was `#FFFFFF`) · Shaman `#3D8BEF` (was `#0070DE`) · Mage `#69CCF0` ·
Warlock `#9A86D6` (was `#9482C9`) · Druid `#FF7D0A`.

**Role accents**: tank `#d4a84a` · healer `#5bbf86` · caster `#9A86D6` · physical `#e0894a`.

**Radii**: pills/chips/inputs 8–11px · cards 12–18px · stat tiles 12px · small badges 5–6px.
**Shadows**: cards `0 24px 70px rgba(0,0,0,.45)` (home), accent glow
`0 0 0 1px rgba(212,168,74,.35), 0 6px 16px rgba(212,168,74,.18)`.
**Spacing**: page padding 24–28px · card padding 26–30px · table cell padding ~7–14px ·
section gaps ~18–26px.

## Assets
No external images. The only iconography is simple inline glyphs/SVGs (home/people/gear in the
existing sidebar; small CSS shapes for the lens toggle and dots). No Anthropic brand assets.
Use the codebase's existing `public/icons.svg` sprite where icons are needed.

## Files
- `Raid Analyzer.dc.html` — the full interactive design reference (open in any browser).
- `Raid Analyzer.standalone.html` — same design bundled to a single offline file (if present).
- `IMPLEMENTATION.md` — concrete mapping of each view to the existing `@wcl/core` /
  `apps/web` code, plus a suggested file plan and a starter Claude Code prompt.

> Reminder: the prototype renders **mock data**. Implement against the real `@wcl/core`
> functions and the normalized `ReportData` from `apps/api`; do not port the mock generators.
