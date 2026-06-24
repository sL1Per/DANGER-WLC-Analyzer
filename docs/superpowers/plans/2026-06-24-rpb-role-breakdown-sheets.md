# RPB Role Breakdown sub-tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nested sub-tabs to the web app's Role Breakdown tab that reproduce the exported RPB workbook's per-role sheets (`Tank`/`Healer`/`Caster`/`Physical` and their `- casts` siblings).

**Architecture:** Hybrid data sourcing (approach C). The WCL `table` API supplies the hit-type "Stats & Misc" + "Trinkets & Racials" sections (server-aggregated over boss fights → BOSSES-only). The existing event model (`playerCasts`/`enemyDebuffs`/`activity`) supplies casts/activity/cooldowns/avoidable, keeping the report-fights scoping invariant. Two pure core builders (`roleSheet`, `roleCasts`) feed three new web components nested under the existing `roles` tab.

**Tech Stack:** TypeScript monorepo — `apps/api` (Hono + WCL v2 GraphQL), `packages/core` (pure analyses), `packages/data` (reference tables), `apps/web` (React + react-router + Vitest/RTL). Vitest everywhere.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-24-rpb-role-breakdown-sheets-design.md` (authoritative).
- The 8 Excel sub-tabs are **BOSSES-only**; `Overview` shows on every card. On non-BOSSES cards the sub-nav lists only `Overview`.
- **Invariant:** report-wide event analyses derive fights from `report.fights` only; the caller scopes via `scopeReportToFight`. Never re-add an internal `isBoss` filter inside a core builder. (Hit-type/trinket sections are exempt — they come from pre-aggregated tables fetched server-side over boss fights.)
- All new `ReportData` fields are **optional**; their absence drives the existing "Refresh from WCL" notice on stale caches (mirror `rpb()`'s `playerTotals === undefined` guard).
- **Never fabricate spell IDs.** New ability/trinket IDs must be either reused from existing in-repo data (`packages/data/src/classAbilities.ts`) or marked `verified: false` until confirmed against the TBC 2.5.4 client DB (wago.tools SpellName), per the convention documented atop `classAbilities.ts`.
- Kalecgos is already excluded upstream from RPB aggregation — do not re-handle it.
- Follow existing patterns: dependency-injected fetchers in `AppDeps`, `Promise.allSettled` best-effort fetches, `data_only` cached-value reads, `sev-*`/heatmap severity classes.
- TDD: failing test → verify red → minimal impl → verify green → commit. Frequent commits.

**Build/test commands** (run from repo root):
- Core: `npm test -w packages/core`
- Data: `npm test -w packages/data`
- API: `npm test -w apps/api`
- Web: `npm test -w apps/web`
- Typecheck whole tree: `npm run -w packages/core build && npm run -w apps/api build` (committed tree must typecheck).

---

## File structure

| File | Responsibility |
|------|----------------|
| `apps/api/scripts/probe-rpb-tables.ts` (create) | One-off probe: dump WCL `table` JSON for DamageDone/DamageTaken/Casts/Buffs to confirm hit-type field names. |
| `apps/api/src/wcl.ts` (modify) | New `fetchHitTable` + `fetchCastsTable` returning rich per-actor entries; `RawHitTableEntry`/`RawCastTableEntry` types. |
| `apps/api/src/normalize.ts` (modify) | Build `hitStats` + `trinketUses` from the new tables. |
| `apps/api/src/app.ts` (modify) | Wire the two new fetchers into `AppDeps` + the boss-only fetch block. |
| `packages/core/src/types.ts` (modify) | `PlayerHitStats`, `HitStat`, `TrinketUse`; add `hitStats?`/`trinketUses?` to `ReportData`. |
| `packages/data/src/classAbilityCatalog.ts` (create) | Full per-class casts-sheet catalog. |
| `packages/data/src/trinketRacials.ts` (create) | On-use trinket/racial spellId → name. |
| `packages/data/src/avoidableAbilities.ts` (modify) | Add tracked avoidable-debuff ids. |
| `packages/core/src/rpbSheets.ts` (create) | `roleSheet()` + `roleCasts()` pure builders. |
| `apps/web/src/lib/analysisConfig.ts` (modify) | `roleSheetConfig()` / `roleCastsConfig()` wiring data into core. |
| `apps/web/src/components/report/RoleBreakdownView.tsx` (create) | Sub-nav owner; renders Overview or a role/casts table. |
| `apps/web/src/components/report/RoleSheetTable.tsx` (create) | Players-as-rows role sheet. |
| `apps/web/src/components/report/RoleCastsTable.tsx` (create) | Per-class casts sub-tables + activity + cooldowns. |
| `apps/web/src/pages/ReportPage.tsx` (modify) | Render `RoleBreakdownView` for the `roles` cat. |

---

# Phase 1 — API: hit-type + trinket data

### Task 1: Probe the WCL table shapes

**Files:**
- Create: `apps/api/scripts/probe-rpb-tables.ts`

**Interfaces:**
- Produces: a documented field map (written into this plan's Task 2 once known). No code consumes the probe.

This task is a **spike**, not TDD. Its deliverable is knowledge: the exact JSON field names WCL v2 returns for hit-type counts.

- [ ] **Step 1: Write the probe script**

Model it on `apps/api/scripts/probe-consumables.ts` (same env-var token flow). Create `apps/api/scripts/probe-rpb-tables.ts`:

```ts
/* Usage: WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… REPORT=<code> FIGHT=<id> \
     npx tsx apps/api/scripts/probe-rpb-tables.ts
   Dumps the raw `table` JSON for the four dataTypes so we can read the exact
   hit-type / cast-count field names before writing normalization. */
import { fetchToken } from "../src/wcl";

const API = "https://classic.warcraftlogs.com/api/v2/client";

async function table(code: string, token: string, dataType: string, fightId: number) {
  const query = `query($code:String!,$dt:TableDataType!,$f:[Int]){
    reportData{report(code:$code){ table(dataType:$dt, fightIDs:$f, hostilityType: Friendlies) }}}`;
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { code, dt: dataType, f: [fightId] } }),
  });
  const json = await res.json();
  return json.data?.reportData?.report?.table;
}

async function main() {
  const { WCL_CLIENT_ID, WCL_CLIENT_SECRET, REPORT, FIGHT } = process.env;
  if (!WCL_CLIENT_ID || !WCL_CLIENT_SECRET || !REPORT || !FIGHT) {
    throw new Error("set WCL_CLIENT_ID, WCL_CLIENT_SECRET, REPORT, FIGHT");
  }
  const { accessToken } = await fetchToken(WCL_CLIENT_ID, WCL_CLIENT_SECRET);
  for (const dt of ["DamageDone", "DamageTaken", "Casts", "Buffs"]) {
    const t = await table(REPORT, accessToken, dt, Number(FIGHT));
    const first = t?.data?.entries?.[0];
    console.log(`\n===== ${dt} — first entry keys:`, first ? Object.keys(first) : "(none)");
    console.log(JSON.stringify(first, null, 2)?.slice(0, 2000));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the probe against a real SSC/TK boss fight**

Run: `WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… REPORT=<code> FIGHT=<bossId> npx tsx apps/api/scripts/probe-rpb-tables.ts`
Expected: printed key lists for each dataType. **Record the hit-type field names** (the keys carrying crit/dodge/parry/miss/resist/block/crushing/immune counts on DamageDone & DamageTaken entries, and the cast-count key on Casts) — you will hard-code them in Task 2's `TABLE_FIELDS`.

- [ ] **Step 3: Commit the probe script**

```bash
git add apps/api/scripts/probe-rpb-tables.ts
git commit -m "chore(api): add WCL table probe for RPB hit-type fields"
```

> **Gate:** Do not start Task 2 until the probe output is recorded. If WCL exposes hit details only via a nested `entries[].hitdetails`/`subentries` array rather than flat keys, adjust Task 2's accessor accordingly — the rest of the plan is unaffected because Task 2 centralizes the mapping.

---

### Task 2: Rich table fetchers in `wcl.ts`

**Files:**
- Modify: `apps/api/src/wcl.ts`
- Test: `apps/api/src/wcl.test.ts`

**Interfaces:**
- Consumes: WCL `table` GraphQL (already used by `fetchTable`).
- Produces:
  - `interface RawHitTableEntry { id: number; total: number; hitCount?: number; critHitCount?: number; missCount?: number; dodgeCount?: number; parryCount?: number; resistCount?: number; blockCount?: number; crushingCount?: number; immuneCount?: number; }`
  - `fetchHitTable(code, accessToken, dataType: "DamageDone" | "DamageTaken", fightIds: number[]): Promise<RawHitTableEntry[]>`
  - `interface RawCastTableEntry { id: number; guid: number; name: string; total: number; }`
  - `fetchCastsTable(code, accessToken, fightIds: number[]): Promise<RawCastTableEntry[]>`

> Replace the field names below with the exact keys recorded in Task 1 if they differ. Keep them in one `const` so a single edit covers every downstream use.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/wcl.test.ts` (follow the existing `gql`-mock style — the file already stubs `fetch`). If there is no `fetch` stub helper, mock `globalThis.fetch`:

```ts
import { describe, it, expect, vi } from "vitest";
import { fetchHitTable, fetchCastsTable } from "./wcl";

function mockFetchOnce(body: unknown) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status: 200 }),
  );
}

