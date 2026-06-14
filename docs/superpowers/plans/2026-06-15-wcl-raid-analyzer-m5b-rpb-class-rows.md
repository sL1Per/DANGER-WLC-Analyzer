# M5b — RPB class/role-specific ability rows + M5a deferred items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-class buff/debuff ability rows (with rank-checking) to the RPB tab, and fold in the M5a deferred items (real absorbs, true avoidable-damage filtering, reflected/hostile partitioning, boss-fight fetch scoping).

**Architecture:** A data-driven `ClassAbility` table in `@wcl/data` drives all class rows; a new pure `classMetrics()` in `@wcl/core` computes uptime%/cast-count + rank flags from already-normalized casts plus one new normalized field (`enemyDebuffs`). `apps/api` gains two fetchers (enemy debuffs, absorbs) and scopes all RPB event fetches to boss fights. `apps/web` renders a class-row block per player.

**Tech Stack:** TypeScript, pnpm monorepo, Vitest, Hono (api), React 19 + Vite (web). Spec: `docs/superpowers/specs/2026-06-15-wcl-raid-analyzer-m5b-rpb-class-rows-design.md`.

**Conventions to honor:**
- `@wcl/core` is pure: no I/O, never imports `@wcl/data`. Reference data is injected via config objects.
- Severity color convention: results carry `severity: "major" | "moderate" | "minor" | "ok"`; web uses `sev-*` classes + `<SeverityLegend />`.
- Curated spell ids are Wowhead-verified; uncertain ones flagged `verified: false` and surfaced in the UI.
- Pre-M5b caches lack the new `ReportData` fields → analyses degrade gracefully (the class-row block shows a refresh notice), same pattern as M3/M4/M5a.
- Folder name has a double space — always quote paths.

**Test/build commands:**
- Core: `pnpm --filter @wcl/core test`
- Data: `pnpm --filter @wcl/data test`
- Api: `pnpm --filter @wcl/api test`
- Web: `pnpm --filter @wcl/web test`
- All: `pnpm -r test`
- Typecheck (core/data/api have `tsc --noEmit` via test/build; web: `pnpm --filter @wcl/web build`)

---

## Phase 1 — Infra: types, fetch scoping, new fetchers, normalize

### Task 1: Add `EnemyDebuffInterval` type to core

**Files:**
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Add the type and ReportData field**

In `packages/core/src/types.ts`, add a new field to the `ReportData` RPB block (after the `absorbs?` line, line ~28):

```ts
  /** enemy-debuff intervals sourced by a player (M5b+); undefined = cached before M5b */
  enemyDebuffs?: EnemyDebuffInterval[];
```

Then add the interface near `BuffInterval` (after line 40):

```ts
/** A debuff a player applied to an enemy, clamped to one fight (report-relative ms). */
export interface EnemyDebuffInterval {
  fightId: number;
  /** the player who applied the debuff */
  sourceId: number;
  /** the enemy actor the debuff is on */
  targetEnemyId: number;
  spellId: number;
  startTime: number;
  endTime: number;
}
```

- [ ] **Step 2: Verify core still compiles**

Run: `pnpm --filter @wcl/core test`
Expected: PASS (no behavior change; type only).

- [ ] **Step 3: Commit**

```bash
git add "packages/core/src/types.ts"
git commit -m "feat(core): add EnemyDebuffInterval type + ReportData.enemyDebuffs field"
```

---

### Task 2: Scope the events query to boss fights (M5a deferred item d)

**Files:**
- Modify: `apps/api/src/wcl.ts`
- Test: `apps/api/src/wcl.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/api/src/wcl.test.ts`, add a test that `fetchAllCasts` passes `fightIDs` into the query. Find the existing `gql`/`fetch` mock pattern in that file and mirror it. Add:

```ts
it("scopes fetchAllCasts to the given boss fight ids", async () => {
  const calls: any[] = [];
  const fakeFetch = vi.fn(async (_url: string, init: any) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ data: { reportData: { report: { events: { data: [], nextPageTimestamp: null } } } } }) } as any;
  });
  vi.stubGlobal("fetch", fakeFetch);
  await fetchAllCasts("RPT", "tok", [11, 22]);
  expect(calls[0].variables.fightIds).toEqual([11, 22]);
  vi.unstubAllGlobals();
});
```

Ensure `fetchAllCasts` is imported in the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wcl/api test -- wcl.test.ts`
Expected: FAIL (`fetchAllCasts` takes no fightIds; variables.fightIds undefined).

- [ ] **Step 3: Add `fightIDs` to EVENTS_QUERY and thread the param**

In `apps/api/src/wcl.ts`:

Change `EVENTS_QUERY` (line ~116) to accept `$fightIds`:

```ts
const EVENTS_QUERY = `
query Events($code: String!, $dataType: EventDataType!, $filter: String, $start: Float, $fightIds: [Int]) {
  reportData {
    report(code: $code) {
      events(dataType: $dataType, filterExpression: $filter, fightIDs: $fightIds, startTime: $start, endTime: 100000000000) {
        data
        nextPageTimestamp
      }
    }
  }
}`;
```

Change `fetchAllEvents` (line ~218) to accept and forward `fightIds`:

```ts
async function fetchAllEvents(
  code: string, accessToken: string, dataType: string, keepTypes: Set<string>,
  fightIds?: number[],
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let start = 0;
  for (;;) {
    const data = await gql<{ reportData: { report: { events: { data: Record<string, unknown>[]; nextPageTimestamp: number | null } } } }>(
      EVENTS_QUERY, { code, dataType, filter: null, start, fightIds: fightIds ?? null }, accessToken);
    const page = data.reportData.report.events;
    for (const e of page.data) if (keepTypes.has(e.type as string)) out.push(e);
    if (page.nextPageTimestamp == null || page.nextPageTimestamp <= start) break;
    start = page.nextPageTimestamp;
  }
  return out;
}
```

Update the three callers to take and forward `fightIds`:

```ts
export async function fetchAllCasts(code: string, accessToken: string, fightIds?: number[]): Promise<RawCastEvent[]> {
  return await fetchAllEvents(code, accessToken, "Casts", new Set(["cast"]), fightIds) as unknown as RawCastEvent[];
}

export async function fetchInterrupts(code: string, accessToken: string, fightIds?: number[]): Promise<RawInterruptEvent[]> {
  return await fetchAllEvents(code, accessToken, "Interrupts", new Set(["interrupt"]), fightIds) as unknown as RawInterruptEvent[];
}

export async function fetchDamageTaken(code: string, accessToken: string, fightIds?: number[]): Promise<RawDamageEvent[]> {
  return await fetchAllEvents(code, accessToken, "DamageTaken", new Set(["damage"]), fightIds) as unknown as RawDamageEvent[];
}

