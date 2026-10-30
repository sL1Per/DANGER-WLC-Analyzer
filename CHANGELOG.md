# Changelog

All notable changes to the DANGER Raid Analyzer are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [Semantic Versioning](https://semver.org/).

The version lives in the root [`package.json`](package.json) and is shown in the
app's footer. Versions before 1.4.0 were assigned after the fact, grouping the
commit history into its main milestones.

## [Unreleased]

## [1.4.0] — 2026-10-30

First release published with a version number.

### Added
- **Auto-posting of new raids.** A GitHub Actions job finds the guild's finished
  logs from the last 48 hours, publishes a snapshot of each, and posts the link to
  Discord. When two raiders log the same raid, only one log is posted. A Cloudflare
  cron trigger starts the job every 15 minutes, since GitHub's own schedule often
  runs late. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **Resistances per boss.** The tab shows the school that matters on each fight:
  Shadow on Mother Shahraz, Fire on Illidan.
- A site-wide footer with credits, a link to the GitHub repository, and the app
  version (linked to this changelog).

### Changed
- The Resistances tab only appears on a Shahraz or Illidan pull. It no longer shows
  on the combined BOSSES card or on fights where resistance doesn't matter.
- The Improvements tab was removed.
- The home page now says reports are cached in this browser. The old "24h" text
  described the server cache that was removed in 1.1.0.

### Fixed
- Shattrath flasks are counted by the aura they leave at pull time.
- Duplicate raid logs are detected by their shared boss pulls instead of by roster.
  WCL includes bystanders in a report's player list, so rosters were unreliable.

## [1.3.0] — 2026-09-07

### Added
- **Totem twisting**: a per-fight air-totem timeline for shamans showing whether
  Windfury or Grace of Air held the slot, with uptime for each totem.
- **Timeline tab**: a per-boss timeline that merges casts and damage, with search
  and filter pills.
- Demoralizing Shout and Expose Armor uptime and cast counts in Role Breakdown.
- A fight/player picker dropdown in place of the chip strip.

### Changed
- New "Forged" look for light and dark themes, with Spectral as the display font.
  Tables are always compact.
- Reports open on the Rankings tab by default.
- The Player details lens was removed.
- The theme toggle moved from the app shell into Settings.

### Fixed
- Rankings ask WCL for the Historical bracket. A character that bracket hasn't
  ranked yet falls back to Today's bracket instead of being dropped.
- Shadow Resistance counts gems and armor-kit/glyph enchants.
- Windfury extra attacks are matched by name, including attacks from Windfury
  Totem on non-shaman melee.
- The "BT / Hyjal" combined T6 zone is accepted.
- Enhancement shamans without a ranking spec are classified as physical DPS.
- Failed best-effort WCL fetches are logged instead of being silently ignored.

## [1.2.0] — 2026-07-12

### Added
- Deployment to Cloudflare: the web app on Workers static assets, and the snapshot
  store on a Worker backed by KV.
- Snapshots are gzip-compressed before upload, so full raid reports fit within KV
  and free-tier CPU limits.

### Fixed
- The share upload limit was raised to 24 MB for large reports.
- A trailing slash on `VITE_API_BASE` is removed.

## [1.1.0] — 2026-06-28

### Added
- **Redesigned report view**: a sticky header, a lens bar for fights (each pull,
  all BOSSES, all TRASH), and URL-driven tabs. The tabs are Rankings, Summary,
  Role breakdown, Gear, Consumables, Buff consumables, and Resistances.
- WCL-style **Summary** panels: damage and healing by source, damage taken, and
  deaths with the killing blow.
- **Role Breakdown** sheets per role and per class, covering hit stats, trinket
  and racial uses, avoidable damage, debuffs, and cast counts.
- **Mobile layout**: a drawer nav and per-player cards for every table.
- A row and column hover crosshair and a "hide empty rows/columns" toggle on every
  table.
- **Publish & share**: a key-free snapshot at `/s/<id>`, optionally posted to a
  Discord webhook.
- Class-coloured raider chips, a favicon logo, and a dark raid theme.

### Changed
- **WarcraftLogs fetching moved into the browser.** Each user brings their own WCL
  API key. Reports are cached per browser in IndexedDB, and `apps/api` became a
  credential-free snapshot store.
- The WCL access token is kept in `sessionStorage`, not `localStorage`.

### Security
- The open share endpoint now has a size limit and an expiry, and CORS is limited
  to the web origin.

## [1.0.0] — 2026-06-16

The first working app: a rebuild of Shariva's Combat Log Analytics (CLA) and Role
Performance Breakdown (RPB) sheets.

### Added
- Pure analysis engine (`@wcl/core`) and reference data (`@wcl/data`) extracted
  from the original sheets, plus curated TBC spell-id tables.
- **Gear** listing and issues: enchants, gems, sockets, and excluded items.
- **Consumables** and **Drums** analysis.
- **Shadow Resistance** breakdown.
- **Role Performance Breakdown**: hybrid role detection, activity with
  spell-haste correction, per-class ability uptimes, and avoidable damage.
- **Rankings**: a grid of WCL parse percentiles.
- Validate and two-log timeline comparison tabs (removed in 1.1.0).
- Red, yellow, and green severity colouring across every tab.
- Discord webhook and dark mode.

[Unreleased]: https://github.com/sL1Per/DANGER-WLC-Analyzer/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/sL1Per/DANGER-WLC-Analyzer/releases/tag/v1.4.0
[1.3.0]: https://github.com/sL1Per/DANGER-WLC-Analyzer/releases/tag/v1.3.0
[1.2.0]: https://github.com/sL1Per/DANGER-WLC-Analyzer/releases/tag/v1.2.0
[1.1.0]: https://github.com/sL1Per/DANGER-WLC-Analyzer/releases/tag/v1.1.0
[1.0.0]: https://github.com/sL1Per/DANGER-WLC-Analyzer/releases/tag/v1.0.0
