# Rankings Grid on Home — Design

**Date:** 2026-06-16
**Status:** Approved (design); spec pending user review
**Topic:** Add a WarcraftLogs-style parse-percentile grid to the Home page, above the report summary.

## Goal

On the Home page, between the analyze form and the existing `ReportSummary`, show a
player × boss **parse-percentile grid** that mirrors WarcraftLogs' "Rankings" tab:
sections for Damage Dealers / Healers / Tanks, one column per boss killed, each cell
the player's parse percentile for that boss, colored on WCL's percentile scale.

Reference: WCL rankings view, e.g.
`https://fresh.warcraftlogs.com/reports/<code>?view=rankings`.

## Data source

WCL v2 exposes a single JSON field on the report:

```graphql
report { rankings(playerMetric: <metric>) }   # JSON scalar
```

For a report it returns **per-encounter** entries, each already split into
`roles.tanks`, `roles.healers`, `roles.dps`, and each character carries
`name`, `class`, `spec`, `rankPercent`, and `bracketPercent`. A single call therefore
yields both the full player × boss grid **and** the Tank/Healer/DPS grouping — healers'
`rankPercent` is their HPS parse, DPS/tanks' is their damage parse, exactly as WCL
displays it.

**Decision:** grouping comes from **WCL's own role classification** (the `roles` keys),
not the app's RPB role auto-detection. This is the right call for a "looks like WCL"
view; the app's own detection remains the source of truth on the RPB page.

**⚠️ Assumed shape.** The exact JSON structure of `rankings` is assumed from WCL
documentation and not yet live-probed (no creds in the build env). It is flagged for
live verification with the user's key during implementation/E2E — the secret is never
touched by the assistant; the user runs the probe. Expected shape:

```jsonc
{
  "data": [
    {
      "encounter": { "id": 123, "name": "Gruul the Dragonkiller" },
      "fightID": 5,
      "roles": {
        "tanks":   { "characters": [ { "id": 1, "name": "Tankone", "class": "Warrior", "spec": "Protection", "rankPercent": 64, "bracketPercent": 70 } ] },
        "healers": { "characters": [ /* … */ ] },
        "dps":     { "characters": [ /* … */ ] }
      }
    }
    // … one entry per ranked (killed) boss fight
  ]
}
```

Notes / unknowns to confirm live:
- Whether one `rankings` call (default `playerMetric`) returns DPS and healer parses
  correctly per role, or whether two calls (`dps` + `hps`) are needed. The design
  assumes **one call**; if live data shows healer parses are wrong under the default
  metric, fall back to two calls merged in normalize (documented contingency, no
  interface change).
- Character identity key: `name` is used to join to our roster; if WCL provides a
  stable actor `id` matching our `Player.id`, prefer that.
- Only killed bosses appear (wipes have no parse) — confirm.

## Pipeline (mirrors every existing tab)

1. **`apps/api/src/wcl.ts`** — add `fetchRankings(code, accessToken)`: one GraphQL
   query for `report.rankings`. Returns the raw JSON (typed loosely as the assumed
   shape).
2. **`apps/api/src/normalize.ts`** — shape the raw rankings into a new normalized
   field `ReportData.rankings` (optional). Drop entries with no usable parse; map each
   role group's characters to `{ name, class, spec, rankPercent, bracketPercent }`.
3. **`apps/api/src/app.ts`** — fetch rankings inside the existing best-effort
   `Promise.allSettled` block alongside the other M5+ fetches, so it is cached in the
   24h report cache. A failed rankings fetch leaves the field `undefined` and never
   fails the whole report.
4. **`packages/core/src/rankings.ts`** — pure aggregation `buildRankingsGrid(data)`:
   pivot the normalized rankings into:

   ```ts
   interface RankingsGrid {
     bosses: { fightID: number; encounterId: number; name: string }[];
     sections: RankingsSection[];
   }
   interface RankingsSection {
     role: "dps" | "healers" | "tanks";
     players: {
       name: string;
       class: string;
       spec?: string;
       perBoss: Record<number, { rankPercent: number; bracketPercent: number }>; // keyed by fightID
       overall: number; // mean rankPercent across bosses played, for sorting
     }[];
   }
   ```

   - `bosses` = union of encounters present in the rankings data, in fight order.
   - Players sorted by `overall` descending within each section.
   - Returns `null` when there is no rankings data.

