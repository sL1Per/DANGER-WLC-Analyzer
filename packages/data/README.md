# @wcl/data

Reference data for the WCL Raid Analyzer, kept separate from analysis logic so
`@wcl/core` stays pure. Two kinds:

- **Extracted JSON** (`json/`) — item sockets, item shadow resistance, spell
  haste, spell cast times, gem quality, bad enchants, excluded items. Derived
  from the reference spreadsheets and the TBC 2.5.4 client DB.
- **Curated TypeScript tables** (`src/`) — consumable / drum / JC-neck spell ids,
  class abilities, avoidable abilities, trinket racials, role signals. These were
  not present in the spreadsheet export (they lived in its Apps Script), so they
  are hand-curated and Wowhead / client-DB verified. Unverified entries are
  flagged and badged in the UI.

`@wcl/data` depends on `@wcl/core` only for shared types (e.g. `Role`,
`RoleSignal`).

```sh
pnpm --filter @wcl/data extract     # regenerate JSON (needs the source xlsx files)
pnpm --filter @wcl/data test
pnpm --filter @wcl/data typecheck
```
