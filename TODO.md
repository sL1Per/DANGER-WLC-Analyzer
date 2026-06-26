 # ROADMAP / TODO

## New features / todo

- (1) [DONE] Class selector on RPB  "* - casts" tabs. Make sure there is an option to select all
- (8) Make there whole app mobile friendly
- (2) [DONE] Discord webhook — "Share to Discord" button posts the current view (deep link + title/zone/view) via a local webhook URL. Note: links are localhost until deploy (#14).
- (12) Clean up
- (13) Security review
- (14) Deploy Online FREE
- (10) totem twist tracker (https://www.warcraftlogs.com/reports/GPAaJQBnF19VLft4?fight=65&type=casts&source=15 // https://www.warcraftlogs.com/reports/GPAaJQBnF19VLft4?fight=65&type=casts&source=28)

## Changes

- (2) [DONE] Rename By Boss Fight and By Player into Boss fights and Players
- (9) Make WCL API credentials and Discord webhook local settings and not stored in the backend like now. Idea is that in the future i will have this app online and anyone can use it with their own keys
- (6) Overview page needs revamp
- (7) By Player details needs revamp
- (11) Remove as many npm dependencies as possible

## Bugs

- (3) Fix table with in the Role breakdown tabs
- (4) Cached reports must be manually refreshed from WCL to pick up new RPB data
  (hitType-based stats, NPC source names, unmitigated avoidable damage, per-fight
  hit stats) — consider cache-busting on analyzer changes or a "refresh to update" prompt.
- (5) Pre-existing failing test: `packages/data/src/data.test.ts` "JC necks map item id
  to on-use buff id" expects `jcNecks.length >= 4` but there are 3 (fallout of the
  JC-neck-detection fix) — update the test or restore the 4th neck.