describe("fetchHitTable", () => {
  it("maps per-actor hit-type counts", async () => {
    mockFetchOnce({ data: { reportData: { report: { table: { data: { entries: [
      { id: 7, total: 1000, hitCount: 100, critHitCount: 35, dodgeCount: 4, parryCount: 6, missCount: 2, resistCount: 0 },
    ] } } } } } });
    const rows = await fetchHitTable("abc", "tok", "DamageDone", [1, 2]);
    expect(rows[0]).toMatchObject({ id: 7, critHitCount: 35, dodgeCount: 4 });
  });
});

describe("fetchCastsTable", () => {
  it("maps per-actor per-ability cast totals", async () => {
    mockFetchOnce({ data: { reportData: { report: { table: { data: { entries: [
      { id: 7, guid: 48825, name: "Holy Shield", total: 64 },
    ] } } } } } });
    const rows = await fetchCastsTable("abc", "tok", [1]);
    expect(rows[0]).toMatchObject({ id: 7, guid: 48825, name: "Holy Shield", total: 64 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w apps/api -- wcl.test`
Expected: FAIL — `fetchHitTable`/`fetchCastsTable` are not exported.

- [ ] **Step 3: Implement the fetchers**

Add to `apps/api/src/wcl.ts` (next to the existing `fetchTable`). Use the same `gql` helper:

```ts
export interface RawHitTableEntry {
  id: number; total: number;
  hitCount?: number; critHitCount?: number; missCount?: number;
  dodgeCount?: number; parryCount?: number; resistCount?: number;
  blockCount?: number; crushingCount?: number; immuneCount?: number;
}

/** Per-actor hit-type breakdown from a Damage table (boss fights). */
export async function fetchHitTable(
  code: string, accessToken: string, dataType: "DamageDone" | "DamageTaken",
  fightIds: number[],
): Promise<RawHitTableEntry[]> {
  const query = `
  query HitTable($code: String!, $dataType: TableDataType!, $fightIds: [Int]) {
    reportData { report(code: $code) {
      table(dataType: $dataType, fightIDs: $fightIds, hostilityType: Friendlies)
    } }
  }`;
  const data = await gql<{ reportData: { report: { table: { data?: { entries?: RawHitTableEntry[] } } } } }>(
    query, { code, dataType, fightIds }, accessToken);
  return data.reportData.report.table?.data?.entries ?? [];
}

export interface RawCastTableEntry { id: number; guid: number; name: string; total: number; }

/** Per-actor, per-ability cast counts from the Casts table (boss fights).
 *  `guid` is the ability gameID; used to match trinket/racial on-use ids. */
export async function fetchCastsTable(
  code: string, accessToken: string, fightIds: number[],
): Promise<RawCastTableEntry[]> {
  const query = `
  query CastsTable($code: String!, $fightIds: [Int]) {
    reportData { report(code: $code) {
      table(dataType: Casts, fightIDs: $fightIds, hostilityType: Friendlies)
    } }
  }`;
  // Casts table nests abilities under each actor entry; flatten to (actor,ability) rows.
  const data = await gql<{ reportData: { report: { table: { data?: { entries?: Array<{ id: number; abilities?: Array<{ guid: number; name: string; total: number }> }> } } } } }>(
    query, { code, fightIds }, accessToken);
  const out: RawCastTableEntry[] = [];
  for (const e of data.reportData.report.table?.data?.entries ?? []) {
    for (const a of e.abilities ?? []) out.push({ id: e.id, guid: a.guid, name: a.name, total: a.total });
  }
  return out;
}
```

> If Task 1 showed the Casts table is flat (one entry per actor+ability, not nested under `abilities`), drop the inner loop and map entries directly. Keep the exported shape identical.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w apps/api -- wcl.test`
Expected: PASS (both new describes). If the Casts test fails because of nesting, reconcile the impl with the recorded probe shape.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/wcl.ts apps/api/src/wcl.test.ts
git commit -m "feat(api): fetch hit-type and casts tables for RPB role sheets"
```

---

### Task 3: Core types for hit stats & trinket uses

**Files:**
- Modify: `packages/core/src/types.ts`
- Test: covered indirectly by Task 4/6 (types are compile-time; no standalone test).

**Interfaces:**
- Produces:
  - `interface HitStat { count: number; pct: number; }`
  - `interface PlayerHitStats { playerId: number; outgoing: Record<"crit"|"dodge"|"miss"|"parry"|"resist", HitStat>; incomingMelee: Record<"crit"|"crushing"|"blocked"|"dodge"|"immune"|"miss"|"parry", HitStat>; critHeals: HitStat; extraWindfury: number; battleSquawk: number; }`
  - `interface TrinketUse { playerId: number; name: string; count: number; }`
  - `ReportData.hitStats?: PlayerHitStats[]`, `ReportData.trinketUses?: TrinketUse[]`.

- [ ] **Step 1: Add the types**

In `packages/core/src/types.ts`, add near the other RPB types:

```ts
/** One hit-type tally: raw count + share of the relevant population. */
export interface HitStat { count: number; pct: number; }

/** Per-player hit-type breakdown from the WCL damage/healing tables (boss fights). */
export interface PlayerHitStats {
  playerId: number;
  outgoing: { crit: HitStat; dodge: HitStat; miss: HitStat; parry: HitStat; resist: HitStat };
  incomingMelee: { crit: HitStat; crushing: HitStat; blocked: HitStat; dodge: HitStat; immune: HitStat; miss: HitStat; parry: HitStat };
  critHeals: HitStat;
  /** count of extra Windfury attacks granted (0 when not applicable) */
  extraWindfury: number;
  /** count of Battle Squawk buffs received on bosses */
  battleSquawk: number;
}

/** A use of a curated on-use trinket or racial (count of casts/applications). */
export interface TrinketUse { playerId: number; name: string; count: number; }
```

Add to the `ReportData` interface (next to `rankings?`):

```ts
  /** per-player hit-type breakdown (RPB role sheets, boss fights);
   *  undefined = report cached before this feature. */
  hitStats?: PlayerHitStats[];
  /** curated on-use trinket/racial counts (RPB role sheets);
   *  undefined = report cached before this feature. */
  trinketUses?: TrinketUse[];
```

- [ ] **Step 2: Verify the core package still builds**

Run: `npm run -w packages/core build`
Expected: PASS (no type errors).

- [ ] **Step 3: Export the new types**

Confirm `packages/core/src/index.ts` re-exports from `./types` with `export * ` (it does for the existing types). If it lists types explicitly, add `HitStat`, `PlayerHitStats`, `TrinketUse`.

Run: `npm run -w packages/core build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat(core): add PlayerHitStats and TrinketUse types"
```

---

### Task 4: Normalize hit stats & trinket uses

**Files:**
- Modify: `apps/api/src/normalize.ts`
- Test: `apps/api/src/normalize.test.ts`

**Interfaces:**
- Consumes: `RawHitTableEntry`/`RawCastTableEntry` (Task 2); `PlayerHitStats`/`TrinketUse` (Task 3); `trinketRacials` (Task 8 — but normalization receives the curated list via `NormalizeEventInputs`, so this task does NOT import `@wcl/data`; the id→name map is passed in).
- Produces: `hitStats` + `trinketUses` on the `ReportData` returned by `normalizeReport`. Extends `NormalizeEventInputs` with `damageDoneHitTable?`, `damageTakenHitTable?`, `healingHitTable?`, `castsTable?`, `trinketRacials?: { spellId: number; name: string }[]`.

> Hit-type sources (confirm against Task 1): outgoing crit/dodge/miss/parry/resist come from the **DamageDone** table; incoming crit/crushing/blocked/dodge/immune/miss/parry come from the **DamageTaken** table; critHeals from the **Healing** hit table. `pct` = count / (sum of all hit-type counts for that direction). `extraWindfury`/`battleSquawk` are deferred to Task 5.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/normalize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeReport } from "./normalize";
// reuse the existing minimal RawReport fixture in this file (see other tests);
// if a `makeRaw()` helper exists, use it. Otherwise inline a 1-boss-fight, 1-player raw.

describe("normalize hitStats/trinketUses", () => {
  it("builds outgoing hit shares and trinket counts", () => {
    const raw = makeRaw(); // 1 player id=7 (Paladin), 1 boss fight id=1
    const data = normalizeReport("rep", raw, [], {}, {
      damageDoneHitTable: [{ id: 7, total: 1000, hitCount: 100, critHitCount: 35, dodgeCount: 4, parryCount: 6, missCount: 2, resistCount: 3 }],
      damageTakenHitTable: [{ id: 7, total: 500, hitCount: 50, critHitCount: 1, blockCount: 10, dodgeCount: 5, missCount: 2, parryCount: 0, crushingCount: 3, immuneCount: 0 }],
      healingHitTable: [{ id: 7, total: 0, hitCount: 80, critHitCount: 20 }],
      castsTable: [{ id: 7, guid: 28714, name: "Bloodlust Brooch", total: 2 }],
      trinketRacials: [{ spellId: 28714, name: "Bloodlust Brooch" }],
    });
    const hs = data.hitStats!.find((h) => h.playerId === 7)!;
    expect(hs.outgoing.crit.count).toBe(35);
    // share = 35 / (100+35+4+6+2+3) = 35/150
    expect(hs.outgoing.crit.pct).toBeCloseTo(35 / 150, 5);
    expect(hs.incomingMelee.crushing.count).toBe(3);
    expect(hs.critHeals.count).toBe(20);
    expect(data.trinketUses!).toContainEqual({ playerId: 7, name: "Bloodlust Brooch", count: 2 });
  });
});
```

> If this file has no `makeRaw()`, copy the smallest existing raw-report literal in `normalize.test.ts` and trim it to one Paladin player (id 7) and one boss fight (`encounterID: 1, id: 1`).

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w apps/api -- normalize.test`
Expected: FAIL — `data.hitStats` is undefined.

- [ ] **Step 3: Implement the builder**

In `apps/api/src/normalize.ts`:

1. Extend `NormalizeEventInputs` (import the raw/core types at top):

```ts
  damageDoneHitTable?: RawHitTableEntry[];
  damageTakenHitTable?: RawHitTableEntry[];
  healingHitTable?: RawHitTableEntry[];
  castsTable?: RawCastTableEntry[];
  /** curated on-use trinket/racial ids → display name (from @wcl/data, injected) */
  trinketRacials?: { spellId: number; name: string }[];
```

2. Add a builder near `buildRpb`:

```ts
function buildHitStats(
  events: NormalizeEventInputs, playerIds: Set<number>,
): { hitStats?: PlayerHitStats[]; trinketUses?: TrinketUse[] } {
  if (events.damageDoneHitTable === undefined && events.castsTable === undefined) return {};
  const byOut = indexBy(events.damageDoneHitTable);
  const byTaken = indexBy(events.damageTakenHitTable);
  const byHeal = indexBy(events.healingHitTable);

  const share = (count: number, denom: number): HitStat => ({ count, pct: denom > 0 ? count / denom : 0 });
  const outDenom = (e?: RawHitTableEntry) =>
    (e?.hitCount ?? 0) + (e?.critHitCount ?? 0) + (e?.dodgeCount ?? 0) + (e?.parryCount ?? 0) + (e?.missCount ?? 0) + (e?.resistCount ?? 0);
  const takenDenom = (e?: RawHitTableEntry) =>
    (e?.hitCount ?? 0) + (e?.critHitCount ?? 0) + (e?.crushingCount ?? 0) + (e?.blockCount ?? 0) + (e?.dodgeCount ?? 0) + (e?.immuneCount ?? 0) + (e?.missCount ?? 0) + (e?.parryCount ?? 0);
  const healDenom = (e?: RawHitTableEntry) => (e?.hitCount ?? 0) + (e?.critHitCount ?? 0);

  const hitStats: PlayerHitStats[] = [...playerIds].map((playerId) => {
    const o = byOut.get(playerId); const od = outDenom(o);
    const t = byTaken.get(playerId); const td = takenDenom(t);
    const h = byHeal.get(playerId); const hd = healDenom(h);
    return {
      playerId,
      outgoing: {
        crit: share(o?.critHitCount ?? 0, od), dodge: share(o?.dodgeCount ?? 0, od),
        miss: share(o?.missCount ?? 0, od), parry: share(o?.parryCount ?? 0, od),
        resist: share(o?.resistCount ?? 0, od),
      },
      incomingMelee: {
        crit: share(t?.critHitCount ?? 0, td), crushing: share(t?.crushingCount ?? 0, td),
        blocked: share(t?.blockCount ?? 0, td), dodge: share(t?.dodgeCount ?? 0, td),
        immune: share(t?.immuneCount ?? 0, td), miss: share(t?.missCount ?? 0, td),
        parry: share(t?.parryCount ?? 0, td),
      },
      critHeals: share(h?.critHitCount ?? 0, hd),
      extraWindfury: 0, // Task 5
      battleSquawk: 0,  // Task 5
    };
  });

  const trinketSet = new Map((events.trinketRacials ?? []).map((t) => [t.spellId, t.name]));
  const trinketUses: TrinketUse[] = [];
  for (const c of events.castsTable ?? []) {
    if (!playerIds.has(c.id)) continue;
    const name = trinketSet.get(c.guid);
    if (name) trinketUses.push({ playerId: c.id, name, count: c.total });
  }
  return { hitStats, trinketUses };
}

function indexBy(entries?: RawHitTableEntry[]): Map<number, RawHitTableEntry> {
  const m = new Map<number, RawHitTableEntry>();
  for (const e of entries ?? []) m.set(e.id, e);
  return m;
}
```

3. Spread it into the `normalizeReport` return, next to `...buildRpb(...)`:

```ts
    ...buildHitStats(events, new Set(players.map((p) => p.id))),
```

Add the imports `PlayerHitStats`, `HitStat`, `TrinketUse` from `@wcl/core` and `RawHitTableEntry`, `RawCastTableEntry` from `./wcl`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w apps/api -- normalize.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/normalize.ts apps/api/src/normalize.test.ts
git commit -m "feat(api): normalize hit-type stats and trinket uses"
```

---

### Task 5: Extra-Windfury & Battle-Squawk counts

**Files:**
- Modify: `apps/api/src/normalize.ts`
- Test: `apps/api/src/normalize.test.ts`

**Interfaces:**
- Consumes: `events.buffEvents` (already fetched) for Battle Squawk applications; `events.damageDone` raw events for extra Windfury attacks.
- Produces: populates `extraWindfury` and `battleSquawk` on each `PlayerHitStats`.

> Windfury extra attacks surface as additional melee `damage` events tagged with the Windfury ability id; Battle Squawk is a buff application from the Cenarion-trinket "Battle Squawk" id. Both ids go in `@wcl/data` (Task 8 adds them to `trinketRacials`/a small const) and are passed via `NormalizeEventInputs.extraWindfurySpellId` + `battleSquawkBuffId`. Mark ids `verified: false` until Task 1's report (or wago.tools) confirms them.

- [ ] **Step 1: Write the failing test**

```ts
it("counts extra Windfury attacks and Battle Squawk buffs", () => {
  const raw = makeRaw(); // player 7, boss fight 1
  const data = normalizeReport("rep", raw, [], {}, {
    damageDoneHitTable: [{ id: 7, total: 0 }],
    castsTable: [],
    extraWindfurySpellId: 33010,
    battleSquawkBuffId: 23060,
    damageDone: [
      { timestamp: 1, type: "damage", sourceID: 7, targetID: 9, abilityGameID: 33010, amount: 50, fight: 1 },
      { timestamp: 2, type: "damage", sourceID: 7, targetID: 9, abilityGameID: 33010, amount: 60, fight: 1 },
    ] as any,
    buffEvents: [
      { timestamp: 1, type: "applybuff", sourceID: 7, targetID: 7, abilityGameID: 23060, fight: 1 },
    ] as any,
  });
  const hs = data.hitStats!.find((h) => h.playerId === 7)!;
  expect(hs.extraWindfury).toBe(2);
  expect(hs.battleSquawk).toBe(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w apps/api -- normalize.test`
Expected: FAIL — both are 0.

- [ ] **Step 3: Implement**

Extend `NormalizeEventInputs` with `extraWindfurySpellId?: number;` and `battleSquawkBuffId?: number;`. In `buildHitStats`, before constructing each player's object, precompute counts:

```ts
  const wfId = events.extraWindfurySpellId;
  const sqId = events.battleSquawkBuffId;
  const wfBy = new Map<number, number>();
  if (wfId !== undefined) for (const d of events.damageDone ?? []) {
    if (d.abilityGameID === wfId && playerIds.has(d.sourceID)) wfBy.set(d.sourceID, (wfBy.get(d.sourceID) ?? 0) + 1);
  }
  const sqBy = new Map<number, number>();
  if (sqId !== undefined) for (const e of events.buffEvents ?? []) {
    if (e.abilityGameID === sqId && (e.type === "applybuff" || e.type === "refreshbuff") && playerIds.has(e.targetID))
      sqBy.set(e.targetID, (sqBy.get(e.targetID) ?? 0) + 1);
  }
```

Then set `extraWindfury: wfBy.get(playerId) ?? 0` and `battleSquawk: sqBy.get(playerId) ?? 0` in the mapped object.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w apps/api -- normalize.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/normalize.ts apps/api/src/normalize.test.ts
git commit -m "feat(api): count extra Windfury attacks and Battle Squawk buffs"
```

---

### Task 6: Wire fetchers into the app

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: `fetchHitTable`, `fetchCastsTable` (Task 2); `trinketRacials`, `extraWindfurySpellId`, `battleSquawkBuffId` from `@wcl/data` (Task 8).
- Produces: a fetched report whose `data.hitStats`/`data.trinketUses` are populated on the BOSSES path.

> Task 8 (data) must land before this task can import the constants. Order Phase 2 before this step, or stub the constants inline and replace. The plan sequences Phase 2 first (see ordering note at the end).

- [ ] **Step 1: Extend the app test deps**

`app.test.ts` constructs `createApp(deps)` with stubbed fetchers (the committed tree must typecheck — see commit `b02db23`). Add stubs returning `[]` for `fetchHitTable` and `fetchCastsTable` to the test's deps object, and assert the happy-path still returns 200. If there is an existing "all fetchers stubbed" helper, extend it.

```ts
// in the deps literal used by the happy-path test:
fetchHitTable: async () => [],
fetchCastsTable: async () => [],
```

- [ ] **Step 2: Run to verify it fails (typecheck/red)**

Run: `npm test -w apps/api -- app.test`
Expected: FAIL — `AppDeps` has no `fetchHitTable`/`fetchCastsTable` yet (type error), or the report path doesn't pass the new inputs.

- [ ] **Step 3: Implement the wiring**

In `apps/api/src/app.ts`:

1. Import the real fetchers and data constants:

```ts
import { /* …existing… */ trinketRacials, extraWindfurySpellId, battleSquawkBuffId } from "@wcl/data";
import { fetchHitTable as realFetchHitTable, fetchCastsTable as realFetchCastsTable, type RawHitTableEntry, type RawCastTableEntry } from "./wcl";
```

2. Add to `AppDeps` and the default `createApp` arg:

```ts
  fetchHitTable: typeof realFetchHitTable;
  fetchCastsTable: typeof realFetchCastsTable;
```
```ts
  fetchHitTable: realFetchHitTable,
  fetchCastsTable: realFetchCastsTable,
```

3. In the boss-only fetch block (the `Promise.allSettled` that already has `hasBoss ? deps.fetchTable(...)`), add three more parallel fetches and capture results:

```ts
      let damageDoneHitTable: RawHitTableEntry[] = [];
      let damageTakenHitTable: RawHitTableEntry[] = [];
      let healingHitTable: RawHitTableEntry[] = [];
      let castsTable: RawCastTableEntry[] = [];
```

Add to the `Promise.allSettled([...])` array (and its destructure):

```ts
          hasBoss ? deps.fetchHitTable(id, token, "DamageDone", bossFightIds) : none,
          hasBoss ? deps.fetchHitTable(id, token, "DamageTaken", bossFightIds) : none,
          hasBoss ? deps.fetchTable(id, token, "Healing", bossFightIds) : none, // reuse: healing hit table — see note
          hasBoss ? deps.fetchCastsTable(id, token, bossFightIds) : none,
```

> Note: `fetchTable(... "Healing")` returns `{id,total}` without hit counts. For `critHeals` you need `fetchHitTable`-style data on Healing too. Simplest: make `fetchHitTable` accept `"Healing"` as well (widen its `dataType` union to `"DamageDone" | "DamageTaken" | "Healing"`), and call `deps.fetchHitTable(id, token, "Healing", bossFightIds)` for `healingHitTable`. Update Task 2's signature accordingly if you prefer to do it there. Then assign each settled result to the vars above.

4. Pass them into `normalizeReport`'s events object:

```ts
        damageDoneHitTable, damageTakenHitTable, healingHitTable, castsTable,
        trinketRacials, extraWindfurySpellId, battleSquawkBuffId,
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w apps/api`
Expected: PASS (all api tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/app.test.ts
git commit -m "feat(api): fetch RPB hit/casts tables on the bosses path"
```

---

# Phase 2 — Reference data

> **Sequencing:** complete Phase 2 (Tasks 7–9) before Task 6, since Task 6 imports these constants. They are listed after Phase 1 conceptually but must be implemented before Task 6's wiring compiles.

### Task 7: Trinket/racial catalog

**Files:**
- Create: `packages/data/src/trinketRacials.ts`
- Modify: `packages/data/src/index.ts`
- Test: `packages/data/src/trinketRacials.test.ts`

**Interfaces:**
- Produces:
  - `interface TrinketRacial { spellId: number; name: string; verified?: boolean }`
  - `export const trinketRacials: TrinketRacial[]`
  - `export const extraWindfurySpellId: number`
  - `export const battleSquawkBuffId: number`

> Seed with the trinkets/racials that appear in the reference export (Icon of the Silver Crescent, Scarab of Displacement, Badge of Tenacity, Bloodlust Brooch, Moroes' Lucky Pocket Watch, Abacus of Violent Odds, Badge of the Swarmguard, Bangle of Endless Blessings, Essence of the Martyr, Ribbon of Sacrifice, Vengeance of the Illidari, Berserking, Blood Fury, Fear Ward, Spell Power (Scryer's Bloodgem/Xi'ri's Gift)). Use the **on-use spell id** (the cast/buff id WCL records), not the item id. Any id you cannot confirm against wago.tools right now: include it with `verified: false` and a `// TODO verify` — do not omit and do not guess silently.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { trinketRacials, extraWindfurySpellId, battleSquawkBuffId } from "./trinketRacials";

describe("trinketRacials", () => {
  it("has unique spell ids and non-empty names", () => {
    const ids = trinketRacials.map((t) => t.spellId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(trinketRacials.every((t) => t.name.length > 0)).toBe(true);
  });
  it("exports windfury and battle-squawk ids", () => {
    expect(extraWindfurySpellId).toBeGreaterThan(0);
    expect(battleSquawkBuffId).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w packages/data -- trinketRacials`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the catalog**

Create `packages/data/src/trinketRacials.ts`. Author entries from the list above with real on-use ids where confirmable (e.g. Blood Fury, Berserking are core racials with stable ids), `verified: false` otherwise. Example shape (fill the full list):

```ts
export interface TrinketRacial { spellId: number; name: string; verified?: boolean; }

/** On-use trinkets/racials whose activation WCL logs as a cast/buff. The id is the
 *  ON-USE spell id (not the item id). Unverified ids carry verified:false until
 *  confirmed against the TBC 2.5.4 client DB (wago.tools SpellName). */
export const trinketRacials: TrinketRacial[] = [
  { spellId: 33697, name: "Blood Fury", verified: false },        // orc racial — verify
  { spellId: 26297, name: "Berserking", verified: false },        // troll racial — verify
  { spellId: 6346, name: "Fear Ward", verified: false },          // dwarf/priest — verify
  // …Icon of the Silver Crescent, Bloodlust Brooch, Badge of Tenacity, Abacus of
  //   Violent Odds, Badge of the Swarmguard, Bangle of Endless Blessings, Essence
  //   of the Martyr, Ribbon of Sacrifice, Vengeance of the Illidari, Scarab of
  //   Displacement, Moroes' Lucky Pocket Watch, Spell Power (Scryer's Bloodgem /
  //   Xi'ri's Gift) — author each with its on-use id, verified:false until checked.
];

/** Windfury extra-attack proc id (Enhancement totem). verify against Task-1 report. */
export const extraWindfurySpellId = 33010; // TODO verify
/** Battle Squawk buff id (Cenarion War Hippogryph / trinket). verify. */
export const battleSquawkBuffId = 23060;   // TODO verify
```

- [ ] **Step 4: Export & run**

Add `export * from "./trinketRacials";` to `packages/data/src/index.ts`.
Run: `npm test -w packages/data -- trinketRacials`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data/src/trinketRacials.ts packages/data/src/index.ts packages/data/src/trinketRacials.test.ts
git commit -m "feat(data): add trinket/racial on-use catalog for RPB role sheets"
```

---

### Task 8: Avoidable-debuff ids

**Files:**
- Modify: `packages/data/src/avoidableAbilities.ts`
- Test: `packages/data/src/avoidableAbilities.test.ts`

**Interfaces:**
- Produces: `export const avoidableDebuffIds: { spellId: number; name: string }[]` (tracked debuffs whose *application count* the role sheet shows — Nether Vapor, Silence (Thaladred), etc.). Keep separate from the existing avoidable-damage ids.

- [ ] **Step 1: Write the failing test**

Add to `packages/data/src/avoidableAbilities.test.ts`:

```ts
import { avoidableDebuffIds } from "./avoidableAbilities";
it("avoidableDebuffIds are unique and named", () => {
  const ids = avoidableDebuffIds.map((d) => d.spellId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(avoidableDebuffIds.every((d) => d.name.length > 0)).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w packages/data -- avoidableAbilities`
Expected: FAIL — `avoidableDebuffIds` not exported.

- [ ] **Step 3: Implement**

Append to `packages/data/src/avoidableAbilities.ts`:

```ts
/** Avoidable enemy debuffs whose APPLICATION COUNT the RPB role sheet reports
 *  (distinct from avoidable-damage ids above). Unverified until wago-checked. */
export const avoidableDebuffIds: { spellId: number; name: string; verified?: boolean }[] = [
  { spellId: 35013, name: "Nether Vapor", verified: false },        // Kael — TODO verify
  { spellId: 29914, name: "Silence (Thaladred the Darkener)", verified: false }, // TODO verify
];
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w packages/data -- avoidableAbilities`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data/src/avoidableAbilities.ts packages/data/src/avoidableAbilities.test.ts
git commit -m "feat(data): add tracked avoidable-debuff ids for RPB role sheets"
```

---

### Task 9: Class ability catalog (casts-sheet source)

**Files:**
- Create: `packages/data/src/classAbilityCatalog.ts`
- Modify: `packages/data/src/index.ts`
- Test: `packages/data/src/classAbilityCatalog.test.ts`

**Interfaces:**
- Produces:
  - `type CastCategory = "single" | "aoe" | "cooldown" | "heal";`
  - `interface CatalogAbility { className: string; key: string; name: string; category: CastCategory; spellIds: number[]; ranks?: { spellId: number; rank: number }[]; uptimeAnnotated?: boolean; appliesToRole?: Role; tracked?: boolean; verified?: boolean; }`
  - `export const classAbilityCatalog: CatalogAbility[]`

> This is the largest authoring effort. **Do not fabricate spell IDs.** Strategy:
> 1. Seed every entry that already exists in `packages/data/src/classAbilities.ts` (all `verified: true`) — re-express each as a `CatalogAbility` with the right `category` (debuff/buff uptimes → `single` + `uptimeAnnotated: true`; mark `tracked: true`).
> 2. For the remaining abilities shown in the reference casts sheets (per class — the column lists in `Tank - casts`, `Healer - casts`, `Caster - casts`, `Physical - casts`), add entries categorized as `single`/`aoe`/`cooldown`/`heal`. Author spell ids from wago.tools; any not confirmed in-session get `verified: false`.
> 3. The casts builder (Task 10) lists catalog rows even at 0 casts, so coverage breadth matters more than perfection; the `verified` flag is the existing convention for "needs Wowhead check."
> This task may be split per class across commits if convenient (one commit per class block) — keep each block test-green.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { classAbilityCatalog } from "./classAbilityCatalog";
import { classAbilities } from "./classAbilities";

describe("classAbilityCatalog", () => {
  it("has unique (className,key) and valid categories", () => {
    const seen = new Set<string>();
    for (const a of classAbilityCatalog) {
      const k = `${a.className}:${a.key}`;
      expect(seen.has(k)).toBe(false); seen.add(k);
      expect(["single", "aoe", "cooldown", "heal"]).toContain(a.category);
      expect(a.spellIds.length).toBeGreaterThan(0);
    }
  });
  it("covers every tracked classAbilities entry", () => {
    for (const t of classAbilities) {
      expect(classAbilityCatalog.some((c) => c.className === t.className && c.key === t.key)).toBe(true);
    }
  });
  it("groups by the eight raid classes", () => {
    const classes = new Set(classAbilityCatalog.map((a) => a.className));
    for (const c of ["Warrior","Paladin","Hunter","Rogue","Priest","Shaman","Mage","Warlock","Druid"]) {
      expect(classes.has(c)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w packages/data -- classAbilityCatalog`
Expected: FAIL — module not found / coverage assertion fails.

- [ ] **Step 3: Implement the catalog**

Create `packages/data/src/classAbilityCatalog.ts`. Start from the `classAbilities` seed, then expand per class using the reference casts-sheet column lists. Illustrative slice (continue for all classes/abilities):

```ts
import type { Role } from "@wcl/core";
export type CastCategory = "single" | "aoe" | "cooldown" | "heal";
export interface CatalogAbility {
  className: string; key: string; name: string; category: CastCategory;
  spellIds: number[]; ranks?: { spellId: number; rank: number }[];
  uptimeAnnotated?: boolean; appliesToRole?: Role; tracked?: boolean; verified?: boolean;
}

export const classAbilityCatalog: CatalogAbility[] = [
  // ---- Paladin (seed from classAbilities + casts-sheet columns) ----
  { className: "Paladin", key: "judgement-of-wisdom", name: "Judgement of Wisdom", category: "single",
    spellIds: [20354, 20355, 27164], uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Paladin", key: "holy-shield", name: "Holy Shield", category: "cooldown",
    spellIds: [20925, 20927, 20928, 27179], verified: false }, // TODO verify
  { className: "Paladin", key: "consecration", name: "Consecration", category: "aoe",
    spellIds: [26573, 20116, 20922, 20923, 20924, 27173], verified: false }, // TODO verify
  // …Cleanse, Avenger's Shield, Hammer of Wrath, Seal of Righteousness, Flash of Light
  //   (rank-grouped, category "heal", uptimeAnnotated:false, overheal shown by builder)…

  // ---- Druid / Warrior / Hunter / Rogue / Priest / Shaman / Mage / Warlock ----
  // …author each class block from its casts-sheet columns…
];
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w packages/data -- classAbilityCatalog`
Expected: PASS (all three assertions, including tracked-coverage and 9-class coverage).

- [ ] **Step 5: Export & commit**

Add `export * from "./classAbilityCatalog";` to `packages/data/src/index.ts`.

```bash
git add packages/data/src/classAbilityCatalog.ts packages/data/src/index.ts packages/data/src/classAbilityCatalog.test.ts
git commit -m "feat(data): add full per-class ability catalog for RPB casts sheets"
```

---

# Phase 3 — Core builders

### Task 10: `roleCasts` builder

**Files:**
- Create: `packages/core/src/rpbSheets.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/rpbSheets.test.ts`

**Interfaces:**
- Consumes: `ReportData`; `activity()` (existing); a `CatalogAbility[]` injected (core stays pure — pass the catalog in via config, mirroring how `rpb()` receives `classAbilities`).
- Produces:
  - `interface RoleCastsConfig { catalog: CatalogAbilitySpec[]; activity: ActivityConfig; cooldownKeys: string[]; }`
  - `interface CastCell { key: string; name: string; category: CastCategory; castCount: number; uptimePct?: number; rankFlag: boolean; }`
  - `interface ClassCastBlock { className: string; players: { playerId: number; playerName: string }[]; abilities: { key: string; name: string; category: CastCategory }[]; counts: Map<string, CastCell>; /* key `${playerId}:${abilityKey}` */ activity: Map<number, ActivityResult | null>; }`
  - `function roleCasts(report: ReportData, role: Role, cfg: RoleCastsConfig): ClassCastBlock[] | null`

> `CatalogAbilitySpec`/`CastCategory` are structural copies in core (core does not import `@wcl/data` — mirror the `ClassAbilitySpec` pattern in `classMetrics.ts`). Return `null` when `report.playerCasts === undefined` (stale cache).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { roleCasts } from "./rpbSheets";
import type { ReportData } from "./types";

// minimal report: 1 boss fight (id 1, 0..1000ms), 1 Paladin player id 7 (role physical via detectRole?),
// use the role param directly. 3 casts of Holy Shield (guid 20925), 1 Consecration (26573).
function makeReport(): ReportData { /* construct with players, fights, playerCasts, playerTotals */ return /* … */ as any; }

describe("roleCasts", () => {
  it("groups abilities by class with per-player cast counts", () => {
    const report = makeReport();
    const blocks = roleCasts(report, "tank", {
      catalog: [
        { className: "Paladin", key: "holy-shield", name: "Holy Shield", category: "cooldown", spellIds: [20925] },
        { className: "Paladin", key: "consecration", name: "Consecration", category: "aoe", spellIds: [26573] },
      ],
      activity: { /* existing ActivityConfig shape */ } as any,
      cooldownKeys: ["holy-shield"],
    })!;
    const pala = blocks.find((b) => b.className === "Paladin")!;
    expect(pala.counts.get("7:holy-shield")!.castCount).toBe(3);
    expect(pala.counts.get("7:consecration")!.castCount).toBe(1);
  });

  it("returns null on a stale cache (no playerCasts)", () => {
    const report = { ...makeReport(), playerCasts: undefined } as ReportData;
    expect(roleCasts(report, "tank", { catalog: [], activity: {} as any, cooldownKeys: [] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w packages/core -- rpbSheets`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `roleCasts`**

Create `packages/core/src/rpbSheets.ts`. Reuse `detectRole`-assigned roles from `rpb()` rows OR re-detect; simplest is to filter `report.players` by the passed `role` using the same `rpb()` result. To stay pure and avoid recomputation, accept the role and resolve each player's role via `detectRole` (import from `./roles`) with a `RoleConfig` — but to keep the signature small, instead filter using the already-computed `rpb()` rows: have the web layer pass players-by-role. **Decision:** `roleCasts` re-runs `rpb(report, rpbCfg)` is overkill; instead accept the role and compute membership with `detectRole`. Add `roles: RoleConfig` to `RoleCastsConfig`.

```ts
import type { ReportData, Role } from "./types";
import { detectRole, type RoleConfig } from "./roles";
import { activity, type ActivityConfig, type ActivityResult } from "./activity";

export type CastCategory = "single" | "aoe" | "cooldown" | "heal";
export interface CatalogAbilitySpec {
  className: string; key: string; name: string; category: CastCategory;
  spellIds: number[]; ranks?: { spellId: number; rank: number }[]; uptimeAnnotated?: boolean;
}
export interface RoleCastsConfig { catalog: CatalogAbilitySpec[]; activity: ActivityConfig; roles: RoleConfig; cooldownKeys: string[]; }
export interface CastCell { key: string; name: string; category: CastCategory; castCount: number; uptimePct?: number; rankFlag: boolean; }
export interface ClassCastBlock {
  className: string;
  players: { playerId: number; playerName: string }[];
  abilities: { key: string; name: string; category: CastCategory }[];
  counts: Map<string, CastCell>;
  activity: Map<number, ActivityResult | null>;
}

export function roleCasts(report: ReportData, role: Role, cfg: RoleCastsConfig): ClassCastBlock[] | null {
  if (report.playerCasts === undefined) return null;
  const fightIds = new Set(report.fights.filter((f) => !f.name.toLowerCase().includes("kalecgos")).map((f) => f.id));
  const members = report.players.filter((p) => detectRole(p.id, report, cfg.roles) === role);

  const byClass = new Map<string, typeof members>();
  for (const p of members) {
    const arr = byClass.get(p.class) ?? []; arr.push(p); byClass.set(p.class, arr);
  }

  const blocks: ClassCastBlock[] = [];
  for (const [className, players] of byClass) {
    const abilities = cfg.catalog.filter((a) => a.className === className);
    const counts = new Map<string, CastCell>();
    const act = new Map<number, ActivityResult | null>();
    for (const p of players) {
      const myCasts = report.playerCasts!.filter((c) => c.playerId === p.id && fightIds.has(c.fightId));
      for (const a of abilities) {
        const ids = new Set(a.spellIds);
        const castCount = myCasts.filter((c) => ids.has(c.spellId)).length;
        counts.set(`${p.id}:${a.key}`, { key: a.key, name: a.name, category: a.category, castCount, rankFlag: false });
      }
      act.set(p.id, activity(p.id, report, cfg.activity, fightIds));
    }
    blocks.push({
      className, players: players.map((p) => ({ playerId: p.id, playerName: p.name })),
      abilities: abilities.map((a) => ({ key: a.key, name: a.name, category: a.category })),
      counts, activity: act,
    });
  }
  return blocks;
}
```

> Keep the `kalecgos` exclusion as a local matcher consistent with `rpb.ts:49`. (If you prefer, export a shared `isKalecgos` from a common module and use it in both — optional cleanup, not required.)

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w packages/core -- rpbSheets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rpbSheets.ts packages/core/src/index.ts packages/core/src/rpbSheets.test.ts
git commit -m "feat(core): add roleCasts builder for RPB casts sheets"
```

---

### Task 11: `roleSheet` builder

**Files:**
- Modify: `packages/core/src/rpbSheets.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/rpbSheets.test.ts`

**Interfaces:**
- Consumes: `ReportData` (`hitStats`, `trinketUses`, `enemyDebuffs`, `abilityMeta`); existing `rpb()` rows for deaths/FF/reflected/PvP/absorbed/avoidable; `avoidableDebuffIds` injected via config.
- Produces:
  - `interface RoleSheetRow { playerId: number; playerName: string; className: string; hitStats?: PlayerHitStats; trinketUses: TrinketUse[]; avoidableByAbility: { name: string; amount: number }[]; debuffsApplied: { name: string; count: number }[]; deaths: number; friendlyFire: number; damageReflected: number; damageToHostilePlayers: number; totalAvoidableDamageTaken: number; }`
  - `function roleSheet(report: ReportData, role: Role, cfg: RoleSheetConfig): RoleSheetRow[] | null`
  - `interface RoleSheetConfig { roles: RoleConfig; rpb: RpbConfig; avoidableDebuffIds: { spellId: number; name: string }[]; }`

- [ ] **Step 1: Write the failing test**

```ts
import { roleSheet } from "./rpbSheets";

describe("roleSheet", () => {
  it("surfaces hit stats, trinkets and avoidable debuff counts per player", () => {
    const report = makeReportWithHitStats(); // player 7 with hitStats + 1 trinketUse + 2 Nether Vapor debuff applies
    const rows = roleSheet(report, "tank", {
      roles: defaultRoleConfig(),
      rpb: defaultRpbConfig(),
      avoidableDebuffIds: [{ spellId: 35013, name: "Nether Vapor" }],
    })!;
    const r = rows.find((x) => x.playerId === 7)!;
    expect(r.hitStats?.outgoing.crit.count).toBeGreaterThanOrEqual(0);
    expect(r.trinketUses.length).toBeGreaterThan(0);
    expect(r.debuffsApplied.find((d) => d.name === "Nether Vapor")?.count).toBe(2);
  });

  it("returns null on a stale cache (no playerTotals)", () => {
    const report = { ...makeReportWithHitStats(), playerTotals: undefined } as ReportData;
    expect(roleSheet(report, "tank", { /* cfg */ } as any)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w packages/core -- rpbSheets`
Expected: FAIL — `roleSheet` not exported.

- [ ] **Step 3: Implement `roleSheet`**

Append to `packages/core/src/rpbSheets.ts`. Reuse `rpb()` for the damage/death numbers (avoids duplicating that logic):

```ts
import { rpb, type RpbConfig } from "./rpb";
import type { PlayerHitStats, TrinketUse } from "./types";

export interface RoleSheetConfig { roles: RoleConfig; rpb: RpbConfig; avoidableDebuffIds: { spellId: number; name: string }[]; }
export interface RoleSheetRow {
  playerId: number; playerName: string; className: string;
  hitStats?: PlayerHitStats; trinketUses: TrinketUse[];
  avoidableByAbility: { name: string; amount: number }[];
  debuffsApplied: { name: string; count: number }[];
  deaths: number; friendlyFire: number; damageReflected: number;
  damageToHostilePlayers: number; totalAvoidableDamageTaken: number;
}

export function roleSheet(report: ReportData, role: Role, cfg: RoleSheetConfig): RoleSheetRow[] | null {
  if (report.playerTotals === undefined) return null;
  const result = rpb(report, cfg.rpb);
  if (!result) return null;
  const fightIds = new Set(report.fights.filter((f) => !f.name.toLowerCase().includes("kalecgos")).map((f) => f.id));
  const hitById = new Map((report.hitStats ?? []).map((h) => [h.playerId, h]));
  const trinketsById = new Map<number, TrinketUse[]>();
  for (const t of report.trinketUses ?? []) {
    const arr = trinketsById.get(t.playerId) ?? []; arr.push(t); trinketsById.set(t.playerId, arr);
  }
  const meta = report.abilityMeta ?? {};
  const debuffSpec = new Map(cfg.avoidableDebuffIds.map((d) => [d.spellId, d.name]));

  return result.rows.filter((r) => r.role === role).map((r) => {
    // avoidable damage broken out by ability (names via abilityMeta)
    const dmgByAbility = new Map<number, number>();
    for (const d of report.damageTakenEvents ?? []) {
      if (d.targetPlayerId !== r.playerId || !fightIds.has(d.fightId)) continue;
      if (!cfg.rpb.avoidableAbilityIds.has(d.abilityId)) continue;
      dmgByAbility.set(d.abilityId, (dmgByAbility.get(d.abilityId) ?? 0) + d.amount);
    }
    // tracked avoidable debuff APPLICATIONS this player applied
    const debuffCounts = new Map<number, number>();
    for (const e of report.enemyDebuffs ?? []) {
      if (e.sourceId !== r.playerId || !fightIds.has(e.fightId)) continue;
      if (!debuffSpec.has(e.spellId)) continue;
      debuffCounts.set(e.spellId, (debuffCounts.get(e.spellId) ?? 0) + 1);
    }
    return {
      playerId: r.playerId, playerName: r.playerName, className: r.className,
      hitStats: hitById.get(r.playerId),
      trinketUses: trinketsById.get(r.playerId) ?? [],
      avoidableByAbility: [...dmgByAbility].map(([id, amount]) => ({ name: meta[String(id)]?.name ?? `#${id}`, amount }))
        .sort((a, b) => b.amount - a.amount),
      debuffsApplied: [...debuffCounts].map(([id, count]) => ({ name: debuffSpec.get(id)!, count })),
      deaths: r.deaths, friendlyFire: r.friendlyFire, damageReflected: r.damageReflected,
      damageToHostilePlayers: r.damageToHostilePlayers, totalAvoidableDamageTaken: r.totalAvoidableDamageTaken,
    };
  });
}
```

> Note `enemyDebuffs` are stored as merged intervals (one per application window), so counting intervals = counting applications, matching the sheet's "debuffs applied" count.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w packages/core -- rpbSheets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rpbSheets.ts packages/core/src/index.ts packages/core/src/rpbSheets.test.ts
git commit -m "feat(core): add roleSheet builder for RPB role sheets"
```

---

# Phase 4 — Web UI

### Task 12: Config wiring

**Files:**
- Modify: `apps/web/src/lib/analysisConfig.ts`
- Test: `apps/web/src/lib/analysisConfig.test.ts` (create if absent, else extend)

**Interfaces:**
- Consumes: `@wcl/data` (`classAbilityCatalog`, `avoidableDebuffIds`), existing `buildRpbConfig`.
- Produces: `roleSheetConfig(): RoleSheetConfig` and `roleCastsConfig(): RoleCastsConfig`.

- [ ] **Step 1: Write the failing test**

```ts
import { roleSheetConfig, roleCastsConfig } from "./analysisConfig";
it("builds role sheet and casts configs", () => {
  expect(roleCastsConfig().catalog.length).toBeGreaterThan(0);
  expect(roleSheetConfig().avoidableDebuffIds.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w apps/web -- analysisConfig`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement**

In `apps/web/src/lib/analysisConfig.ts`, mirror `buildRpbConfig`'s structure:

```ts
import { classAbilityCatalog, avoidableDebuffIds } from "@wcl/data";
import type { RoleSheetConfig, RoleCastsConfig } from "@wcl/core";

export function roleCastsConfig(): RoleCastsConfig {
  const base = buildRpbConfig();
  return { catalog: classAbilityCatalog, activity: base.activity, roles: base.roles,
    cooldownKeys: classAbilityCatalog.filter((a) => a.category === "cooldown").map((a) => a.key) };
}
export function roleSheetConfig(): RoleSheetConfig {
  const base = buildRpbConfig();
  return { roles: base.roles, rpb: base, avoidableDebuffIds };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w apps/web -- analysisConfig`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/analysisConfig.ts apps/web/src/lib/analysisConfig.test.ts
git commit -m "feat(web): add role sheet/casts analysis configs"
```

---

### Task 13: `RoleSheetTable` component

**Files:**
- Create: `apps/web/src/components/report/RoleSheetTable.tsx`
- Test: `apps/web/src/components/report/RoleSheetTable.test.tsx`

**Interfaces:**
- Consumes: `roleSheet` + `roleSheetConfig`, `scopeReportToFight`.
- Produces: `RoleSheetTable({ report, fightId, role, onPlayer })` rendering players as rows with Stats/Trinkets/Avoidable/Debuffs column bands.

- [ ] **Step 1: Write the failing test**

```ts
import { render, screen } from "@testing-library/react";
import { RoleSheetTable } from "./RoleSheetTable";
it("renders a row per player in the role with a deaths cell", () => {
  const report = makeReportWithHitStats(); // shared fixture w/ tank player "Abafamos"
  render(<RoleSheetTable report={report} fightId={ALL_FIGHTS} role="tank" onPlayer={() => {}} />);
  expect(screen.getByText("Abafamos")).toBeInTheDocument();
  expect(screen.getByText("# of deaths in total")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w apps/web -- RoleSheetTable`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

Create the component. Players as rows; section headers (`Stats and Miscellaneous`, `Trinkets and Racials`, `Raw avoidable damage taken by tracked abilities`, `Avoidable debuffs applied by tracked abilities`) as labeled column groups. Use `useMemo(() => roleSheet(scopeReportToFight(report, fightId), role, roleSheetConfig()), …)`. Render the stale-cache notice when it returns `null` (reuse the `SummaryView` notice copy). Format hit stats as `count (pct%)`, blanks as `—`. Color deaths / avoidable via existing `deathsHeat`/`relativeHeat` + `heatClass`. Use `classColorVar(className)` on the player cell and a `player-link` button calling `onPlayer`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w apps/web -- RoleSheetTable`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/report/RoleSheetTable.tsx apps/web/src/components/report/RoleSheetTable.test.tsx
git commit -m "feat(web): add RoleSheetTable (players-as-rows role sheet)"
```

---

### Task 14: `RoleCastsTable` component

**Files:**
- Create: `apps/web/src/components/report/RoleCastsTable.tsx`
- Test: `apps/web/src/components/report/RoleCastsTable.test.tsx`

**Interfaces:**
- Consumes: `roleCasts` + `roleCastsConfig`, `scopeReportToFight`.
- Produces: `RoleCastsTable({ report, fightId, role, onPlayer })` rendering one sub-table per class (rows = players, columns = that class's abilities) followed by an activity sub-table.

- [ ] **Step 1: Write the failing test**

```ts
import { RoleCastsTable } from "./RoleCastsTable";
it("renders one sub-table per class with ability columns", () => {
  const report = makeReportWithHitStats(); // tank Paladin "Xws" with Holy Shield casts
  render(<RoleCastsTable report={report} fightId={ALL_FIGHTS} role="tank" onPlayer={() => {}} />);
  expect(screen.getByText("Paladins")).toBeInTheDocument(); // class block header (pluralized)
  expect(screen.getByText("Holy Shield")).toBeInTheDocument();
  expect(screen.getByText("Xws")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w apps/web -- RoleCastsTable`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

Create the component. `useMemo(() => roleCasts(scopeReportToFight(report, fightId), role, roleCastsConfig()), …)`; null → stale notice. For each `ClassCastBlock`, render a class-titled card (`<className>s`), a table with player rows and one column per `block.abilities`, cell value `block.counts.get(\`${playerId}:${key}\`)?.castCount ?? 0`, then an "Activity" mini-table from `block.activity` (seconds/relative ST/AoE). Group ability columns by category (single/aoe/cooldown) with sub-headers, mirroring the sheet sections. Color cooldown/active cells with existing heat helpers where sensible (uptime via `relativeHeat`).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w apps/web -- RoleCastsTable`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/report/RoleCastsTable.tsx apps/web/src/components/report/RoleCastsTable.test.tsx
git commit -m "feat(web): add RoleCastsTable (per-class casts sub-tables)"
```

---

### Task 15: `RoleBreakdownView` sub-nav + ReportPage wiring

**Files:**
- Create: `apps/web/src/components/report/RoleBreakdownView.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx`
- Test: `apps/web/src/components/report/RoleBreakdownView.test.tsx`

**Interfaces:**
- Consumes: `SummaryView` (Overview), `RoleSheetTable`, `RoleCastsTable`; `ALL_FIGHTS`/`ALL_TRASH` from `scopeReport`.
- Produces: `RoleBreakdownView({ report, fightId, onPlayer })` owning the `sub=` URL param, rendering 9 sub-tabs on the BOSSES card and only `Overview` elsewhere.

- [ ] **Step 1: Write the failing test**

```ts
import { MemoryRouter } from "react-router-dom";
import { RoleBreakdownView } from "./RoleBreakdownView";
function renderAt(fightId: number) {
  return render(<MemoryRouter><RoleBreakdownView report={makeReportWithHitStats()} fightId={fightId} onPlayer={() => {}} /></MemoryRouter>);
}
it("shows all 9 sub-tabs on the BOSSES card", () => {
  renderAt(ALL_FIGHTS);
  for (const t of ["Overview","Tank","Tank - Casts","Healer","Healer - Casts","Caster","Caster - Casts","Physical","Physical - Casts"]) {
    expect(screen.getByRole("button", { name: t })).toBeInTheDocument();
  }
});
it("shows only Overview on the TRASH card", () => {
  renderAt(ALL_TRASH);
  expect(screen.getByRole("button", { name: "Overview" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tank - Casts" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w apps/web -- RoleBreakdownView`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the sub-nav**

Create `RoleBreakdownView.tsx`. Define the sub-tab list:

```tsx
const SUBS = [
  ["overview", "Overview"],
  ["tank", "Tank"], ["tank-casts", "Tank - Casts"],
  ["healer", "Healer"], ["healer-casts", "Healer - Casts"],
  ["caster", "Caster"], ["caster-casts", "Caster - Casts"],
  ["physical", "Physical"], ["physical-casts", "Physical - Casts"],
] as const;
```

Read/write a `sub` URL param via `useSearchParams` (same pattern as `ReportPage`'s `cat`). `bossesCard = fightId === ALL_FIGHTS`. When not `bossesCard`, restrict `SUBS` to `overview` only and force `sub="overview"`. Render a `.cat-subnav`-style button row, then switch on the active sub: `overview` → `<SummaryView report fightId onPlayer />`; `*-casts` → `<RoleCastsTable role=… />`; role → `<RoleSheetTable role=… />`. Map sub key → `Role` (`tank`/`healer`/`caster`/`physical`).

- [ ] **Step 4: Wire into ReportPage**

In `apps/web/src/pages/ReportPage.tsx`, replace the `roles` case:

```tsx
{cat === "roles" && <RoleBreakdownView report={report} fightId={fightId} onPlayer={goPlayer} />}
```

Add the import; remove the now-unused direct `SummaryView` import only if nothing else uses it (it's used inside `RoleBreakdownView` now). Leave `BOSSES_ONLY_CATS` as-is (Overview must remain available on all cards, so `roles` stays out of `BOSSES_ONLY_CATS`; the per-sub gating lives in `RoleBreakdownView`).

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -w apps/web -- RoleBreakdownView` then `npm test -w apps/web`
Expected: PASS (new test + no regressions).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/report/RoleBreakdownView.tsx apps/web/src/pages/ReportPage.tsx apps/web/src/components/report/RoleBreakdownView.test.tsx
git commit -m "feat(web): nest 9 Role Breakdown sub-tabs (Overview + role/casts sheets)"
```

---

### Task 16: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run every workspace's tests**

Run:
```
npm test -w packages/data && npm test -w packages/core && npm test -w apps/api && npm test -w apps/web
```
Expected: all PASS.

- [ ] **Step 2: Typecheck the committed tree**

Run: `npm run -w packages/core build && npm run -w apps/api build`
Expected: no type errors.

- [ ] **Step 3: Manual smoke (optional, needs WCL creds)**

Load the reference SSC/TK report in the web app, open Role Breakdown on the BOSSES card, confirm all 9 sub-tabs render and the Tank/Tank-Casts numbers resemble the reference workbook. Spot-check that non-BOSSES cards show only Overview.

- [ ] **Step 4: Update TODO.md**

Mark the "RPB Report (except consumables part)" item done (or note remaining `verified:false` ids to confirm).

```bash
git add TODO.md
git commit -m "docs: mark RPB role breakdown sheets done"
```

---

## Self-review

**Spec coverage:**
- Role sheets — Stats/hit-types → Tasks 4–5; Trinkets → Tasks 4,7; Avoidable dmg/debuffs/deaths/FF/reflected/PvP → Task 11; rendering → Task 13. ✓
- Casts sheets — cast counts/catalog → Tasks 9,10; activity → Task 10; rendering (per-class sub-tables) → Task 14. ✓ Cooldown on-trash/on-bosses/total split: model carries `cooldownKeys`; BOSSES-only view renders boss counts with trash=0 (Task 10/14). ✓
- 9 sub-tabs, Overview kept, BOSSES-only gating → Task 15. ✓
- Players-as-rows orientation → Tasks 13,14. ✓
- Hybrid sourcing / table API / masterData names → Tasks 2,4 (`abilityMeta` already populated). ✓
- Stale-cache notices → Tasks 10,11,13,14. ✓

**Placeholder scan:** Data-authoring tasks (7–9) intentionally ship `verified:false` ids rather than fabricated-confident ids — this is the project's documented convention, not a placeholder. Every code step shows real code. The one genuine unknown (exact WCL hit-type field names) is gated behind Task 1's probe and centralized in Task 2 so a single edit propagates.

**Type consistency:** `PlayerHitStats`/`HitStat`/`TrinketUse` defined in Task 3 are consumed unchanged in Tasks 4, 11. `CatalogAbility` (data, Task 9) vs `CatalogAbilitySpec` (core structural copy, Task 10) mirror the existing `ClassAbility`/`ClassAbilitySpec` split — intentional, not a mismatch. `RoleSheetConfig`/`RoleCastsConfig` produced in Tasks 10–11 are consumed in Task 12. `fetchHitTable` dataType union is widened to include `"Healing"` in Task 6 (noted inline).

**Ordering caveat (important):** Phase 2 (Tasks 7–9) must be implemented **before** Task 6, because Task 6 imports `trinketRacials`/`extraWindfurySpellId`/`battleSquawkBuffId`/`avoidableDebuffIds`/`classAbilityCatalog`. Recommended execution order: **1 → 2 → 3 → 7 → 8 → 9 → 4 → 5 → 6 → 10 → 11 → 12 → 13 → 14 → 15 → 16.**
