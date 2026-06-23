# Performance Summary Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the current `Performance` tab to `Summary`, and add a new `Performance` tab that renders the four WarcraftLogs single-fight summary panels (Damage Done By Source, Healing Done By Source, Damage Taken By Ability, Deaths).

**Architecture:** A new pure core function `performanceSummary(scopedReport)` aggregates the four panels from already-scoped report data; the web layer scopes via `scopeReportToFight` and renders four panel tables. New per-fight healing events, enriched death events (killing blow + timestamp), and ability names are added to the API/normalize pipeline. All new `ReportData` fields are optional, so reports cached before this feature load and show the existing "Refresh from WCL" notice in the new tab until re-pulled.

**Tech Stack:** TypeScript monorepo (pnpm workspaces). `packages/core` (pure analyses, vitest), `apps/api` (Hono + WCL v2 GraphQL, vitest), `apps/web` (React + react-router + Vitest + @testing-library/react).

## Global Constraints

- Project invariant: report-wide analyses derive their fight set from `report.fights` only; the **caller** scopes via `scopeReportToFight`. Never re-add an internal `isBoss` filter inside an analysis.
- New `ReportData` fields MUST be optional (`?`) for backward compatibility with cached reports; absence drives the "Refresh from WCL (requires credentials)" notice.
- Refresh-notice trigger for the new tab: `report.healingEvents === undefined`.
- Per-second rates use total scoped fight duration = `sum(endTime - startTime)` across `report.fights`; guard divide-by-zero (0 duration → rate 0).
- Follow existing patterns: class colors via `classColorVar`/`classColor` (`apps/web/src/lib/classColors.ts`); tables wrapped in `.scroll-x`; numeric cells use `mono` class; player names are `<button className="player-link">` calling `onPlayer(name)`.
- Test commands: core → `pnpm --filter @wcl/core test`; api → `pnpm --filter @wcl/api test`; web → `pnpm --filter @wcl/web test`. Run from repo root `/Users/pviegas/Documents/WOW  RPB_CLA`.
- Commit after each task with a `feat:`/`refactor:` message.

---

### Task 1: Core `performanceSummary` analysis (types, fixture, function)

**Files:**
- Modify: `packages/core/src/types.ts` (add `HealingEvent`, `ReportData.healingEvents?`, `ReportData.abilityMeta?`, extend `PlayerDeath`)
- Modify: `packages/core/src/fixtures/report.fixture.ts` (add `healingEvents`, `abilityMeta`, enrich `playerDeaths`)
- Create: `packages/core/src/performance.ts`
- Create: `packages/core/src/performance.test.ts`
- Modify: `packages/core/src/index.ts` (export `./performance`)

**Interfaces:**
- Produces (consumed by Task 5 web component and Task 3 normalize):
  - `interface HealingEvent { fightId: number; sourceId: number; amount: number }`
  - `ReportData.healingEvents?: HealingEvent[]`
  - `ReportData.abilityMeta?: Record<string, { name: string }>`
  - `PlayerDeath` gains `killingAbilityId?: number; timestamp?: number`
  - `interface PerfRanked { id: number; name: string; className?: string; amount: number; percent: number; perSecond: number }`
  - `interface PerfDeathRow { playerId: number; playerName: string; className?: string; killingBlow: string; timeMs: number }`
  - `interface PerformanceSummary { damageBySource: PerfRanked[]; healingBySource: PerfRanked[]; damageTakenByAbility: PerfRanked[]; deaths: PerfDeathRow[]; durationMs: number }`
  - `function performanceSummary(report: ReportData): PerformanceSummary | null`

- [ ] **Step 1: Add the new types to `packages/core/src/types.ts`**

Add after the existing `AbsorbEvent` interface (around line 167):

```ts
/** Effective healing done by a player in one fight (HealingDone events). */
export interface HealingEvent { fightId: number; sourceId: number; amount: number; }
```

Change `PlayerDeath` (currently `export interface PlayerDeath { playerId: number; fightId: number; }`) to:

```ts
/** A boss/trash-fight death of a player (Kalecgos already excluded upstream).
 *  killingAbilityId/timestamp are present from the performance-breakdown feature
 *  onward; undefined on reports cached before it. */
export interface PlayerDeath {
  playerId: number;
  fightId: number;
  /** WCL killingAbilityGameID of the killing blow; undefined when unknown */
  killingAbilityId?: number;
  /** event timestamp, report-relative ms; undefined on pre-feature caches */
  timestamp?: number;
}
```

In the `ReportData` interface, add these two fields next to `rankings?` (around line 29):

```ts
  /** per-fight effective healing by source (performance breakdown);
   *  undefined = report cached before this feature (drives refresh notice). */
  healingEvents?: HealingEvent[];
  /** WCL abilityGameID → name, for damage-taken/death ability labels;
   *  undefined/absent on pre-feature caches. */
  abilityMeta?: Record<string, { name: string }>;
```

- [ ] **Step 2: Update the fixture in `packages/core/src/fixtures/report.fixture.ts`**