export async function fetchDamageDone(code: string, accessToken: string, fightIds?: number[]): Promise<RawDamageEvent[]> {
  return await fetchAllEvents(code, accessToken, "DamageDone", new Set(["damage"]), fightIds) as unknown as RawDamageEvent[];
}
```

Also update the `fetchEvents` `EVENTS_QUERY` callers (`fetchBuffEvents`/`fetchCastEvents`/`fetchDeaths`) — they pass variables without `fightIds`; add `fightIds: null` to the `fetchEvents` and `fetchDeaths` variable objects so the query variable is always supplied. In `fetchEvents` (line ~144) change the variables to `{ code, dataType, filter, start, fightIds: null }`; in `fetchDeaths` (line ~177) change to `{ code, dataType: "Deaths", filter: null, start, fightIds: null }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wcl/api test -- wcl.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full api suite (regression)**

Run: `pnpm --filter @wcl/api test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "apps/api/src/wcl.ts" "apps/api/src/wcl.test.ts"
git commit -m "feat(api): scope RPB event fetches to fightIDs (M5a deferred: respect WCL points budget)"
```

---

### Task 3: Add `fetchEnemyDebuffs` and `fetchAbsorbs` fetchers

**Files:**
- Modify: `apps/api/src/wcl.ts`
- Test: `apps/api/src/wcl.test.ts`

> Note: real WCL event shapes for `Debuffs` and absorbs are validated separately via `apps/api/scripts/probe-damage.ts` before E2E (build env has no creds). These fetchers assume: Debuffs events have `sourceID` (player), `targetID` (enemy), `abilityGameID`, `timestamp`, `fight`, types `applydebuff`/`removedebuff`/`refreshdebuff`. Absorbs come as DamageTaken events carrying an `absorbed` amount (shield absorb) — see Step 3 comment; confirm in the probe and adjust the keep-filter if WCL emits a distinct `absorbed` event type.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/wcl.test.ts` add:

```ts
it("fetchEnemyDebuffs keeps debuff apply/remove/refresh and scopes to fights", async () => {
  const calls: any[] = [];
  const fakeFetch = vi.fn(async (_url: string, init: any) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ data: { reportData: { report: { events: {
      data: [
        { type: "applydebuff", sourceID: 1, targetID: 9, abilityGameID: 27228, timestamp: 100, fight: 5 },
        { type: "cast", sourceID: 1, targetID: 9, abilityGameID: 1, timestamp: 100, fight: 5 },
      ], nextPageTimestamp: null } } } } }) } as any;
  });
  vi.stubGlobal("fetch", fakeFetch);
  const out = await fetchEnemyDebuffs("RPT", "tok", [5]);
  expect(out.map((e) => e.type)).toEqual(["applydebuff"]);
  expect(calls[0].variables.fightIds).toEqual([5]);
  vi.unstubAllGlobals();
});
```

Import `fetchEnemyDebuffs` in the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wcl/api test -- wcl.test.ts`
Expected: FAIL (`fetchEnemyDebuffs` is not exported).

- [ ] **Step 3: Implement both fetchers**

In `apps/api/src/wcl.ts`, after `fetchDamageDone` (line ~215) add:

```ts
export interface RawDebuffEvent {
  timestamp: number; type: string; sourceID: number; targetID: number;
  abilityGameID: number; fight: number;
}

/** Debuff apply/remove/refresh events on enemies, sourced by players. Scoped to
 *  the given fights. Used to compute per-player debuff uptime on the boss. */
export async function fetchEnemyDebuffs(
  code: string, accessToken: string, fightIds: number[],
): Promise<RawDebuffEvent[]> {
  return await fetchAllEvents(code, accessToken, "Debuffs",
    new Set(["applydebuff", "removedebuff", "refreshdebuff"]), fightIds) as unknown as RawDebuffEvent[];
}

/** Absorb amounts on players. WCL surfaces shield absorbs as DamageTaken events
 *  with a non-zero `absorbed` field; we keep those. (Validate via the probe — if
 *  WCL emits a distinct `absorbed` event type for your reports, add it here.) */
export async function fetchAbsorbs(
  code: string, accessToken: string, fightIds: number[],
): Promise<RawDamageEvent[]> {
  const events = await fetchAllEvents(code, accessToken, "DamageTaken",
    new Set(["damage", "absorbed"]), fightIds) as unknown as RawDamageEvent[];
  return events.filter((e) => (e.absorbed ?? 0) > 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wcl/api test -- wcl.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/api/src/wcl.ts" "apps/api/src/wcl.test.ts"
git commit -m "feat(api): add fetchEnemyDebuffs + fetchAbsorbs fetchers (M5b infra)"
```

---

### Task 4: Normalize enemy debuffs + absorbs into ReportData

**Files:**
- Modify: `apps/api/src/normalize.ts`
- Test: `apps/api/src/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/api/src/normalize.test.ts`, find an existing `normalizeReport`/`buildRpb` test to mirror inputs. Add:

```ts
it("normalizes enemy debuffs (player source, enemy target) into intervals", () => {
  // players are ids 1..; enemy actor is id 99 (not in playerIds)
  const data = normalizeReport("RPT", baseRaw, [], {}, {
    allCasts: [],
    enemyDebuffs: [
      { type: "applydebuff", sourceID: 1, targetID: 99, abilityGameID: 27228, timestamp: 1000, fight: F },
      { type: "removedebuff", sourceID: 1, targetID: 99, abilityGameID: 27228, timestamp: 4000, fight: F },
    ],
  } as any);
  expect(data.enemyDebuffs).toEqual([
    { fightId: F, sourceId: 1, targetEnemyId: 99, spellId: 27228, startTime: 1000, endTime: 4000 },
  ]);
});

it("normalizes absorbs to AbsorbEvent per player", () => {
  const data = normalizeReport("RPT", baseRaw, [], {}, {
    allCasts: [],
    absorbEvents: [
      { type: "damage", sourceID: 50, targetID: 1, abilityGameID: 29166, amount: 0, absorbed: 1200, fight: F },
    ],
  } as any);
  expect(data.absorbs).toEqual([{ fightId: F, playerId: 1, spellId: 29166, amount: 1200 }]);
});
```

Use the test file's existing helpers for `baseRaw`/`F`/player ids (match the names already in `normalize.test.ts`; if they differ, adapt). The enemy target id (99) must NOT be a player id; player id 1 must be a player.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wcl/api test -- normalize.test.ts`
Expected: FAIL (`data.enemyDebuffs` undefined; `absorbEvents` not consumed).

- [ ] **Step 3: Extend NormalizeEventInputs and buildRpb**

In `apps/api/src/normalize.ts`:

Add to `NormalizeEventInputs` (after `damageTakenTable?` line ~41):

```ts
  /** debuff events on enemies, sourced by players (M5b) */
  enemyDebuffs?: RawDebuffEvent[];
  /** absorb-bearing damage-taken events on players (M5b) */
  absorbEvents?: RawDamageEvent[];
```

Add the import of `RawDebuffEvent` to the existing `./wcl` import block at the top of the file.

Extend `buildRpb`'s return Pick to include the new fields:

```ts
): Partial<Pick<ReportData,
  "playerTotals" | "playerDeaths" | "interrupts" | "damageTakenEvents" | "playerCasts" | "playerDamage"
  | "enemyDebuffs" | "absorbs">> {
```

