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

## Known trade-offs (M1)

- `DELETE /api/report/:id` (manual refresh) is unauthenticated — anyone can
  evict a cached report, which only forces a re-fetch. Fine for guild scope;
  revisit before any public deployment.
- The in-memory cache empties on API restart.