## Data model

Add to `ReportData` (`packages/core/src/types.ts`), optional, with a "cached before
this feature" comment like the existing M3/M4/M5 fields:

```ts
/** WCL parse-percentile rankings per boss, grouped by WCL role (rankings feature);
 *  undefined = report cached before this feature (show a refresh notice). */
rankings?: ReportRanking[];
```

`ReportRanking` is the per-boss normalized entry (encounter + fightID + the three role
groups of characters). Defined in `types.ts` next to the other normalized event types.

## UI — `RankingsGrid` on Home

- New component `apps/web/src/components/RankingsGrid.tsx`, rendered in `HomePage`
  inside `HomeSummary` (or a sibling card) **above** `ReportSummary`, in its own
  `.card`.
- If `report.rankings` is `undefined`: render a small "Refresh from WCL to load parse
  rankings" notice (same pattern other tabs use for pre-feature caches). If it is an
  empty array (no ranked bosses): render nothing or a brief "no ranked kills" line.
- Three sections in fixed order: **Damage Dealers** (`dps`), **Healers** (`healers`),
  **Tanks** (`tanks`). Each section renders only if it has players.
- Each section = a table: rows = players, first column = class-colored player name
  (reuse `lib/classColors`), then one column per boss in `bosses`. Cell = `rankPercent`
  (integer). Empty/neutral cell where the player has no parse for that boss.
- **Cell color = WCL's parse-percentile bands**, distinct from the app's `sev-*` /
  `heatmap` green-yellow-red scale:

  | percentile | band  | color name |
  |-----------|-------|-----------|
  | 0–24      | gray  | common     |
  | 25–49     | green | uncommon   |
  | 50–74     | blue  | rare       |
  | 75–94     | purple| epic       |
  | 95–98     | orange| legendary  |
  | 99        | pink  | astounding |
  | 100       | gold  | artifact   |

  New helper `apps/web/src/lib/parseColor.ts`: `parseBand(pct) -> band` and a
  `parse-<band>` CSS class. Colors defined as CSS vars in `theme.css` (dark-mode
  aware), kept separate from `sev-*`/heatmap so the WCL look stays faithful.

## Testing

- **core** `rankings.test.ts`: `buildRankingsGrid` pivot/sort/overall/`null`-on-empty
  with a fixture; boss column ordering; players sorted by overall desc.
- **web** `RankingsGrid.test.tsx`: renders the three sections, class-colored names,
  correct `parse-<band>` class per percentile, empty cell where no parse, refresh
  notice when `rankings` undefined.
- **web** `parseColor.test.ts`: band boundary values (24/25, 49/50, 74/75, 94/95, 98/99,
  99/100).
- **fixture**: add `rankings` to `packages/core/src/fixtures/report.fixture.ts` so Home
  and grid tests have data. Existing `ReportSummary`/Home tests stay green (field is
  optional/additive).

## Out of scope (YAGNI)

- `playermetrictimeframe=today` vs historical toggle — use WCL's default (historical
  all-time parses); no UI toggle.
- ilvl-parse (`bracketPercent`) display — normalized and stored, but the grid shows
  `rankPercent` only. (Stored so a later toggle is cheap; not rendered now.)
- Sorting/filtering controls, fight-mode filtering of the grid, per-spec breakdowns.
- Re-using the app's RPB role detection for grouping (WCL's classification is used).

## Risks / open items

- **Assumed JSON shape** (see Data source) — primary risk; resolved by a live probe
  with the user's key before flipping anything to verified.
- One-call vs two-call metric question — documented contingency, no interface impact.
- Keyless viewers depend on the owner having refreshed since this feature shipped;
  pre-feature caches show the refresh notice.
