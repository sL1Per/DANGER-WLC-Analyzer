 # ROADMAP / TODO

## New features / todo

- Class selector on RPB  * - casts tabs
- Make there whole app mobile friendly
- Discord webhook
- Security review
- Authentication?
- totem twist tracker (https://www.warcraftlogs.com/reports/GPAaJQBnF19VLft4?fight=65&type=casts&source=15 // https://www.warcraftlogs.com/reports/GPAaJQBnF19VLft4?fight=65&type=casts&source=28)

## Changes

- Rename By Boss Fight and By Player into Boss fights and Players
- Overview page needs revamp
- By Player details needs revamp
- Remove as many npm dependencies as possible

## Bugs

- Cached reports must be manually refreshed from WCL to pick up new RPB data
  (hitType-based stats, NPC source names, unmitigated avoidable damage, per-fight
  hit stats) — consider cache-busting on analyzer changes or a "refresh to update" prompt.
- Pre-existing failing test: `packages/data/src/data.test.ts` "JC necks map item id
  to on-use buff id" expects `jcNecks.length >= 4` but there are 3 (fallout of the
  JC-neck-detection fix) — update the test or restore the 4th neck.