Replace the `playerDeaths` line:

```ts
  playerDeaths: [{ playerId: 2, fightId: 3 }],
```

with:

```ts
  playerDeaths: [{ playerId: 2, fightId: 3, killingAbilityId: 13022, timestamp: 200_000 }],
```

Add these two properties immediately after the `absorbs: [...]` array (before `rankings:`):

```ts
  healingEvents: [
    { fightId: 3, sourceId: 2, amount: 5000 },
    { fightId: 3, sourceId: 1, amount: 1000 },
  ],
  abilityMeta: {
    "13022": { name: "Frostbolt" },
    "99999": { name: "Friendly Fire" },
    "30451": { name: "Arcane Blast" },
  },
```

- [ ] **Step 3: Write the failing test `packages/core/src/performance.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { reportFixture } from "./fixtures/report.fixture";
import { performanceSummary } from "./performance";
import type { ReportData } from "./types";

/** scope helper: keep only the named fights (mirrors scopeReportToFight). */
function onlyFights(report: ReportData, ids: number[]): ReportData {
  return { ...report, fights: report.fights.filter((f) => ids.includes(f.id)) };
}

describe("performanceSummary", () => {
  it("returns null when healingEvents is missing (pre-feature cache)", () => {
    const bare: ReportData = { ...reportFixture, healingEvents: undefined };
    expect(performanceSummary(bare)).toBeNull();
  });

  it("aggregates the four panels scoped to one fight", () => {
    const scoped = onlyFights(reportFixture, [3]); // Hydross kill, 150_000..250_000 = 100s
    const s = performanceSummary(scoped)!;
    expect(s).not.toBeNull();
    expect(s.durationMs).toBe(100_000);

    // Damage done by source: Playerone 4000+250=4250, Playertwo 700; sorted desc
    expect(s.damageBySource.map((r) => [r.name, r.amount])).toEqual([
      ["Playerone", 4250],
      ["Playertwo", 700],
    ]);
    expect(s.damageBySource[0].perSecond).toBeCloseTo(42.5, 3);
    expect(s.damageBySource[0].percent).toBeCloseTo(4250 / 4950, 5);
    expect(s.damageBySource[0].className).toBe("Mage");

    // Healing done by source: Playertwo 5000, Playerone 1000
    expect(s.healingBySource.map((r) => [r.name, r.amount])).toEqual([
      ["Playertwo", 5000],
      ["Playerone", 1000],
    ]);

    // Damage taken by ability: Frostbolt(13022) 1500, Friendly Fire(99999) 300
    expect(s.damageTakenByAbility.map((r) => [r.name, r.amount])).toEqual([
      ["Frostbolt", 1500],
      ["Friendly Fire", 300],
    ]);

    // Deaths: Playertwo, killed by Frostbolt, 50s into the fight (200_000-150_000)
    expect(s.deaths).toEqual([
      { playerId: 2, playerName: "Playertwo", className: "Warrior", killingBlow: "Frostbolt", timeMs: 50_000 },
    ]);
  });

  it("falls back to placeholder names for unknown ability ids", () => {
    const scoped = onlyFights(
      { ...reportFixture, abilityMeta: {} },
      [3],
    );
    const s = performanceSummary(scoped)!;
    expect(s.damageTakenByAbility[0].name).toBe("Ability #13022");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @wcl/core test performance`
Expected: FAIL — `performance.ts` does not exist / `performanceSummary is not a function`.

- [ ] **Step 5: Implement `packages/core/src/performance.ts`**

