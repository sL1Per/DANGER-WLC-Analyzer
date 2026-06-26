 # ROADMAP / TODO

## New features / todo

- (1) [DONE] Class selector on RPB  "* - casts" tabs. Make sure there is an option to select all
- (7) Make there whole app mobile friendly
- (2) [DONE] Discord webhook — "Share to Discord" button posts the current view (deep link + title/zone/view) via a local webhook URL. Note: links are localhost until deploy (#14).
- (12) Clean up
- (13) Security review
- (14) Deploy Online FREE
- (10) totem twist tracker (https://www.warcraftlogs.com/reports/GPAaJQBnF19VLft4?fight=65&type=casts&source=15 // https://www.warcraftlogs.com/reports/GPAaJQBnF19VLft4?fight=65&type=casts&source=28)

## Changes

- (2) [DONE] Rename By Boss Fight and By Player into Boss fights and Players
- (9) Make WCL API credentials and Discord webhook local settings and not stored in the backend like now. Idea is that in the future i will have this app online and anyone can use it with their own keys
- (6) [DONE] Overview page needs revamp
- (8) By Player details needs revamp
- (11) Remove as many npm dependencies as possible

## Bugs

- (3) [DONE] Fix table with in the Role breakdown tabs
- (4) [DONE] Cached reports must be manually refreshed from WCL to pick up new RPB
  data. Fixed via a schema version: `SCHEMA_VERSION` in `packages/core/src/types.ts`
  is stamped onto each normalized report; the API flags a cache hit `stale` when the
  stamped version differs, and the report page shows a "refresh to update" banner
  (reusing the existing Refresh button). Bump `SCHEMA_VERSION` whenever the analyzer
  output changes so old caches are flagged. Non-destructive: stale data is still
  served (no surprise WCL point spend).
- (5) [DONE] Pre-existing failing test: `packages/data/src/data.test.ts` "JC necks map item
  id to on-use buff id" expected `jcNecks.length >= 4` but there are 3. The 4th/5th were the
  wrong items (on-use absorb pendants), correctly removed by the JC-neck-detection fix — the
  test now asserts the exact 3 stat necks (24114/24116/24121) as a regression guard.