Inside `buildRpb`, before the final `return`, build the two arrays. Enemy debuffs use an open/close sweep keyed by `fight:target:spell` (mirror `buildBuffIntervals`' approach but inline and enemy-targeted):

```ts
  // enemy debuffs sourced by a player → merged intervals (one open per fight:target:spell)
  const enemyDebuffs: EnemyDebuffInterval[] = [];
  {
    const fightById = new Map(fights.map((f) => [f.id, f]));
    const open = new Map<string, number>();
    const keyOf = (fid: number, tid: number, sid: number) => `${fid}:${tid}:${sid}`;
    for (const e of events.enemyDebuffs ?? []) {
      if (!playerIds.has(e.sourceID)) continue;       // source must be a player
      if (playerIds.has(e.targetID)) continue;        // target must be an enemy
      const fight = fightById.get(e.fight);
      if (!fight) continue;
      const key = keyOf(e.fight, e.targetID, e.abilityGameID);
      if (e.type === "applydebuff" || e.type === "refreshdebuff") {
        if (open.has(key)) continue;
        open.set(key, enemyDebuffs.length);
        enemyDebuffs.push({ fightId: e.fight, sourceId: e.sourceID, targetEnemyId: e.targetID, spellId: e.abilityGameID, startTime: e.timestamp, endTime: fight.endTime });
      } else if (e.type === "removedebuff") {
        const idx = open.get(key);
        if (idx !== undefined) { enemyDebuffs[idx].endTime = e.timestamp; open.delete(key); }
      }
    }
  }

  const absorbs: AbsorbEvent[] = (events.absorbEvents ?? [])
    .filter((d) => playerIds.has(d.targetID) && fightIds.has(d.fight))
    .map((d) => ({ fightId: d.fight, playerId: d.targetID, spellId: d.abilityGameID, amount: d.absorbed ?? 0 }));
```

Add `enemyDebuffs, absorbs` to the returned object. Import `EnemyDebuffInterval` and `AbsorbEvent` from `@wcl/core` (extend the existing core type import in this file). Guard: keep the existing early `return {}` when `allCasts === undefined && damageDoneTable === undefined` — the new fields only appear when RPB data was fetched.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wcl/api test -- normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full api suite**

Run: `pnpm --filter @wcl/api test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "apps/api/src/normalize.ts" "apps/api/src/normalize.test.ts"
git commit -m "feat(api): normalize enemyDebuffs + absorbs into ReportData (M5b)"
```

---

### Task 5: Wire new fetchers into app.ts (scoped to boss fights)

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/api/src/app.test.ts`, find the existing fake-deps object used to build the app (it stubs `fetchInterrupts`, `fetchAllCasts`, etc.). Add stubs `fetchEnemyDebuffs` and `fetchAbsorbs` returning `[]`, and assert the normalized `data.enemyDebuffs` is present (defined, even if empty) and `data.absorbs` is defined after a successful load. Mirror an existing "loads a report" test:

```ts
it("includes enemyDebuffs and absorbs in the normalized report", async () => {
  const app = createApp(testDeps);   // testDeps = existing stub object + the two new stubs
  const res = await app.request("/api/report/RPT", { headers: { Authorization: "Bearer t" } });
  const body = await res.json();
  expect(body.data.enemyDebuffs).toBeDefined();
  expect(body.data.absorbs).toBeDefined();
});
```

(If the existing tests assert exact normalized output, extend that fixture instead — match the file's established style.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wcl/api test -- app.test.ts`
Expected: FAIL (deps type missing the two fetchers / fields undefined).

- [ ] **Step 3: Add the fetchers to AppDeps, defaults, and the fetch block**

In `apps/api/src/app.ts`:

Add imports to the `./wcl` import block:

```ts
  fetchEnemyDebuffs as realFetchEnemyDebuffs,
  fetchAbsorbs as realFetchAbsorbs,
```
and `type RawDebuffEvent` to the type imports.

Add to `AppDeps`:

```ts
  fetchEnemyDebuffs: typeof realFetchEnemyDebuffs;
  fetchAbsorbs: typeof realFetchAbsorbs;
```
and to the default `deps` object:

```ts
  fetchEnemyDebuffs: realFetchEnemyDebuffs,
  fetchAbsorbs: realFetchAbsorbs,
```

In the boss-only fetch block (line ~146), scope the existing whole-report fetchers to `bossFightIds` and add the two new ones. Replace the `Promise.allSettled` array and result-binding:

```ts
        const [intR, dtR, ddR, castR, ddtR, htR, dttR, edR, absR] = await Promise.allSettled([
          deps.fetchInterrupts(id, token, bossFightIds),
          deps.fetchDamageTaken(id, token, bossFightIds),
          deps.fetchDamageDone(id, token, bossFightIds),
          deps.fetchAllCasts(id, token, bossFightIds),
          deps.fetchTable(id, token, "DamageDone", bossFightIds),
          deps.fetchTable(id, token, "Healing", bossFightIds),
          deps.fetchTable(id, token, "DamageTaken", bossFightIds),
          deps.fetchEnemyDebuffs(id, token, bossFightIds),
          deps.fetchAbsorbs(id, token, bossFightIds),
        ]);
        if (intR.status === "fulfilled") interrupts = intR.value as RawInterruptEvent[];
        if (dtR.status === "fulfilled") damageTaken = dtR.value as RawDamageEvent[];
        if (ddR.status === "fulfilled") damageDone = ddR.value as RawDamageEvent[];
        if (castR.status === "fulfilled") allCasts = castR.value as RawCastEvent[];
        if (ddtR.status === "fulfilled") damageDoneTable = ddtR.value as RawTableEntry[];
        if (htR.status === "fulfilled") healingTable = htR.value as RawTableEntry[];
        if (dttR.status === "fulfilled") damageTakenTable = dttR.value as RawTableEntry[];
        if (edR.status === "fulfilled") enemyDebuffs = edR.value as RawDebuffEvent[];
        if (absR.status === "fulfilled") absorbEvents = absR.value as RawDamageEvent[];
```

Add the two `let` declarations alongside the others (line ~139):

```ts
      let enemyDebuffs: RawDebuffEvent[] = [];
      let absorbEvents: RawDamageEvent[] = [];
```

Pass them into `normalizeReport` (line ~167 events object):

```ts
        interrupts, damageTaken, damageDone, allCasts,
        damageDoneTable, healingTable, damageTakenTable, actorNames,
        enemyDebuffs, absorbEvents,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wcl/api test -- app.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full api suite**

Run: `pnpm --filter @wcl/api test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "apps/api/src/app.ts" "apps/api/src/app.test.ts"
git commit -m "feat(api): fetch enemy debuffs + absorbs scoped to boss fights (M5b)"
```

---

## Phase 2 — Data curation: class abilities + avoidable abilities

> These tasks produce curated reference data. Spell ids below are a **starter set** from TBC knowledge; the implementer MUST cross-check each on Wowhead (classic.wowhead.com) and set `verified: true` only when confirmed, otherwise `verified: false`. Classic ranks are **distinct spell ids** — get them right (the rank table is the most error-prone part). Tests assert structural invariants, not specific id values.

### Task 6: `classAbilities.ts` data module

**Files:**
- Create: `packages/data/src/classAbilities.ts`
- Modify: `packages/data/src/index.ts`
- Test: `packages/data/src/classAbilities.test.ts`

- [ ] **Step 1: Write the failing test (structural invariants)**

Create `packages/data/src/classAbilities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classAbilities } from "./classAbilities";

