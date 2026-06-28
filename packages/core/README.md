# @wcl/core

The pure analysis engine for the WCL Raid Analyzer. No I/O, no network, no
imports of `@wcl/data` — it takes a normalized `ReportData` object (plus injected
reference-data config where needed) and returns analysis results.

This is the heart of the project: gear issues, consumables, drums, shadow
resistance, role detection, activity, per-class ability metrics, the RPB role
breakdown, the performance summary, and the rankings grid all live here as
side-effect-free functions, each with unit tests.

See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#the-analysis-engine-wclcore)
for the module map and the fight-scoping invariant.

```sh
pnpm --filter @wcl/core test
pnpm --filter @wcl/core typecheck
```

The canonical input/output shapes (including `ReportData` and `SCHEMA_VERSION`)
are in [`src/types.ts`](src/types.ts).