```ts
import type { ReportData } from "./types";

export interface PerfRanked {
  /** player id (source panels) or ability id (ability panel) */
  id: number;
  name: string;
  /** WoW class for class-colored source rows; undefined for ability rows */
  className?: string;
  amount: number;
  /** share of this panel's total, 0..1 */
  percent: number;
  perSecond: number;
}

export interface PerfDeathRow {
  playerId: number;
  playerName: string;
  className?: string;
  /** killing-blow ability name, or "—" when unknown */
  killingBlow: string;
  /** ms into the death's own fight */
  timeMs: number;
}

export interface PerformanceSummary {
  damageBySource: PerfRanked[];
  healingBySource: PerfRanked[];
  damageTakenByAbility: PerfRanked[];
  deaths: PerfDeathRow[];
  /** total scoped fight duration in ms (rate denominator) */
  durationMs: number;
}

/** Build the four WCL-style summary panels from an already-scoped report.
 *  The caller scopes via scopeReportToFight; this derives its fight set from
 *  report.fights only (project invariant — no internal isBoss filter).
 *  Returns null when the data needed is absent (pre-feature cache). */
export function performanceSummary(report: ReportData): PerformanceSummary | null {
  if (report.healingEvents === undefined) return null;

  const fightIds = new Set(report.fights.map((f) => f.id));
  const fightStart = new Map(report.fights.map((f) => [f.id, f.startTime]));
  const durationMs = report.fights.reduce((s, f) => s + Math.max(0, f.endTime - f.startTime), 0);
  const playerById = new Map(report.players.map((p) => [p.id, p]));
  const abilityName = (id: number) => report.abilityMeta?.[String(id)]?.name ?? `Ability #${id}`;

  const toRanked = (
    totals: Map<number, number>,
    name: (id: number) => string,
    className: (id: number) => string | undefined,
  ): PerfRanked[] => {
    const total = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .map(([id, amount]) => ({
        id,
        name: name(id),
        className: className(id),
        amount,
        percent: total > 0 ? amount / total : 0,
        perSecond: durationMs > 0 ? amount / (durationMs / 1000) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  // 1. Damage done by source (player) — exclude self/reflected damage.
  const dmgBySrc = new Map<number, number>();
  for (const d of report.playerDamage ?? []) {
    if (!fightIds.has(d.fightId) || d.selfInflicted) continue;
    dmgBySrc.set(d.sourceId, (dmgBySrc.get(d.sourceId) ?? 0) + d.amount);
  }

  // 2. Healing done by source (player).
  const healBySrc = new Map<number, number>();
  for (const h of report.healingEvents ?? []) {
    if (!fightIds.has(h.fightId)) continue;
    healBySrc.set(h.sourceId, (healBySrc.get(h.sourceId) ?? 0) + h.amount);
  }

  const playerName = (id: number) => playerById.get(id)?.name ?? `#${id}`;
  const playerClass = (id: number) => playerById.get(id)?.class;

  // 3. Damage taken by ability (raid-wide).
  const dtByAbility = new Map<number, number>();
  for (const d of report.damageTakenEvents ?? []) {
    if (!fightIds.has(d.fightId)) continue;
    dtByAbility.set(d.abilityId, (dtByAbility.get(d.abilityId) ?? 0) + d.amount);
  }

  // 4. Deaths (per player), sorted by time into their fight.
  const deaths: PerfDeathRow[] = (report.playerDeaths ?? [])
    .filter((d) => fightIds.has(d.fightId))
    .map((d) => ({
      playerId: d.playerId,
      playerName: playerName(d.playerId),
      className: playerClass(d.playerId),
      killingBlow: d.killingAbilityId !== undefined ? abilityName(d.killingAbilityId) : "—",
      timeMs: d.timestamp !== undefined ? Math.max(0, d.timestamp - (fightStart.get(d.fightId) ?? 0)) : 0,
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  return {
    damageBySource: toRanked(dmgBySrc, playerName, playerClass),
    healingBySource: toRanked(healBySrc, playerName, playerClass),
    damageTakenByAbility: toRanked(dtByAbility, abilityName, () => undefined),
    deaths,
    durationMs,
  };
}
```

- [ ] **Step 6: Export it from `packages/core/src/index.ts`**

Add after the `export * from "./rpbConsumables";` line:

```ts
export * from "./performance";
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @wcl/core test performance`
Expected: PASS (3 tests).

- [ ] **Step 8: Run the full core suite to confirm no regressions**

Run: `pnpm --filter @wcl/core test`
Expected: PASS (existing tests unaffected; fixture additions are additive).

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/fixtures/report.fixture.ts packages/core/src/performance.ts packages/core/src/performance.test.ts packages/core/src/index.ts
git commit -m "feat(core): add performanceSummary analysis for WCL-style summary panels"
```

---

### Task 2: WCL raw fetches & query/type changes

**Files:**
- Modify: `apps/api/src/wcl.ts` (add `fetchHealingDone`; extend `RawDeathEvent` with `killingAbilityGameID`; add `abilities` to the report `masterData` query + `RawReport` type)
- Modify: `apps/api/src/wcl.test.ts` (cover `fetchHealingDone` + masterData abilities)

**Interfaces:**
- Consumes: existing `fetchAllEvents`, `RawDamageEvent`, `EVENTS_QUERY`, `REPORT_QUERY`, `gql`.
- Produces (consumed by Task 3 app/normalize):
  - `fetchHealingDone(code: string, accessToken: string, fightIds?: number[]): Promise<RawDamageEvent[]>`
  - `RawDeathEvent` gains `killingAbilityGameID?: number`
  - `RawReport.masterData.abilities?: { gameID: number; name: string }[]`

- [ ] **Step 1: Write the failing test in `apps/api/src/wcl.test.ts`**

First inspect the file for its existing `gql`/`fetch` mocking pattern (it mocks global `fetch`). Add a test mirroring the existing `fetchDamageDone` test style. Example (adapt the mock helper name to whatever the file already uses):

```ts
import { fetchHealingDone } from "./wcl";

describe("fetchHealingDone", () => {
  it("requests HealingDone events and returns heal entries", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        data: { reportData: { report: { events: {
          data: [{ type: "heal", sourceID: 2, targetID: 5, abilityGameID: 25314, amount: 5000, fight: 3 }],
          nextPageTimestamp: null,
        } } } },
      }), { status: 200 }),
    );
    const out = await fetchHealingDone("rep", "tok", [3]);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(5000);
    expect(out[0].sourceID).toBe(2);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wcl/api test wcl`
Expected: FAIL — `fetchHealingDone` is not exported.

- [ ] **Step 3: Add `fetchHealingDone` to `apps/api/src/wcl.ts`**

Add immediately after `fetchDamageDone` (around line 215):

```ts
/** Effective healing-done events by players (HealingDone dataType). Reuses the
 *  RawDamageEvent shape (sourceID/amount/fight); only the `heal` type is kept. */
export async function fetchHealingDone(code: string, accessToken: string, fightIds?: number[]): Promise<RawDamageEvent[]> {
  return await fetchAllEvents(code, accessToken, "HealingDone", new Set(["heal"]), fightIds) as unknown as RawDamageEvent[];
}
```

- [ ] **Step 4: Extend `RawDeathEvent` and the report `masterData` query**

In `apps/api/src/wcl.ts`, change `RawDeathEvent` (around line 170) to:

```ts
export interface RawDeathEvent {
  timestamp: number; type: string; targetID: number; fight: number;
  /** the killing-blow ability (present on most WCL death events) */
  killingAbilityGameID?: number;
}
```

(The deaths fetch uses `EVENTS_QUERY`, which returns the full event `data` object, so `killingAbilityGameID` already arrives in the payload — no query change is needed; only the type is widened. Note for the implementer: verify the field name against a real report via the existing probe pattern; WCL has historically used `killingAbilityGameID` on death events.)

In the `REPORT_QUERY` `masterData` block (around line 34-37), add an `abilities` selection:

```graphql
      masterData {
        actors(type: "Player") { id name subType }
        npcs: actors(type: "NPC") { id gameID }
        abilities { gameID name }
      }
```

In the `RawReport.masterData` type (around line 49-53), add:

```ts
  masterData: {
    actors: { id: number; name: string; subType: string }[];
    /** optional: absent on reports with no NPC actors / older fixtures (normalize falls back to []) */
    npcs?: { id: number; gameID: number }[];
    /** ability id → name, for damage-taken/death labels */
    abilities?: { gameID: number; name: string }[];
  } | null;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @wcl/api test wcl`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/wcl.ts apps/api/src/wcl.test.ts
git commit -m "feat(api): fetch HealingDone events, capture killing blow + ability names"
```

---

### Task 3: Normalize & app wiring (data reaches ReportData)

**Files:**
- Modify: `apps/api/src/normalize.ts` (`NormalizeEventInputs` gains `healingDone`, `abilityMeta`; `buildRpb` emits `healingEvents`; enrich `playerDeaths`; `normalizeReport` forwards `abilityMeta`)
- Modify: `apps/api/src/app.ts` (add `fetchHealingDone` dep, fetch it, build `abilityMeta` from masterData, pass both to normalize)
- Modify: `apps/api/src/normalize.test.ts` (assert `healingEvents`, enriched `playerDeaths`, `abilityMeta`)

**Interfaces:**
- Consumes: Task 1 `HealingEvent`/`PlayerDeath`/`ReportData.abilityMeta`; Task 2 `fetchHealingDone`/`RawDeathEvent.killingAbilityGameID`/`RawReport.masterData.abilities`.
- Produces: a normalized `ReportData` with `healingEvents`, enriched `playerDeaths`, and `abilityMeta` populated.

- [ ] **Step 1: Write the failing test in `apps/api/src/normalize.test.ts`**

Inspect the file for the existing `normalizeReport` call pattern (it passes a `RawReport` + a `NormalizeEventInputs` object). Add:

```ts
it("emits healingEvents, enriched deaths, and abilityMeta", () => {
  const raw = makeRawReport(); // reuse the file's existing raw-report builder/helper
  raw.masterData!.abilities = [{ gameID: 25314, name: "Renew" }];
  const data = normalizeReport("rep", raw, [], {}, {
    allCasts: [],                  // presence flag so buildRpb does not early-return
    damageDone: [],
    healingDone: [
      { timestamp: 1, type: "heal", sourceID: PLAYER_ID, targetID: PLAYER_ID, abilityGameID: 25314, amount: 5000, fight: BOSS_FIGHT_ID },
    ] as any,
    deaths: [
      { timestamp: 200, type: "death", targetID: PLAYER_ID, fight: BOSS_FIGHT_ID, killingAbilityGameID: 25314 } as any,
    ],
    abilityMeta: { "25314": { name: "Renew" } },
  });
  expect(data.healingEvents).toEqual([{ fightId: BOSS_FIGHT_ID, sourceId: PLAYER_ID, amount: 5000 }]);
  expect(data.playerDeaths![0]).toMatchObject({ killingAbilityId: 25314, timestamp: 200 });
  expect(data.abilityMeta).toEqual({ "25314": { name: "Renew" } });
});
```

Adapt `makeRawReport`, `PLAYER_ID`, `BOSS_FIGHT_ID` to the helpers/constants already present in `normalize.test.ts`. The player id used must be in the report's roster (a friendly player with combat footprint) so it survives `collectActiveIds`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wcl/api test normalize`
Expected: FAIL — `healingEvents` undefined / `abilityMeta` undefined / `killingAbilityId` missing.

- [ ] **Step 3: Extend `NormalizeEventInputs` in `apps/api/src/normalize.ts`**

Add these fields to the `NormalizeEventInputs` interface (after `rankings?`):

```ts
  /** effective healing-done events by players (performance breakdown) */
  healingDone?: RawDamageEvent[];
  /** abilityGameID → name, from masterData (performance breakdown) */
  abilityMeta?: Record<string, { name: string }>;
```

Add the `HealingEvent` import to the `@wcl/core` import block at the top:

```ts
  type HealingEvent,
```

- [ ] **Step 4: Emit `healingEvents` and enrich `playerDeaths` in `buildRpb`**

In `buildRpb`, widen the return `Pick<...>` union to include `"healingEvents"`:

```ts
): Partial<Pick<ReportData,
  "playerTotals" | "playerDeaths" | "interrupts" | "damageTakenEvents" | "playerCasts" | "playerDamage" | "enemyDebuffs" | "absorbs" | "healingEvents">> {
```

Replace the `playerDeaths` mapping with the enriched version:

```ts
  const playerDeaths: PlayerDeath[] = (events.deaths ?? [])
    .filter((d) => playerIds.has(d.targetID) && fightIds.has(d.fight))
    .map((d) => ({
      playerId: d.targetID, fightId: d.fight,
      killingAbilityId: d.killingAbilityGameID, timestamp: d.timestamp,
    }));
```

Add a `healingEvents` builder next to `playerDamage` (after the `playerDamage` mapping, before the `enemyDebuffs` block):

```ts
  const healingEvents: HealingEvent[] = (events.healingDone ?? [])
    .filter((d) => playerIds.has(d.sourceID) && fightIds.has(d.fight))
    .map((d) => ({ fightId: d.fight, sourceId: d.sourceID, amount: d.amount }));
```

Add `healingEvents` to the `buildRpb` return object:

```ts
  return {
    playerTotals: [...totalsById.values()],
    playerDeaths, interrupts, damageTakenEvents, playerCasts, playerDamage,
    enemyDebuffs, absorbs, healingEvents,
  };
```

- [ ] **Step 5: Forward `abilityMeta` in `normalizeReport`**

In the `normalizeReport` return object, add next to `rankings:` / `itemMeta`:

```ts
    abilityMeta: events.abilityMeta ?? {},
```

- [ ] **Step 6: Wire the new fetch + ability map in `apps/api/src/app.ts`**

Add the import alias next to `fetchDamageDone as realFetchDamageDone` (line 19):

```ts
  fetchHealingDone as realFetchHealingDone,
```

Add to the `AppDeps` interface (next to `fetchDamageDone`):

```ts
  fetchHealingDone: typeof realFetchHealingDone;
```

Add to the default deps object in `createApp(...)` (next to `fetchDamageDone: realFetchDamageDone`):

```ts
  fetchHealingDone: realFetchHealingDone,
```

Add a `healingDone` accumulator next to `damageDone` (around line 152):

```ts
      let healingDone: RawDamageEvent[] = [];
```

Add the fetch to the second `Promise.allSettled` array (the one keyed `[intR, dtR, ddR, ...]` around line 173). Append `deps.fetchHealingDone(id, token, allFightIds)` to the array and a matching destructured name, e.g.:

```ts
        const [intR, dtR, ddR, castR, ddtR, htR, dttR, edR, absR, rankR, hdR] = await Promise.allSettled([
          deps.fetchInterrupts(id, token, allFightIds),
          deps.fetchDamageTaken(id, token, allFightIds),
          deps.fetchDamageDone(id, token, allFightIds),
          deps.fetchAllCasts(id, token, allFightIds),
          hasBoss ? deps.fetchTable(id, token, "DamageDone", bossFightIds) : none,
          hasBoss ? deps.fetchTable(id, token, "Healing", bossFightIds) : none,
          hasBoss ? deps.fetchTable(id, token, "DamageTaken", bossFightIds) : none,
          deps.fetchEnemyDebuffs(id, token, allFightIds),
          deps.fetchAbsorbs(id, token, allFightIds),
          hasBoss ? deps.fetchRankings(id, token) : none,
          deps.fetchHealingDone(id, token, allFightIds),
        ]);
```

Add the result extraction next to the others (after the `rankR` line):

```ts
        if (hdR.status === "fulfilled") healingDone = hdR.value as RawDamageEvent[];
```

Build the `abilityMeta` map alongside `actorNames` (after line 198):

```ts
      const abilityMeta: Record<string, { name: string }> = {};
      for (const a of rawReport.masterData?.abilities ?? []) abilityMeta[String(a.gameID)] = { name: a.name };
```

Pass `healingDone` and `abilityMeta` into the `normalizeReport(...)` event-inputs object (extend the existing call around line 199-205):

```ts
        damageDoneTable, healingTable, damageTakenTable, actorNames,
        enemyDebuffs, absorbEvents, rankings, healingDone, abilityMeta,
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @wcl/api test`
Expected: PASS (normalize test green; existing app/wcl tests unaffected — new deps have real defaults).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/normalize.ts apps/api/src/app.ts apps/api/src/normalize.test.ts
git commit -m "feat(api): normalize healing events, enriched deaths, and ability names into ReportData"
```

---

### Task 4: Rename `PerformanceView` → `SummaryView`, relabel tab to "Summary"

**Files:**
- Rename: `apps/web/src/components/report/PerformanceView.tsx` → `apps/web/src/components/report/SummaryView.tsx` (component `PerformanceView` → `SummaryView`)
- Rename: `apps/web/src/components/report/PerformanceView.test.tsx` → `apps/web/src/components/report/SummaryView.test.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx` (import path, tab key `performance`→`roles` for the role tables, label `Performance`→`Summary`, render mapping)

**Interfaces:**
- Consumes: existing `rpb`, `consumables`, `gearIssues`, `scopeReportToFight`.
- Produces: `SummaryView` component (same props `{ report, fightId, onPlayer }`); ReportPage tab key `roles` rendering it. Frees the `performance` key + `Performance` label for Task 5.

- [ ] **Step 1: Rename the component file via git**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA"
git mv apps/web/src/components/report/PerformanceView.tsx apps/web/src/components/report/SummaryView.tsx
git mv apps/web/src/components/report/PerformanceView.test.tsx apps/web/src/components/report/SummaryView.test.tsx
```

- [ ] **Step 2: Rename the component symbol in `SummaryView.tsx`**

Change the export declaration line:

```ts
export function PerformanceView({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
```

to:

```ts
export function SummaryView({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
```

(Leave all internal logic, the `className="perf"`/`perf-role` markup, and `specOf` helper unchanged.)

- [ ] **Step 3: Update the test in `SummaryView.test.tsx`**

Replace the import and the two `render(<PerformanceView .../>)` usages:

```ts
import { SummaryView } from "./SummaryView";
```

Change the `describe("PerformanceView", ...)` label to `describe("SummaryView", ...)` and every `<PerformanceView ` to `<SummaryView `. The assertions ("Deaths", "Avoidable dmg", player-click, refresh notice) stay as-is.

- [ ] **Step 4: Update `apps/web/src/pages/ReportPage.tsx` import + tab**

Change the import:

```ts
import { PerformanceView } from "../components/report/PerformanceView";
```

to:

```ts
import { SummaryView } from "../components/report/SummaryView";
```

Change the `CATEGORIES` constant so the role-tables tab uses key `roles` and label `Summary` (leave `summary`/"Rankings" untouched; the new `performance` tab is added in Task 5):

```ts
const CATEGORIES = [
  ["summary", "Rankings"], ["roles", "Summary"], ["gear", "Gear"],
  ["consumables", "Consumables"], ["shadowresi", "Shadow Resi"],
] as const;
```

Change the render line:

```ts
{cat === "performance" && <PerformanceView report={report} fightId={fightId} onPlayer={goPlayer} />}
```

to:

```ts
{cat === "roles" && <SummaryView report={report} fightId={fightId} onPlayer={goPlayer} />}
```

(`TRASH_HIDDEN_CATS` stays `new Set(["summary", "gear", "shadowresi"])` — the role tables remain visible on the TRASH card exactly as before.)

- [ ] **Step 5: Run the web tests to verify they pass**

Run: `pnpm --filter @wcl/web test SummaryView`
Expected: PASS.

Run: `pnpm --filter @wcl/web test ReportPage`
Expected: PASS (if `ReportPage.test.tsx` asserts the old "Performance" tab label, update that assertion to "Summary" in this step; the role-tables content is unchanged).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/report/SummaryView.tsx apps/web/src/components/report/SummaryView.test.tsx apps/web/src/pages/ReportPage.tsx
git commit -m "refactor(web): rename Performance tab/component to Summary (role tables)"
```

---

### Task 5: New `PerformanceView` (four WCL panels) + CSS + add `Performance` tab

**Files:**
- Create: `apps/web/src/components/report/PerformanceView.tsx`
- Create: `apps/web/src/components/report/PerformanceView.test.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx` (import + add `performance` tab + render)
- Modify: `apps/web/src/index.css` (panel grid + amount-bar styles)
- Modify: `apps/web/src/pages/ReportPage.test.tsx` (assert the new tab renders)

**Interfaces:**
- Consumes: Task 1 `performanceSummary`, `PerfRanked`, `PerfDeathRow`; `scopeReportToFight`; `classColorVar`.
- Produces: `PerformanceView` component with props `{ report: ReportData; fightId: number; onPlayer: (name: string) => void }`; ReportPage `performance` tab.

- [ ] **Step 1: Write the failing test `apps/web/src/components/report/PerformanceView.test.tsx`**

```ts
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { PerformanceView } from "./PerformanceView";

describe("PerformanceView (summary panels)", () => {
  const report = reportFixture;
  const fightId = report.fights.find((f) => f.kill)!.id; // Hydross kill (id 3)

  it("renders the four panel titles", () => {
    render(<PerformanceView report={report} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getByText("Damage Done By Source")).toBeInTheDocument();
    expect(screen.getByText("Healing Done By Source")).toBeInTheDocument();
    expect(screen.getByText("Damage Taken By Ability")).toBeInTheDocument();
    expect(screen.getByText("Deaths")).toBeInTheDocument();
  });

  it("shows a damage-done row with a DPS value and a death killing blow", () => {
    render(<PerformanceView report={report} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getAllByText("Playerone").length).toBeGreaterThan(0);
    // killing blow ability name appears in the Deaths panel
    expect(screen.getByText("Frostbolt")).toBeInTheDocument();
  });

  it("navigates on source player click", () => {
    const onPlayer = vi.fn();
    render(<PerformanceView report={report} fightId={fightId} onPlayer={onPlayer} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Playerone" })[0]);
    expect(onPlayer).toHaveBeenCalledWith("Playerone");
  });

  it("shows a refresh notice when healing data is missing", () => {
    const bare = { ...report, healingEvents: undefined };
    render(<PerformanceView report={bare} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wcl/web test PerformanceView`
Expected: FAIL — `PerformanceView.tsx` does not exist.

- [ ] **Step 3: Implement `apps/web/src/components/report/PerformanceView.tsx`**

```tsx
import { useMemo } from "react";
import { performanceSummary, type ReportData, type PerfRanked, type PerfDeathRow } from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { classColorVar } from "../../lib/classColors";

const amount = (n: number) => Math.round(n).toLocaleString();
const rate = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(1));
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function PerformanceView({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
  const summary = useMemo(() => performanceSummary(scopeReportToFight(report, fightId)), [report, fightId]);

  if (summary === null) {
    return <p className="notice">This report was cached before the performance breakdown — Refresh from WCL (requires credentials).</p>;
  }

  return (
    <div className="perf-summary">
      <SourcePanel title="Damage Done By Source" rateLabel="DPS" rows={summary.damageBySource} onPlayer={onPlayer} />
      <SourcePanel title="Healing Done By Source" rateLabel="HPS" rows={summary.healingBySource} onPlayer={onPlayer} />
      <AbilityPanel title="Damage Taken By Ability" rateLabel="DTPS" rows={summary.damageTakenByAbility} />
      <DeathsPanel rows={summary.deaths} onPlayer={onPlayer} />
    </div>
  );
}

function maxAmount(rows: PerfRanked[]): number {
  return rows.reduce((m, r) => Math.max(m, r.amount), 0);
}

function SourcePanel({ title, rateLabel, rows, onPlayer }: { title: string; rateLabel: string; rows: PerfRanked[]; onPlayer: (name: string) => void }) {
  const max = maxAmount(rows);
  return (
    <section className="card perf-panel">
      <h3>{title}</h3>
      <div className="scroll-x">
        <table className="perf-table">
          <thead><tr><th>Name</th><th>%</th><th>Amount</th><th>{rateLabel}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="player-cell" style={classColorVar(r.className ?? "")}>
                  <button className="player-link" onClick={() => onPlayer(r.name)}>{r.name}</button>
                </td>
                <td className="mono">{pct(r.percent)}</td>
                <td className="perf-amount">
                  <span className="perf-bar" style={{ ["--w" as string]: `${max > 0 ? (r.amount / max) * 100 : 0}%` }} />
                  <span className="mono">{amount(r.amount)}</span>
                </td>
                <td className="mono">{rate(r.perSecond)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AbilityPanel({ title, rateLabel, rows }: { title: string; rateLabel: string; rows: PerfRanked[] }) {
  const max = maxAmount(rows);
  return (
    <section className="card perf-panel">
      <h3>{title}</h3>
      <div className="scroll-x">
        <table className="perf-table">
          <thead><tr><th>Name</th><th>%</th><th>Amount</th><th>{rateLabel}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="mono">{pct(r.percent)}</td>
                <td className="perf-amount">
                  <span className="perf-bar" style={{ ["--w" as string]: `${max > 0 ? (r.amount / max) * 100 : 0}%` }} />
                  <span className="mono">{amount(r.amount)}</span>
                </td>
                <td className="mono">{rate(r.perSecond)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeathsPanel({ rows, onPlayer }: { rows: PerfDeathRow[]; onPlayer: (name: string) => void }) {
  return (
    <section className="card perf-panel">
      <h3>Deaths</h3>
      <div className="scroll-x">
        <table className="perf-table">
          <thead><tr><th>Name</th><th>Killing Blow</th><th>Time</th></tr></thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={3} className="sev-neutral">No deaths</td></tr>
              : rows.map((r, i) => (
                <tr key={`${r.playerId}-${i}`}>
                  <td className="player-cell" style={classColorVar(r.className ?? "")}>
                    <button className="player-link" onClick={() => onPlayer(r.playerName)}>{r.playerName}</button>
                  </td>
                  <td>{r.killingBlow}</td>
                  <td className="mono">{mmss(r.timeMs)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add panel styles to `apps/web/src/index.css`**

Append:

```css
/* Performance summary — WCL-style four-panel layout */
.perf-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 900px) {
  .perf-summary { grid-template-columns: 1fr; }
}
.perf-panel h3 { margin: 0 0 8px; }
.perf-table { width: 100%; border-collapse: collapse; }
.perf-table th, .perf-table td { padding: 4px 8px; text-align: left; white-space: nowrap; }
.perf-table th:nth-child(n+2), .perf-table td.mono { text-align: right; }
.perf-amount { position: relative; min-width: 160px; }
.perf-amount .mono { position: relative; z-index: 1; float: right; }
.perf-bar {
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  height: 16px; width: var(--w, 0%);
  background: color-mix(in srgb, var(--accent, #4f8cff) 35%, transparent);
  border-radius: 3px;
}
```

(If `--accent` is not defined in the theme, substitute the project's existing accent variable — check `index.css`/`theme.css` for the established bar/accent color and reuse it.)

- [ ] **Step 5: Add the `Performance` tab to `apps/web/src/pages/ReportPage.tsx`**

Add the import (below the `SummaryView` import from Task 4):

```ts
import { PerformanceView } from "../components/report/PerformanceView";
```

Insert the `performance` tab into `CATEGORIES` between `roles` and `gear`:

```ts
const CATEGORIES = [
  ["summary", "Rankings"], ["roles", "Summary"], ["performance", "Performance"], ["gear", "Gear"],
  ["consumables", "Consumables"], ["shadowresi", "Shadow Resi"],
] as const;
```

Add the render line after the `roles` render line:

```ts
{cat === "performance" && <PerformanceView report={report} fightId={fightId} onPlayer={goPlayer} />}
```

(`performance` is event-sourced, so it stays **visible** on the TRASH card — do not add it to `TRASH_HIDDEN_CATS`.)

- [ ] **Step 6: Add a ReportPage assertion in `apps/web/src/pages/ReportPage.test.tsx`**

Find the existing test that renders `ReportPage` with a loaded report and asserts on tab labels. Add an assertion that both the renamed and new tabs are present:

```ts
expect(screen.getByRole("button", { name: "Summary" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Performance" })).toBeInTheDocument();
```

(Match the query style already used in that file — it may use `getByText` rather than `getByRole`. If the test navigates by clicking a tab, add a click on "Performance" and assert a panel title like "Damage Done By Source" renders.)

- [ ] **Step 7: Run the web tests to verify they pass**

Run: `pnpm --filter @wcl/web test PerformanceView`
Expected: PASS (4 tests).

Run: `pnpm --filter @wcl/web test ReportPage`
Expected: PASS.

- [ ] **Step 8: Run the full web suite + typecheck/build**

Run: `pnpm --filter @wcl/web test`
Expected: PASS.

Run (typecheck/build — use the repo's script; commonly): `pnpm -r build` or `pnpm -r typecheck`
Expected: no TypeScript errors (verifies the `["--w" as string]` inline-style cast and cross-package types compile).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/report/PerformanceView.tsx apps/web/src/components/report/PerformanceView.test.tsx apps/web/src/pages/ReportPage.tsx apps/web/src/pages/ReportPage.test.tsx apps/web/src/index.css
git commit -m "feat(web): add WCL-style Performance tab (damage/healing/taken/deaths panels)"
```

---

## Final verification

- [ ] Run the entire test suite from repo root: `pnpm -r test` — expected PASS across `@wcl/core`, `@wcl/api`, `@wcl/web`.
- [ ] Manual smoke (optional, requires WCL credentials): load a fresh report, open the **Performance** tab on a boss card, confirm the four panels populate with sorted rows, bars, and DPS/HPS/DTPS; switch to the **TRASH** card and confirm Performance still renders (Summary/Rankings/Gear/Shadow Resi visibility unchanged); confirm a previously-cached report shows the refresh notice until re-pulled.

## Notes / risk callouts

- **WCL death field name:** Task 2 assumes the death event exposes `killingAbilityGameID`. If a real report shows the killing blow as "—", inspect a raw death event (the events `data` payload) and adjust the field read in `RawDeathEvent` + `buildRpb` accordingly. This does not block the panels — only the Deaths "Killing Blow" column depends on it.
- **WCL points:** adding `fetchHealingDone` over all fights increases per-report point cost (symmetric with the existing `fetchDamageDone`). Acceptable and consistent with the current fetch model; results are cached per report.
- **Fidelity:** per-row WoW icons are intentionally omitted (no icon assets); source names use class colors, ability/death rows are name-only — per the approved design.
