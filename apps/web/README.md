# @wcl/web

The React 19 + Vite single-page app for the WCL Raid Analyzer.

This is where **all WarcraftLogs work happens** — OAuth token exchange, v2 GraphQL
fetching, normalization into `ReportData`, and per-browser IndexedDB caching all
live under `src/lib/`. The UI renders the analyses produced by
[`@wcl/core`](../../packages/core).

See the root [README](../../README.md) and
[docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for the full design.

## Scripts

```sh
pnpm --filter @wcl/web dev        # Vite dev server on :5173
pnpm --filter @wcl/web test       # Vitest (jsdom + Testing Library)
pnpm --filter @wcl/web typecheck  # tsc -b
pnpm --filter @wcl/web build      # tsc -b && vite build
pnpm --filter @wcl/web lint       # eslint
```

## Layout

- `src/lib/wcl/` — WCL client: `wcl.ts` (queries), `normalize.ts`
  (raw → `ReportData`), `loadReport.ts` (orchestration).
- `src/lib/` — caching (`reportCache.ts`), auth (`api.ts`), sharing (`share.ts`),
  storage, theme, helpers.
- `src/components/report/` — the report view and its tabs.
- `src/pages/` — routed pages (`Home`, `Settings`, `Report`, `SharedReport`).