describe("classAbilities", () => {
  it("every ability has a class, key, name and at least one spell id", () => {
    for (const a of classAbilities) {
      expect(a.className.length).toBeGreaterThan(0);
      expect(a.key.length).toBeGreaterThan(0);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.spellIds.length).toBeGreaterThan(0);
    }
  });

  it("keys are unique", () => {
    const keys = classAbilities.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("rank-checked abilities list a rank for every rank-checked spell id", () => {
    for (const a of classAbilities) {
      if (!a.ranks) continue;
      const ranked = new Set(a.ranks.map((r) => r.spellId));
      for (const r of a.ranks) expect(typeof r.rank).toBe("number");
      // every ranked id must also be a tracked spell id
      for (const id of ranked) expect(a.spellIds).toContain(id);
    }
  });

  it("covers all nine TBC classes", () => {
    const classes = new Set(classAbilities.map((a) => a.className));
    for (const c of ["Warrior","Paladin","Hunter","Rogue","Priest","Shaman","Mage","Warlock","Druid"]) {
      expect(classes.has(c)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wcl/data test -- classAbilities.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Create the data module**

Create `packages/data/src/classAbilities.ts`. Use this exact type and a starter curated set. **Verify every id on Wowhead before flipping `verified` to true.** Mark uncertain entries `verified: false`.

```ts
// packages/data/src/classAbilities.ts
import type { Role } from "@wcl/core";

export type ClassAbilityMeasure = "enemy-debuff-uptime" | "self-buff-uptime" | "cast-count";

/** A class-specific RPB metric row. `measure` decides how it's computed:
 *  - enemy-debuff-uptime: % of boss time the player's debuff was on an enemy
 *  - self-buff-uptime: % of boss time the player had the buff
 *  - cast-count: number of casts (effective usage of an active ability) */
export interface ClassAbility {
  className: string;          // matches Player.class
  key: string;                // stable slug
  name: string;               // display name
  measure: ClassAbilityMeasure;
  spellIds: number[];         // all ranks that count
  ranks?: { spellId: number; rank: number }[];  // rank per id (rank-checked only)
  optimalRank?: "max" | number;                  // flag if a lower rank dominates
  appliesToRole?: Role;       // optional UI hint
  verified?: boolean;         // false = ids not yet Wowhead-confirmed
}

// NOTE: ranks below are TBC-era. CROSS-CHECK ON WOWHEAD. Set verified:true only when confirmed.
export const classAbilities: ClassAbility[] = [
  // ---- Warrior ----
  { className: "Warrior", key: "sunder-armor", name: "Sunder Armor", measure: "enemy-debuff-uptime",
    spellIds: [7386, 7405, 8380, 11596, 11597, 25225],
    ranks: [{spellId:7386,rank:1},{spellId:7405,rank:2},{spellId:8380,rank:3},{spellId:11596,rank:4},{spellId:11597,rank:5},{spellId:25225,rank:6}],
    optimalRank: "max", verified: false },
  { className: "Warrior", key: "demoralizing-shout", name: "Demoralizing Shout", measure: "enemy-debuff-uptime",
    spellIds: [1160, 6190, 11554, 11555, 11556, 25202], verified: false },

  // ---- Paladin ----
  { className: "Paladin", key: "judgement-of-wisdom", name: "Judgement of Wisdom", measure: "enemy-debuff-uptime",
    spellIds: [20354, 20355, 27164], verified: false },
  { className: "Paladin", key: "judgement-of-the-crusader", name: "Judgement of the Crusader", measure: "enemy-debuff-uptime",
    spellIds: [20303, 20304, 20305, 20306, 20307, 20308, 27159], verified: false },

  // ---- Hunter ----
  { className: "Hunter", key: "hunters-mark", name: "Hunter's Mark", measure: "enemy-debuff-uptime",
    spellIds: [1130, 14323, 14324, 14325],
    ranks: [{spellId:1130,rank:1},{spellId:14323,rank:2},{spellId:14324,rank:3},{spellId:14325,rank:4}],
    optimalRank: "max", verified: false },
  { className: "Hunter", key: "expose-weakness", name: "Expose Weakness", measure: "enemy-debuff-uptime",
    spellIds: [23577], verified: false },

  // ---- Rogue ----
  { className: "Rogue", key: "expose-armor", name: "Expose Armor", measure: "enemy-debuff-uptime",
    spellIds: [8647, 8649, 8650, 11197, 11198, 26866],
    ranks: [{spellId:8647,rank:1},{spellId:8649,rank:2},{spellId:8650,rank:3},{spellId:11197,rank:4},{spellId:11198,rank:5},{spellId:26866,rank:6}],
    optimalRank: "max", verified: false },
  { className: "Rogue", key: "slice-and-dice", name: "Slice and Dice", measure: "self-buff-uptime",
    spellIds: [5171, 6774], verified: false },

  // ---- Priest ----
  { className: "Priest", key: "misery", name: "Misery", measure: "enemy-debuff-uptime",
    spellIds: [33196, 33197, 33198, 33199, 33200], verified: false },
  { className: "Priest", key: "shadow-weaving", name: "Shadow Weaving", measure: "enemy-debuff-uptime",
    spellIds: [15334], verified: false },
  { className: "Priest", key: "inner-fire", name: "Inner Fire", measure: "self-buff-uptime",
    spellIds: [588, 7128, 602, 1006, 10951, 10952, 25431], verified: false },

  // ---- Shaman ----
  { className: "Shaman", key: "flame-shock", name: "Flame Shock", measure: "enemy-debuff-uptime",
    spellIds: [8050, 8052, 8053, 10447, 10448, 29228, 25457], verified: false },

  // ---- Mage ----
  { className: "Mage", key: "winters-chill", name: "Winter's Chill", measure: "enemy-debuff-uptime",
    spellIds: [12579], verified: false },
  { className: "Mage", key: "improved-scorch", name: "Improved Scorch (Fire Vulnerability)", measure: "enemy-debuff-uptime",
    spellIds: [22959], verified: false },
  { className: "Mage", key: "molten-armor", name: "Molten Armor", measure: "self-buff-uptime",
    spellIds: [30482], verified: false },

  // ---- Warlock ----
  { className: "Warlock", key: "curse-of-the-elements", name: "Curse of the Elements", measure: "enemy-debuff-uptime",
    spellIds: [1490, 11721, 11722, 27228],
    ranks: [{spellId:1490,rank:1},{spellId:11721,rank:2},{spellId:11722,rank:3},{spellId:27228,rank:4}],
    optimalRank: "max", verified: false },
  { className: "Warlock", key: "curse-of-shadow", name: "Curse of Shadow", measure: "enemy-debuff-uptime",
    spellIds: [17862, 17937, 27229],
    ranks: [{spellId:17862,rank:1},{spellId:17937,rank:2},{spellId:27229,rank:3}],
    optimalRank: "max", verified: false },
  { className: "Warlock", key: "curse-of-recklessness", name: "Curse of Recklessness", measure: "enemy-debuff-uptime",
    spellIds: [704, 7658, 7659, 11717, 27226], verified: false },

  // ---- Druid ----
  { className: "Druid", key: "faerie-fire", name: "Faerie Fire", measure: "enemy-debuff-uptime",
    spellIds: [770, 778, 9749, 9907, 26993], verified: false },
  { className: "Druid", key: "faerie-fire-feral", name: "Faerie Fire (Feral)", measure: "enemy-debuff-uptime",
    spellIds: [16857, 17390, 17391, 17392, 27011], verified: false },
];
```

- [ ] **Step 4: Export from data index**

In `packages/data/src/index.ts`, add at the end (with the other `export *`):

```ts
export * from "./classAbilities";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @wcl/data test -- classAbilities.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "packages/data/src/classAbilities.ts" "packages/data/src/classAbilities.test.ts" "packages/data/src/index.ts"
git commit -m "feat(data): curated per-class ability table for RPB class rows (M5b; ids pending Wowhead verify)"
```

---

### Task 7: `avoidableAbilities.ts` data module

**Files:**
- Create: `packages/data/src/avoidableAbilities.ts`
- Modify: `packages/data/src/index.ts`
- Test: `packages/data/src/avoidableAbilities.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/data/src/avoidableAbilities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avoidableAbilities, avoidableAbilityIds } from "./avoidableAbilities";

describe("avoidableAbilities", () => {
  it("each entry has an abilityId and name", () => {
    for (const a of avoidableAbilities) {
      expect(Number.isInteger(a.abilityId)).toBe(true);
      expect(a.name.length).toBeGreaterThan(0);
    }
  });
  it("avoidableAbilityIds is a set of the ability ids", () => {
    expect(avoidableAbilityIds.has(avoidableAbilities[0].abilityId)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wcl/data test -- avoidableAbilities.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Create the module**

Create `packages/data/src/avoidableAbilities.ts`. Start with a small, clearly-labeled set (per-boss entries added during E2E from the probe). **Verify ids on Wowhead.**

```ts
// packages/data/src/avoidableAbilities.ts
/** An ability whose damage is considered avoidable (stand-out-of, environmental).
 *  encounterId omitted = treated as globally avoidable. Curated; extend per boss
 *  during E2E using the probe to read real ability ids. */
export interface AvoidableAbility {
  abilityId: number;
  name: string;
  /** WCL encounter id this applies to; omit for global. */
  encounterId?: number;
  verified?: boolean;
}

// Starter set — extend during E2E. Verify each id on Wowhead.
export const avoidableAbilities: AvoidableAbility[] = [
  // Example global/environmental placeholders — replace/extend with real boss ids.
  { abilityId: 37098, name: "Vashj — Static Charge", encounterId: undefined, verified: false },
];

export const avoidableAbilityIds: Set<number> = new Set(avoidableAbilities.map((a) => a.abilityId));
```

- [ ] **Step 4: Export from data index**

In `packages/data/src/index.ts` add:

```ts
export * from "./avoidableAbilities";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @wcl/data test -- avoidableAbilities.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "packages/data/src/avoidableAbilities.ts" "packages/data/src/avoidableAbilities.test.ts" "packages/data/src/index.ts"
git commit -m "feat(data): curated avoidable-ability table for true avoidable-damage filtering (M5b)"
```

---

## Phase 3 — Core: classMetrics + rank-checking + rpb integration

### Task 8: `classMetrics.ts` core module

**Files:**
- Create: `packages/core/src/classMetrics.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/classMetrics.test.ts`

> `@wcl/core` is pure — `ClassAbility[]` is injected as an argument (defined structurally in core to avoid importing `@wcl/data`).

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/classMetrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classMetrics, type ClassAbilitySpec } from "./classMetrics";
import type { ReportData } from "./types";

const baseReport = (): ReportData => ({
  reportId: "R", title: "t", zoneName: "Serpentshrine Cavern",
  startTime: 0, endTime: 10000,
  fights: [{ id: 1, name: "Hydross", encounterId: 623, isBoss: true, kill: true, startTime: 0, endTime: 10000 }],
  players: [{ id: 1, name: "Locky", class: "Warlock" }],
  gear: [], itemMeta: {},
  playerTotals: [{ playerId: 1, healingDone: 0, damageDone: 100, damageTaken: 0, magicDamageDone: 100 }],
  playerCasts: [],
  enemyDebuffs: [],
});

const coe: ClassAbilitySpec = {
  className: "Warlock", key: "curse-of-the-elements", name: "Curse of the Elements",
  measure: "enemy-debuff-uptime", spellIds: [27228, 11722],
  ranks: [{ spellId: 11722, rank: 3 }, { spellId: 27228, rank: 4 }], optimalRank: "max",
};

describe("classMetrics", () => {
  it("computes enemy-debuff uptime% over boss duration", () => {
    const r = baseReport();
    r.enemyDebuffs = [{ fightId: 1, sourceId: 1, targetEnemyId: 99, spellId: 27228, startTime: 0, endTime: 5000 }];
    const rows = classMetrics(1, "Warlock", r, [coe], new Set([1]), 10000);
    expect(rows[0].key).toBe("curse-of-the-elements");
    expect(rows[0].uptimePct).toBeCloseTo(0.5);
    expect(rows[0].rankFlag).toBe(false);
  });

  it("flags rank misuse when a lower rank dominates casts", () => {
    const r = baseReport();
    r.enemyDebuffs = [{ fightId: 1, sourceId: 1, targetEnemyId: 99, spellId: 11722, startTime: 0, endTime: 5000 }];
    r.playerCasts = [
      { fightId: 1, playerId: 1, spellId: 11722, timestamp: 0 },
      { fightId: 1, playerId: 1, spellId: 11722, timestamp: 100 },
    ];
    const rows = classMetrics(1, "Warlock", r, [coe], new Set([1]), 10000);
    expect(rows[0].rankFlag).toBe(true);  // only rank 3 cast, max is rank 4
  });

  it("only returns abilities for the player's class", () => {
    const r = baseReport();
    const mageAbility: ClassAbilitySpec = { className: "Mage", key: "winters-chill", name: "Winter's Chill", measure: "enemy-debuff-uptime", spellIds: [12579] };
    const rows = classMetrics(1, "Warlock", r, [coe, mageAbility], new Set([1]), 10000);
    expect(rows.map((x) => x.key)).toEqual(["curse-of-the-elements"]);
  });

  it("counts casts for cast-count measure", () => {
    const r = baseReport();
    r.playerCasts = [{ fightId: 1, playerId: 1, spellId: 17877, timestamp: 0 }];
    const shadowburn: ClassAbilitySpec = { className: "Warlock", key: "shadowburn", name: "Shadowburn", measure: "cast-count", spellIds: [17877] };
    const rows = classMetrics(1, "Warlock", r, [shadowburn], new Set([1]), 10000);
    expect(rows[0].castCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wcl/core test -- classMetrics.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement classMetrics**

Create `packages/core/src/classMetrics.ts`:

```ts
import type { ReportData, Role } from "./types";

export type ClassAbilityMeasure = "enemy-debuff-uptime" | "self-buff-uptime" | "cast-count";

/** Structural copy of @wcl/data's ClassAbility (core stays pure — data injected). */
export interface ClassAbilitySpec {
  className: string;
  key: string;
  name: string;
  measure: ClassAbilityMeasure;
  spellIds: number[];
  ranks?: { spellId: number; rank: number }[];
  optimalRank?: "max" | number;
  appliesToRole?: Role;
  verified?: boolean;
}

export interface ClassAbilityResult {
  key: string;
  name: string;
  measure: ClassAbilityMeasure;
  uptimePct?: number;     // enemy-debuff / self-buff measures
  castCount?: number;     // cast-count measure
  rankFlag: boolean;      // true = mostly used a lower rank than optimal
  verified: boolean;
  severity: "major" | "moderate" | "minor" | "ok";
}

/** Per-player class-specific ability rows. Pure: abilities + boss context injected.
 *  bossDurationMs is the summed duration of bossFightIds (Kalecgos already excluded
 *  upstream). */
export function classMetrics(
  playerId: number,
  className: string,
  report: ReportData,
  abilities: ClassAbilitySpec[],
  bossFightIds: Set<number>,
  bossDurationMs: number,
): ClassAbilityResult[] {
  const myCasts = (report.playerCasts ?? []).filter((c) => c.playerId === playerId && bossFightIds.has(c.fightId));
  const myDebuffs = (report.enemyDebuffs ?? []).filter((d) => d.sourceId === playerId && bossFightIds.has(d.fightId));
  const myBuffs = (report.buffs ?? []).filter((b) => b.targetId === playerId && bossFightIds.has(b.fightId));

  const out: ClassAbilityResult[] = [];
  for (const a of abilities) {
    if (a.className !== className) continue;
    const idSet = new Set(a.spellIds);

    let uptimePct: number | undefined;
    let castCount: number | undefined;

    if (a.measure === "enemy-debuff-uptime") {
      uptimePct = bossDurationMs > 0 ? mergedDurationMs(myDebuffs.filter((d) => idSet.has(d.spellId))) / bossDurationMs : 0;
    } else if (a.measure === "self-buff-uptime") {
      uptimePct = bossDurationMs > 0 ? mergedDurationMs(myBuffs.filter((b) => idSet.has(b.spellId))) / bossDurationMs : 0;
    } else {
      castCount = myCasts.filter((c) => idSet.has(c.spellId)).length;
    }

    const rankFlag = computeRankFlag(a, myCasts.filter((c) => idSet.has(c.spellId)).map((c) => c.spellId));

    const row: ClassAbilityResult = {
      key: a.key, name: a.name, measure: a.measure,
      uptimePct, castCount, rankFlag, verified: a.verified ?? false, severity: "ok",
    };
    row.severity = severityFor(row);
    out.push(row);
  }
  return out;
}

/** total ms covered by a set of intervals, overlaps merged (union). */
function mergedDurationMs(intervals: { startTime: number; endTime: number }[]): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a.startTime - b.startTime);
  let total = 0, curStart = sorted[0].startTime, curEnd = sorted[0].endTime;
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.startTime > curEnd) { total += curEnd - curStart; curStart = s.startTime; curEnd = s.endTime; }
    else if (s.endTime > curEnd) curEnd = s.endTime;
  }
  total += curEnd - curStart;
  return total;
}

/** true when the ability is rank-checked, optimal is max, and the majority of
 *  observed casts used a lower-than-max rank. */
function computeRankFlag(a: ClassAbilitySpec, castSpellIds: number[]): boolean {
  if (!a.ranks || a.optimalRank !== "max" || castSpellIds.length === 0) return false;
  const rankById = new Map(a.ranks.map((r) => [r.spellId, r.rank]));
  const maxRank = Math.max(...a.ranks.map((r) => r.rank));
  let lower = 0, total = 0;
  for (const id of castSpellIds) {
    const rank = rankById.get(id);
    if (rank === undefined) continue;
    total++;
    if (rank < maxRank) lower++;
  }
  return total > 0 && lower > total / 2;
}

function severityFor(row: ClassAbilityResult): ClassAbilityResult["severity"] {
  if (row.rankFlag) return "minor";
  // Low uptime of a defining debuff/buff is worth a nudge; thresholds are advisory.
  if (row.uptimePct !== undefined && row.uptimePct < 0.5) return "moderate";
  return "ok";
}
```

- [ ] **Step 4: Export from core index**

In `packages/core/src/index.ts`, add after `export * from "./activity";`:

```ts
export * from "./classMetrics";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @wcl/core test -- classMetrics.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "packages/core/src/classMetrics.ts" "packages/core/src/classMetrics.test.ts" "packages/core/src/index.ts"
git commit -m "feat(core): classMetrics — per-class debuff/buff uptime + cast-count + rank flag (M5b)"
```

---

### Task 9: Integrate class rows + deferred fixes into rpb.ts

**Files:**
- Modify: `packages/core/src/rpb.ts`
- Test: `packages/core/src/rpb.test.ts`
- Test fixture: `packages/core/src/fixtures/report.fixture.ts` (extend if needed)

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/rpb.test.ts`, extend the `cfg` to add the new config fields and add tests. First update `cfg`:

```ts
const cfg: RpbConfig = {
  roles: { signals: [{ spellId: 5487, role: "tank", name: "Bear Form" }], casterClasses: ["Mage", "Warlock", "Priest", "Shaman"] },
  activity: { castTimes: { "30451": 25 }, hasteBuffs: [], aoeWindowMs: 500 },
  engineeringDamageIds: [30461],
  oilOfImmolationSpellId: 11350,
  battleShoutBuffIds: [2048],
  absorbExcludedSpellIds: [],
  classAbilities: [],            // NEW
  avoidableAbilityIds: new Set(),// NEW
};
```

Then add:

```ts
it("attaches class rows for the player's class", () => {
  const r = structuredClone(reportFixture);
  // Playerone is a caster (class from fixture); give them a tracked debuff
  const cfg2: RpbConfig = { ...cfg, classAbilities: [
    { className: r.players.find((p) => p.name === "Playerone")!.class, key: "test-debuff", name: "Test Debuff",
      measure: "cast-count", spellIds: [30451] },
  ]};
  const row = rpb(r, cfg2)!.rows.find((x) => x.playerName === "Playerone")!;
  expect(row.classRows.map((c) => c.key)).toContain("test-debuff");
});

it("avoidable filtering: totalAvoidableDamageTaken counts only avoidable ability ids", () => {
  const r = structuredClone(reportFixture);
  // pick an abilityId present in the fixture's damageTakenEvents for Playerone
  const sample = r.damageTakenEvents!.find((d) => !d.fromFriendly)!;
  const cfg2: RpbConfig = { ...cfg, avoidableAbilityIds: new Set([sample.abilityId]) };
  const row = rpb(r, cfg2)!.rows.find((x) => x.playerId === sample.targetPlayerId)!;
  // only damage from the avoidable id counts now
  const expected = r.damageTakenEvents!
    .filter((d) => d.targetPlayerId === sample.targetPlayerId && d.abilityId === sample.abilityId)
    .reduce((s, d) => s + d.amount, 0);
  expect(row.totalAvoidableDamageTaken).toBe(expected);
  // total partly-avoidable retains the full sum
  expect(row.totalPartlyAvoidable).toBeGreaterThanOrEqual(expected);
});
```

Also update the existing `"splits avoidable / friendly-fire damage taken"` test: with no avoidable ids configured, `totalAvoidableDamageTaken` should now be `0` and `totalPartlyAvoidable` should be the old full value. Change it to:

```ts
it("splits avoidable / friendly-fire damage taken", () => {
  const p1 = rowFor("Playerone");
  expect(p1.friendlyFire).toBe(300);
  expect(p1.totalAvoidableDamageTaken).toBe(0);          // no avoidable ids configured
  expect(p1.totalPartlyAvoidable).toBe(1500 + 300);      // all boss damage taken
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wcl/core test -- rpb.test.ts`
Expected: FAIL (`classAbilities`/`avoidableAbilityIds` not in config; `classRows`/`totalPartlyAvoidable` missing).

- [ ] **Step 3: Update RpbConfig, RpbRow, and rpb()**

In `packages/core/src/rpb.ts`:

Add import:

```ts
import { classMetrics, type ClassAbilitySpec, type ClassAbilityResult } from "./classMetrics";
```

Extend `RpbConfig`:

```ts
export interface RpbConfig {
  roles: RoleConfig;
  activity: ActivityConfig;
  engineeringDamageIds: number[];
  oilOfImmolationSpellId: number;
  battleShoutBuffIds: number[];
  absorbExcludedSpellIds: number[];
  /** curated per-class ability table (M5b) */
  classAbilities: ClassAbilitySpec[];
  /** ability ids whose damage-taken counts as avoidable (M5b) */
  avoidableAbilityIds: Set<number>;
}
```

Extend `RpbRow` — replace the `totalAvoidableDamageTaken` doc and add fields:

```ts
  /** boss damage taken from curated avoidable ability ids only (M5b) */
  totalAvoidableDamageTaken: number;
  /** all boss damage taken (context for avoidable) */
  totalPartlyAvoidable: number;
  /** per-class ability rows (M5b) */
  classRows: ClassAbilityResult[];
```

In `rpb()`, inside the per-player loop, replace the `totalAvoidable` computation and the row's `totalAvoidableDamageTaken`:

```ts
    const totalPartlyAvoidable = myDmgTaken.reduce((s, d) => s + d.amount, 0);
    const totalAvoidable = myDmgTaken
      .filter((d) => cfg.avoidableAbilityIds.has(d.abilityId))
      .reduce((s, d) => s + d.amount, 0);
```

In the `row` object, set:

```ts
      totalAvoidableDamageTaken: totalAvoidable,
      totalPartlyAvoidable,
      classRows: classMetrics(id, player.class, report, cfg.classAbilities, bossFightIds, bossDurationMs),
```

(Keep all other existing fields. `totalAbsorbed` already reads `report.absorbs` which is now populated by the api — no core change needed there.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wcl/core test -- rpb.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full core suite (regression)**

Run: `pnpm --filter @wcl/core test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "packages/core/src/rpb.ts" "packages/core/src/rpb.test.ts"
git commit -m "feat(core): rpb attaches class rows + true avoidable filtering (totalPartlyAvoidable) (M5b)"
```

---

### Task 10: Fix reflected / Friendly-Fire / PvP-hostile partitioning

**Files:**
- Modify: `packages/core/src/rpb.ts`
- Test: `packages/core/src/rpb.test.ts`

> The current `damageReflectedOrHostile` lumps self-inflicted and hostile-target damage. Split into three explicit fields so the UI can show them honestly. `friendlyFire` already exists (damage taken from a friendly source); keep it. Add `damageReflected` (player damage where target == source) and `damageToHostilePlayers` (player damage to an enemy player).

- [ ] **Step 1: Write the failing test**

In `rpb.test.ts` add:

```ts
it("partitions reflected and hostile-player damage", () => {
  const r = structuredClone(reportFixture);
  // ensure the fixture has a self-inflicted and a hostile-player damage event for Playerone;
  // if not present, add them to r.playerDamage before calling rpb.
  const pid = r.players.find((p) => p.name === "Playerone")!.id;
  r.playerDamage = [
    ...(r.playerDamage ?? []),
    { fightId: r.fights.find((f) => f.isBoss)!.id, sourceId: pid, abilityId: 9, targetId: pid, amount: 40, timestamp: 1, targetHostilePlayer: false, selfInflicted: true },
    { fightId: r.fights.find((f) => f.isBoss)!.id, sourceId: pid, abilityId: 9, targetId: 99999, amount: 60, timestamp: 2, targetHostilePlayer: true, selfInflicted: false },
  ];
  const row = rpb(r, cfg)!.rows.find((x) => x.playerId === pid)!;
  expect(row.damageReflected).toBe(40);
  expect(row.damageToHostilePlayers).toBe(60);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wcl/core test -- rpb.test.ts`
Expected: FAIL (`damageReflected`/`damageToHostilePlayers` missing).

- [ ] **Step 3: Replace the combined field**

In `RpbRow`, remove `damageReflectedOrHostile` and its DEFERRED comment; add:

```ts
  /** player damage where target == source (reflected/self) (M5b) */
  damageReflected: number;
  /** player damage dealt to a hostile player — PvP, counts as self in RPB (M5b) */
  damageToHostilePlayers: number;
```

In `rpb()`, replace the `damageReflectedOrHostile` computation:

```ts
      damageReflected: myDamage.filter((d) => d.selfInflicted).reduce((s, d) => s + d.amount, 0),
      damageToHostilePlayers: myDamage.filter((d) => d.targetHostilePlayer && !d.selfInflicted).reduce((s, d) => s + d.amount, 0),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wcl/core test -- rpb.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full core suite**

Run: `pnpm --filter @wcl/core test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "packages/core/src/rpb.ts" "packages/core/src/rpb.test.ts"
git commit -m "feat(core): partition reflected vs hostile-player damage in RPB (M5a deferred fix)"
```

---

## Phase 4 — Web: render class rows + wire config

### Task 11: Pass new config + render class-row block in RpbView

**Files:**
- Modify: `apps/web/src/components/RpbView.tsx`
- Test: `apps/web/src/components/RpbView.test.tsx`

- [ ] **Step 1: Write the failing test**

In `apps/web/src/components/RpbView.test.tsx`, find the existing render helper/fixture. Add a test that, given a report whose player has a tracked class ability with uptime, the class ability name renders. Mirror the existing test setup (it builds a `report` and renders `<RpbView report={report} />`). Add:

```ts
it("renders class-specific ability rows", () => {
  const report = makeReport();  // existing helper that yields an RPB-capable report
  render(<RpbView report={report} />);
  // Curse of the Elements is curated for Warlock; the fixture must include a Warlock
  // with an enemyDebuff. If the shared fixture has no warlock, assert a known curated
  // ability name appears for whatever class the fixture player is, or extend the fixture.
  expect(screen.getByText(/uptime|cast|ability/i)).toBeTruthy();
});
```

If the web fixture is too thin to exercise class rows meaningfully, extend it minimally to include `enemyDebuffs` + a matching curated class for one player, and assert that ability's `name` is in the document.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wcl/web test -- RpbView.test.tsx`
Expected: FAIL (no class-row markup / config not passed).

- [ ] **Step 3: Wire config and render the block**

In `apps/web/src/components/RpbView.tsx`:

Extend the `@wcl/data` import:

```ts
import {
  spellCastTimes, roleSignals, casterClasses, hasteBuffs, engineeringDamageIds,
  oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
} from "@wcl/data";
```

Pass them into the `rpb(...)` config object:

```ts
  const result = useMemo(() => rpb(report, {
    roles: { signals: roleSignals, casterClasses },
    activity: { castTimes: spellCastTimes, hasteBuffs, aoeWindowMs: 500 },
    engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
    classAbilities, avoidableAbilityIds,
  }), [report]);
```

Update the `<td>` for "total dmg taken" to use the new fields (show avoidable, keep partly as title):

```tsx
                      <td title={`all boss damage taken: ${r.totalPartlyAvoidable.toLocaleString()}`}>{r.totalAvoidableDamageTaken.toLocaleString()}</td>
```

Render a class-row sub-block inside each player `<tr>` is awkward in a flat table; instead, render an **expandable detail row** after each player row. Replace the player `.map(...)` body so each player yields a fragment of `<tr>` (the existing summary row) plus a class-rows `<tr>`:

```tsx
                  {group.map((r) => (
                    <Fragment key={r.playerId}>
                      <tr className={sevClass(r.severity)}>
                        {/* ...existing summary cells unchanged... */}
                      </tr>
                      {(r.classRows.length > 0 || r.totalAbsorbed > 0) && (
                        <tr className="class-rows">
                          <td colSpan={11}>
                            {r.totalAbsorbed > 0 && (
                              <span className="badge" style={{ marginRight: "0.75rem" }}>
                                absorbed: {r.totalAbsorbed.toLocaleString()}
                              </span>
                            )}
                            <ul className="class-ability-list">
                              {r.classRows.map((c) => (
                                <li key={c.key} className={sevClass(c.severity)}>
                                  {c.name}
                                  {c.measure === "cast-count"
                                    ? `: ${c.castCount}× `
                                    : `: ${pct(c.uptimePct ?? 0)} uptime `}
                                  {c.rankFlag && <span title="mostly a lower rank than optimal"> ⚠ low rank</span>}
                                  {!c.verified && <span className="badge" title="spell ids not yet Wowhead-verified"> unverified</span>}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
```

Add `Fragment` to the React import: `import { Fragment, useMemo, useState } from "react";`.

Update the trailing `<small>` caption to reflect the new reality:

```tsx
      <p><small>"Total dmg taken" shows avoidable damage from tracked abilities (hover for total). Class rows show per-class debuff/buff uptime and key casts; ⚠ flags a lower-than-optimal rank; "unverified" marks spell ids still pending Wowhead confirmation.</small></p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wcl/web test -- RpbView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full web suite + build (typecheck)**

Run: `pnpm --filter @wcl/web test && pnpm --filter @wcl/web build`
Expected: PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/components/RpbView.tsx" "apps/web/src/components/RpbView.test.tsx"
git commit -m "feat(web): render per-class ability rows + avoidable/total in RPB (M5b)"
```

---

### Task 12: CSS for class-row block + final whole-suite check

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add minimal styles**

In `apps/web/src/index.css`, add (reusing the existing `sev-*` palette — do not redefine colors):

```css
.class-rows td { padding: 0.25rem 0.5rem; background: rgba(0,0,0,0.02); }
.class-ability-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; }
.class-ability-list li { padding: 0 0.4rem; border-radius: 3px; font-size: 0.85em; }
.class-ability-list .badge { font-size: 0.75em; opacity: 0.7; }
```

- [ ] **Step 2: Build to verify CSS is valid + bundles**

Run: `pnpm --filter @wcl/web build`
Expected: PASS.

- [ ] **Step 3: Run the entire monorepo test suite**

Run: `pnpm -r test`
Expected: PASS (all packages — core, data, api, web).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/index.css"
git commit -m "style(web): class-row block styling for RPB (M5b)"
```

---

## Phase 5 — Docs + verification handoff

### Task 13: Update handoff.md and note E2E follow-ups

**Files:**
- Modify: `handoff.md`

- [ ] **Step 1: Update the handoff**

In `handoff.md`, under "Current state" add an M5b entry summarizing: class rows (data-driven `classAbilities`), rank-checking, enemy-debuff + absorb fetchers, fetch scoping, true avoidable filtering (`avoidableAbilityIds`), reflected/hostile split. Under "Next milestones", mark M5b DONE (code) and list the **E2E follow-ups** explicitly:

- Validate enemy `Debuffs`, absorb event shapes, and damage source flags via `apps/api/scripts/probe-damage.ts` against a real cached report.
- Flip `classAbilities` / `avoidableAbilities` `verified` flags to true once each id is Wowhead-confirmed; fix any wrong ranks.
- Populate `avoidableAbilities` per boss from real ability ids (currently a placeholder set).
- Re-check debuff-uptime on multi-target/cleave fights (documented melee/multi-target caveat).

Also add to "Known gotchas": pre-M5b caches lack `enemyDebuffs`/`absorbs` → class rows + real absorbs need a refresh.

- [ ] **Step 2: Commit**

```bash
git add "handoff.md"
git commit -m "docs: M5b done (code) — class rows + deferred items; E2E + verification follow-ups noted"
```

---

## Done criteria

- `pnpm -r test` green (core, data, api, web).
- `pnpm --filter @wcl/web build` succeeds.
- RPB tab shows per-player class ability rows with uptime%/cast-count, rank-flag, and unverified badges; "total dmg taken" reflects avoidable filtering.
- `report.enemyDebuffs` + `report.absorbs` populated for freshly-loaded reports; pre-M5b caches degrade gracefully.
- All new curated ids carry honest `verified` flags; E2E follow-ups recorded in `handoff.md`.

## Notes on risk (carry into execution)

- **Curation is the main risk.** Every spell id in `classAbilities.ts` / `avoidableAbilities.ts` is a starter value — verify on Wowhead during execution and only then set `verified: true`. Wrong rank ids silently break rank-checking.
- **WCL shapes assumed** for enemy `Debuffs` and absorbs (no creds in build env) — validate with the probe before claiming E2E done, exactly as M4/M5a did.
- **Melee/multi-target debuff uptime** is approximate (union across all enemies) — documented, not solved.
```
