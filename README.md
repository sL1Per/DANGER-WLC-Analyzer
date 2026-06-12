# WCL Raid Analyzer

Web rebuild of the CLA/RPB Google Sheets for WoW Classic TBC raid analysis.
See `CLAUDE.md` for the analysis of the original tools and
`docs/superpowers/specs/` for the design.

## Develop

    pnpm install
    pnpm dev        # API on :8787, web on :5173
    pnpm test       # all packages

## Use

1. Create a free WCL v2 API client: https://classic.warcraftlogs.com/api/clients/
2. Open http://localhost:5173/settings and paste client ID + secret
   (stored in your browser only).
3. Paste a TBC report URL on the home page.

Reports load once with your credentials and are then served from the API's
24h cache — guildmates can open the same /report/<id> link without any key.

## Layout

- `packages/core` — pure analysis engine (no I/O)
- `packages/data` — reference JSON extracted from the original xlsx files
  (`pnpm --filter @wcl/data extract` to regenerate; requires the two xlsx
  files in the repo root)
- `apps/api` — Hono proxy: WCL OAuth, GraphQL fetch, report cache
- `apps/web` — React SPA

### Gear analyses (M2)

The report page has tabs: summary, gear issues, gear listing. Gear is
read from WCL combatantInfo (recorded at boss-pull only; some T6 fights miss
it). Reports cached before M2 lack gear — hit "Refresh from WCL".

### Consumables + drums (M3)

Two more tabs: **buff consumables** (per-player boss-fight uptimes for
elixirs/flasks/food/scrolls, gear-based weapon-enhancement uptime, JC-neck
usage, suboptimal-consumable callouts, and the original's total average) and
**drums** (battle/war/restoration counts, wasted "on Tinnitus" casts = drums
that buffed nobody, ⌀ buffs per drum, weighted score = total buffs applied,
lesser-version flag). Reports cached before M3 need a "Refresh from WCL".

Caveat: the consumable/drum spell-id lists are hand-curated (the originals
lived in the spreadsheet's Apps Script, which isn't in the xlsx exports) and
were verified against Wowhead TBC — see `packages/data/src/consumables.ts`.
Problem cells follow the project-wide color convention: red = big issue,
yellow = intermediate, green = fine/small.

To verify the WCL schema assumptions against the live API once:

    WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api probe <reportCode>

## Known trade-offs (M1)

- `DELETE /api/report/:id` (manual refresh) is unauthenticated — anyone can
  evict a cached report, which only forces a re-fetch. Fine for guild scope;
  revisit before any public deployment.
- The in-memory cache empties on API restart.
