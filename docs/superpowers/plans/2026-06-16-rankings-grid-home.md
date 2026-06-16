# Rankings Grid on Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WarcraftLogs-style player × boss parse-percentile grid (Damage Dealers / Healers / Tanks) to the Home page, above the report summary, cached with the report so keyless viewers see it.

**Architecture:** WCL's `report.rankings` JSON (one query) returns per-boss data already grouped into `roles.tanks/healers/dps` with each character's `rankPercent`/`bracketPercent`. We fetch it best-effort in `apps/api` (alongside the other M5+ fetches), normalize it into a new optional `ReportData.rankings` field, pivot it into a grid with a pure `buildRankingsGrid` in `@wcl/core`, and render it in a new `RankingsGrid` web component colored on WCL's parse-percentile scale (separate from the app's `sev-*` heatmap).

**Tech Stack:** pnpm monorepo — `@wcl/core` (pure analysis + types), `apps/api` (Hono + GraphQL fetchers, Vitest), `apps/web` (React 19 + Vite, Vitest + Testing Library). TDD throughout.

**Spec:** `docs/superpowers/specs/2026-06-16-rankings-grid-home-design.md`

⚠️ **Assumed WCL shape.** The `rankings` JSON shape is assumed (no creds in build env). All mapping is defensive (optional chaining + fallbacks). Live verification with the user's key happens during E2E; the assistant never touches the secret.

---

### Task 1: Core types + report fixture

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/fixtures/report.fixture.ts`

- [ ] **Step 1: Add the ranking types to `types.ts`**

Add at the end of `packages/core/src/types.ts`:

```ts
/** One character's parse in a boss ranking (from WCL's rankings JSON). */
export interface RankingCharacter {
  name: string;
  /** WoW class string, e.g. "Mage" (matches Player.class) */
  class: string;
  spec?: string;
  /** damage/healing parse percentile, 0–100 */
  rankPercent: number;
  /** item-level (bracket) parse percentile, 0–100 */
  bracketPercent: number;
}

/** WCL parse rankings for one ranked (killed) boss fight, grouped by WCL role. */
export interface ReportRanking {
  fightID: number;
  encounterId: number;
  encounterName: string;
  tanks: RankingCharacter[];
  healers: RankingCharacter[];
  dps: RankingCharacter[];
}
```

Then add this field to the `ReportData` interface, right after the `enemyDebuffs?` line:

```ts
  /** WCL parse-percentile rankings per ranked boss, grouped by WCL role
   *  (rankings feature); undefined = report cached before this feature. */
  rankings?: ReportRanking[];
```

- [ ] **Step 2: Add `rankings` to the report fixture**

In `packages/core/src/fixtures/report.fixture.ts`, add this property to the `reportFixture` object (place it just before the final `itemMeta:` property):

```ts
  rankings: [
    {
      fightID: 3, encounterId: 623, encounterName: "Hydross the Unstable",
      dps: [{ name: "Playerone", class: "Mage", spec: "Fire", rankPercent: 95, bracketPercent: 88 }],
      healers: [{ name: "Healerone", class: "Priest", spec: "Holy", rankPercent: 72, bracketPercent: 70 }],
      tanks: [{ name: "Playertwo", class: "Warrior", spec: "Protection", rankPercent: 40, bracketPercent: 55 }],
    },
    {
      fightID: 5, encounterId: 624, encounterName: "The Lurker Below",
      dps: [{ name: "Playerone", class: "Mage", spec: "Fire", rankPercent: 99, bracketPercent: 90 }],
      healers: [{ name: "Healerone", class: "Priest", spec: "Holy", rankPercent: 60, bracketPercent: 64 }],
      tanks: [],
    },
  ],
```

- [ ] **Step 3: Typecheck core**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/core exec tsc --noEmit`
Expected: PASS (no errors). The fixture satisfies the new optional field.

- [ ] **Step 4: Commit**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA"
git add packages/core/src/types.ts packages/core/src/fixtures/report.fixture.ts
git commit -m "feat(core): rankings types + fixture data"
```

---

### Task 2: Core `buildRankingsGrid` (pure aggregation)

**Files:**
- Create: `packages/core/src/rankings.ts`
- Test: `packages/core/src/rankings.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/rankings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRankingsGrid } from "./rankings";
import { reportFixture } from "./fixtures/report.fixture";

describe("buildRankingsGrid", () => {
  it("returns null when there is no rankings data", () => {
    expect(buildRankingsGrid(undefined)).toBeNull();
    expect(buildRankingsGrid([])).toBeNull();
  });

  it("lists bosses in fight order", () => {
    const grid = buildRankingsGrid(reportFixture.rankings)!;
    expect(grid.bosses.map((b) => b.name)).toEqual([
      "Hydross the Unstable",
      "The Lurker Below",
    ]);
  });

  it("groups players into dps/healers/tanks sections in order", () => {
    const grid = buildRankingsGrid(reportFixture.rankings)!;
    expect(grid.sections.map((s) => s.role)).toEqual(["dps", "healers", "tanks"]);
  });

  it("pivots each player's parses keyed by fightID", () => {
    const grid = buildRankingsGrid(reportFixture.rankings)!;
    const dps = grid.sections.find((s) => s.role === "dps")!;
    const playerone = dps.players.find((p) => p.name === "Playerone")!;
    expect(playerone.perBoss[3].rankPercent).toBe(95);
    expect(playerone.perBoss[5].rankPercent).toBe(99);
    expect(playerone.overall).toBe(97); // (95 + 99) / 2
  });

  it("omits bosses a player has no parse for (sparse perBoss)", () => {
    const grid = buildRankingsGrid(reportFixture.rankings)!;
    const tanks = grid.sections.find((s) => s.role === "tanks")!;
    const tank = tanks.players.find((p) => p.name === "Playertwo")!;
    expect(tank.perBoss[3].rankPercent).toBe(40);
    expect(tank.perBoss[5]).toBeUndefined(); // no Lurker tank entry
  });

  it("sorts players within a section by overall parse descending", () => {
    const rankings = [
      {
        fightID: 3, encounterId: 623, encounterName: "Hydross",
        dps: [
          { name: "Low", class: "Mage", rankPercent: 30, bracketPercent: 30 },
          { name: "High", class: "Mage", rankPercent: 90, bracketPercent: 90 },
        ],
        healers: [], tanks: [],
      },
    ];
    const grid = buildRankingsGrid(rankings)!;
    expect(grid.sections[0].players.map((p) => p.name)).toEqual(["High", "Low"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/core exec vitest run src/rankings.test.ts`
Expected: FAIL — cannot find module `./rankings`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/rankings.ts`:

```ts
import type { ReportRanking } from "./types";

export type RankingsRole = "dps" | "healers" | "tanks";

export interface RankingsGridPlayer {
  name: string;
  class: string;
  spec?: string;
  /** parse per ranked boss, keyed by fightID (sparse — absent boss = not played) */
  perBoss: Record<number, { rankPercent: number; bracketPercent: number }>;
  /** mean rankPercent across bosses played, used for sorting */
  overall: number;
}

export interface RankingsSection {
  role: RankingsRole;
  players: RankingsGridPlayer[];
}

export interface RankingsBoss {
  fightID: number;
  encounterId: number;
  name: string;
}

export interface RankingsGrid {
  bosses: RankingsBoss[];
  sections: RankingsSection[];
}

const ROLE_ORDER: RankingsRole[] = ["dps", "healers", "tanks"];

/** Pivot WCL per-boss rankings into a player × boss grid grouped by WCL role.
 *  Returns null when there is no usable rankings data. */
export function buildRankingsGrid(rankings: ReportRanking[] | undefined): RankingsGrid | null {
  if (!rankings || rankings.length === 0) return null;

  const bosses: RankingsBoss[] = rankings.map((r) => ({
    fightID: r.fightID,
    encounterId: r.encounterId,
    name: r.encounterName,
  }));

  const sections: RankingsSection[] = [];
  for (const role of ROLE_ORDER) {
    const byName = new Map<string, RankingsGridPlayer>();
    for (const r of rankings) {
      for (const ch of r[role]) {
        let p = byName.get(ch.name);
        if (!p) {
          p = { name: ch.name, class: ch.class, spec: ch.spec, perBoss: {}, overall: 0 };
          byName.set(ch.name, p);
        }
        p.perBoss[r.fightID] = { rankPercent: ch.rankPercent, bracketPercent: ch.bracketPercent };
      }
    }
    const players = [...byName.values()];
    for (const p of players) {
      const vals = Object.values(p.perBoss).map((v) => v.rankPercent);
      p.overall = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    players.sort((a, b) => b.overall - a.overall);
    if (players.length > 0) sections.push({ role, players });
  }

  if (sections.length === 0) return null;
  return { bosses, sections };
}
```

- [ ] **Step 4: Export from the core barrel**

In `packages/core/src/index.ts`, add after the `export * from "./rpbConsumables";` line:

```ts
export * from "./rankings";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/core exec vitest run src/rankings.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA"
git add packages/core/src/rankings.ts packages/core/src/rankings.test.ts packages/core/src/index.ts
git commit -m "feat(core): buildRankingsGrid pivot for parse rankings"
```

---

### Task 3: API `fetchRankings` (WCL query)

**Files:**
- Modify: `apps/api/src/wcl.ts`
- Test: `apps/api/src/wcl.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/wcl.test.ts` (after the last `describe` block):

```ts
describe("fetchRankings", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the rankings data array from the JSON field", async () => {
    const entry = {
      encounter: { id: 623, name: "Hydross the Unstable" },
      fightID: 3,
      roles: {
        tanks: { characters: [{ name: "Tankone", class: "Warrior", spec: "Protection", rankPercent: 64.2, bracketPercent: 70.1 }] },
        healers: { characters: [] },
        dps: { characters: [{ name: "Dpsone", class: "Mage", spec: "Fire", rankPercent: 95.8, bracketPercent: 88.4 }] },
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { reportData: { report: { rankings: { data: [entry] } } } } })),
    );
    const { fetchRankings } = await import("./wcl");
    const result = await fetchRankings("abc", "tok");
    expect(result).toHaveLength(1);
    expect(result[0].fightID).toBe(3);
    expect(result[0].roles?.dps?.characters?.[0].name).toBe("Dpsone");
  });

  it("returns [] when rankings is null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { reportData: { report: { rankings: null } } } })),
    );
    const { fetchRankings } = await import("./wcl");
    expect(await fetchRankings("abc", "tok")).toEqual([]);
  });
});
```

(If `wcl.test.ts` does not already import `afterEach`/`vi`, they are present — confirmed at the top of the file: `import { afterEach, describe, expect, it, vi } from "vitest";`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/api exec vitest run src/wcl.test.ts -t fetchRankings`
Expected: FAIL — `fetchRankings` is not exported.

- [ ] **Step 3: Write the implementation**

In `apps/api/src/wcl.ts`, add this query + types + fetcher. Place the query constant near the other query constants (e.g. after `REPORT_QUERY`'s `fetchRawReport`), and the fetcher with the other `fetch*` exports:

```ts
const RANKINGS_QUERY = `
query Rankings($code: String!) {
  reportData {
    report(code: $code) {
      rankings
    }
  }
}`;

export interface RawRankingCharacter {
  name: string;
  /** WCL may key the class as `class` or `type` depending on the field set */
  class?: string;
  type?: string;
  spec?: string;
  rankPercent?: number;
  bracketPercent?: number;
}

export interface RawRankingEntry {
  encounter?: { id?: number; name?: string };
  fightID?: number;
  roles?: {
    tanks?: { characters?: RawRankingCharacter[] };
    healers?: { characters?: RawRankingCharacter[] };
    dps?: { characters?: RawRankingCharacter[] };
  };
}

/** Fetch WCL parse rankings (one JSON field, grouped per boss by role).
 *  Returns [] when the report has no rankings. */
export async function fetchRankings(code: string, accessToken: string): Promise<RawRankingEntry[]> {
  const data = await gql<{ reportData?: { report?: { rankings?: { data?: RawRankingEntry[] } | null } } }>(
    RANKINGS_QUERY, { code }, accessToken);
  return data.reportData?.report?.rankings?.data ?? [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/api exec vitest run src/wcl.test.ts -t fetchRankings`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA"
git add apps/api/src/wcl.ts apps/api/src/wcl.test.ts
git commit -m "feat(api): fetchRankings WCL query"
```

---

### Task 4: Normalize rankings into `ReportData.rankings`

**Files:**
- Modify: `apps/api/src/normalize.ts`
- Test: `apps/api/src/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/normalize.test.ts` a new test. Use the existing minimal `rawReport` builder pattern in that file; if a helper like `makeRawReport()` exists, reuse it, otherwise inline a minimal raw report with `zone.name: "Serpentshrine Cavern"`, one boss fight, and one actor. Add:

```ts
describe("normalizeReport — rankings", () => {
  it("maps raw rankings into ReportData.rankings (class from class|type, rounded)", () => {
    const raw = {
      title: "T5", startTime: 0, endTime: 1000, zone: { name: "Serpentshrine Cavern" },
      fights: [{ id: 3, name: "Hydross the Unstable", encounterID: 623, kill: true, startTime: 0, endTime: 1000, friendlyPlayers: [1] }],
      masterData: { actors: [{ id: 1, name: "Dpsone", subType: "Mage" }] },
    };
    const data = normalizeReport("abc", raw as never, [], {}, {
      rankings: [{
        encounter: { id: 623, name: "Hydross the Unstable" },
        fightID: 3,
        roles: {
          tanks: { characters: [] },
          healers: { characters: [] },
          dps: { characters: [{ name: "Dpsone", type: "Mage", spec: "Fire", rankPercent: 95.8, bracketPercent: 88.4 }] },
        },
      }],
    });
    expect(data.rankings).toHaveLength(1);
    expect(data.rankings![0].encounterName).toBe("Hydross the Unstable");
    expect(data.rankings![0].dps[0]).toEqual({ name: "Dpsone", class: "Mage", spec: "Fire", rankPercent: 96, bracketPercent: 88 });
  });

  it("leaves rankings undefined when not provided", () => {
    const raw = {
      title: "T5", startTime: 0, endTime: 1000, zone: { name: "Serpentshrine Cavern" },
      fights: [{ id: 3, name: "Hydross", encounterID: 623, kill: true, startTime: 0, endTime: 1000, friendlyPlayers: [1] }],
      masterData: { actors: [{ id: 1, name: "Dpsone", subType: "Mage" }] },
    };
    const data = normalizeReport("abc", raw as never, [], {}, {});
    expect(data.rankings).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/api exec vitest run src/normalize.test.ts -t rankings`
Expected: FAIL — `data.rankings` is undefined in the first test (mapping not implemented).

- [ ] **Step 3: Write the implementation**

In `apps/api/src/normalize.ts`:

1. Add the `ReportRanking` and `RankingCharacter` types to the `@wcl/core` import block at the top:

```ts
  type ReportRanking,
  type RankingCharacter,
```

2. Add `RawRankingEntry` and `RawRankingCharacter` to the `./wcl` import block:

```ts
  type RawRankingEntry,
  type RawRankingCharacter,
```

3. Add `rankings` to the `NormalizeEventInputs` interface (after `absorbEvents`):

```ts
  /** raw WCL rankings entries (per boss, grouped by role); undefined = not fetched */
  rankings?: RawRankingEntry[];
```

4. Add this helper function above `normalizeReport`:

```ts
function buildRankings(entries: RawRankingEntry[]): ReportRanking[] {
  const mapChar = (c: RawRankingCharacter): RankingCharacter => ({
    name: c.name,
    class: c.class ?? c.type ?? "Unknown",
    spec: c.spec,
    rankPercent: Math.round(c.rankPercent ?? 0),
    bracketPercent: Math.round(c.bracketPercent ?? 0),
  });
  return entries
    .filter((e) => e.fightID != null && e.encounter?.id != null)
    .map((e) => ({
      fightID: e.fightID!,
      encounterId: e.encounter!.id!,
      encounterName: e.encounter!.name ?? `Boss ${e.encounter!.id}`,
      tanks: (e.roles?.tanks?.characters ?? []).map(mapChar),
      healers: (e.roles?.healers?.characters ?? []).map(mapChar),
      dps: (e.roles?.dps?.characters ?? []).map(mapChar),
    }));
}
```

5. In the `normalizeReport` return object (the final `return { ... }` that builds `ReportData`), add this field (place it near the end, e.g. just before `itemMeta:`):

```ts
    rankings: events.rankings ? buildRankings(events.rankings) : undefined,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/api exec vitest run src/normalize.test.ts -t rankings`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA"
git add apps/api/src/normalize.ts apps/api/src/normalize.test.ts
git commit -m "feat(api): normalize WCL rankings into ReportData.rankings"
```

---

### Task 5: Wire `fetchRankings` into the report endpoint

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/api/src/app.test.ts`, add `fetchRankings` to BOTH deps objects (the `testDeps` const ~line 5 and the `makeApp` default ~line 32), each as:

```ts
  fetchRankings: vi.fn().mockResolvedValue([]),
```

Then add a test that a successful rankings fetch lands in the cached report. Rankings are only fetched when the report has boss fights, so override `fetchRawReport` with a report that has one boss fight (encounterID ≠ 0). `makeApp` builds a fresh cache per app, so reusing the standard test id `a1B2c3D4e5F6g7H8` is safe:

```ts
it("includes rankings in the normalized report", async () => {
  const app = makeApp({
    fetchRawReport: vi.fn().mockResolvedValue({
      title: "T5 fun", startTime: 1, endTime: 2, zone: { name: "Karazhan" },
      fights: [{ id: 7, name: "Attumen the Huntsman", encounterID: 16151, kill: true, startTime: 0, endTime: 1000, friendlyPlayers: [1] }],
      masterData: { actors: [{ id: 1, name: "Dpsone", subType: "Mage" }], npcs: [] },
    } satisfies RawReport),
    fetchRankings: vi.fn().mockResolvedValue([{
      encounter: { id: 16151, name: "Attumen the Huntsman" },
      fightID: 7,
      roles: {
        tanks: { characters: [] },
        healers: { characters: [] },
        dps: { characters: [{ name: "Dpsone", class: "Mage", rankPercent: 95, bracketPercent: 88 }] },
      },
    }]),
  });
  const res = await app.request("/api/report/a1B2c3D4e5F6g7H8", {
    headers: { Authorization: "Bearer tok" },
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data.rankings[0].dps[0].name).toBe("Dpsone");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/api exec vitest run src/app.test.ts -t rankings`
Expected: FAIL — `body.data.rankings` is undefined (fetcher not wired into `normalizeReport`).

- [ ] **Step 3: Wire the fetcher in `app.ts`**

1. Add to the imports from `./wcl`:

```ts
  fetchRankings as realFetchRankings,
```

2. Add to the `AppDeps` interface (after `fetchAbsorbs`):

```ts
  fetchRankings: typeof realFetchRankings;
```

3. Add to the default `deps` object in `createApp(...)` (after `fetchAbsorbs: realFetchAbsorbs,`):

```ts
  fetchRankings: realFetchRankings,
```

4. In the boss-fights `Promise.allSettled` block, add the rankings fetch. Declare the holder before the block, near the other `let` declarations:

```ts
      let rankings: RawRankingEntry[] | undefined;
```

Add the import for that type to the `./wcl` type imports:

```ts
  type RawRankingEntry,
```

Then add `deps.fetchRankings(id, token)` as a new element of the `Promise.allSettled([...])` array and a matching destructured result. Concretely, extend the existing array call (currently `const [intR, dtR, ddR, castR, ddtR, htR, dttR, edR, absR] = await Promise.allSettled([...])`) to:

```ts
        const [intR, dtR, ddR, castR, ddtR, htR, dttR, edR, absR, rankR] = await Promise.allSettled([
          deps.fetchInterrupts(id, token, bossFightIds),
          deps.fetchDamageTaken(id, token, bossFightIds),
          deps.fetchDamageDone(id, token, bossFightIds),
          deps.fetchAllCasts(id, token, bossFightIds),
          deps.fetchTable(id, token, "DamageDone", bossFightIds),
          deps.fetchTable(id, token, "Healing", bossFightIds),
          deps.fetchTable(id, token, "DamageTaken", bossFightIds),
          deps.fetchEnemyDebuffs(id, token, bossFightIds),
          deps.fetchAbsorbs(id, token, bossFightIds),
          deps.fetchRankings(id, token),
        ]);
```

and after the existing `if (absR.status === "fulfilled") ...` line add:

```ts
        if (rankR.status === "fulfilled") rankings = rankR.value as RawRankingEntry[];
```

5. Pass `rankings` into the `normalizeReport(...)` events object — add `rankings` to the object literal that currently ends with `enemyDebuffs, absorbEvents,`:

```ts
        enemyDebuffs, absorbEvents, rankings,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/api exec vitest run`
Expected: PASS (all api tests, including the new rankings test).

- [ ] **Step 5: Typecheck api**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA/apps/api" && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA"
git add apps/api/src/app.ts apps/api/src/app.test.ts
git commit -m "feat(api): fetch + cache rankings with the report"
```

---

### Task 6: Web parse-color helper + CSS

**Files:**
- Create: `apps/web/src/lib/parseColor.ts`
- Test: `apps/web/src/lib/parseColor.test.ts`
- Modify: `apps/web/src/theme.css`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/parseColor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseBand, parseClass } from "./parseColor";

describe("parseBand", () => {
  it("maps percentiles to WCL bands at the boundaries", () => {
    expect(parseBand(0)).toBe("common");
    expect(parseBand(24)).toBe("common");
    expect(parseBand(25)).toBe("uncommon");
    expect(parseBand(49)).toBe("uncommon");
    expect(parseBand(50)).toBe("rare");
    expect(parseBand(74)).toBe("rare");
    expect(parseBand(75)).toBe("epic");
    expect(parseBand(94)).toBe("epic");
    expect(parseBand(95)).toBe("legendary");
    expect(parseBand(98)).toBe("legendary");
    expect(parseBand(99)).toBe("astounding");
    expect(parseBand(100)).toBe("artifact");
  });
});

describe("parseClass", () => {
  it("prefixes the band with parse-", () => {
    expect(parseClass(95)).toBe("parse-legendary");
    expect(parseClass(10)).toBe("parse-common");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/web exec vitest run src/lib/parseColor.test.ts`
Expected: FAIL — cannot find module `./parseColor`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/parseColor.ts`:

```ts
/** WarcraftLogs parse-percentile color bands. */
export type ParseBand =
  | "common" | "uncommon" | "rare" | "epic" | "legendary" | "astounding" | "artifact";

/** Map a 0–100 parse percentile to its WCL color band. */
export function parseBand(pct: number): ParseBand {
  if (pct >= 100) return "artifact";
  if (pct >= 99) return "astounding";
  if (pct >= 95) return "legendary";
  if (pct >= 75) return "epic";
  if (pct >= 50) return "rare";
  if (pct >= 25) return "uncommon";
  return "common";
}

/** CSS class for a parse cell, e.g. "parse-legendary". */
export function parseClass(pct: number): string {
  return `parse-${parseBand(pct)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/web exec vitest run src/lib/parseColor.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the color CSS vars**

In `apps/web/src/theme.css`, inside the `:root {` block (after the `--positive-bg` line ~26), add:

```css
  --parse-common: #6b7280;
  --parse-uncommon: #1a8f3c;
  --parse-rare: #1f6fd6;
  --parse-epic: #8b2fd6;
  --parse-legendary: #d96b00;
  --parse-astounding: #d6479b;
  --parse-artifact: #b8932f;
```

And inside the `:root[data-theme="dark"] {` block (after the `--positive-bg` line ~68), add the brighter dark-mode variants:

```css
  --parse-common: #9d9d9d;
  --parse-uncommon: #1eff00;
  --parse-rare: #3b9bff;
  --parse-epic: #c77dff;
  --parse-legendary: #ff8000;
  --parse-astounding: #ff79c6;
  --parse-artifact: #e5cc80;
```

- [ ] **Step 6: Add the cell classes**

In `apps/web/src/index.css`, after the `tr td.sev-neutral { ... }` line (~537), add:

```css
tr td.parse-common { color: var(--parse-common); font-weight: 600; }
tr td.parse-uncommon { color: var(--parse-uncommon); font-weight: 600; }
tr td.parse-rare { color: var(--parse-rare); font-weight: 600; }
tr td.parse-epic { color: var(--parse-epic); font-weight: 600; }
tr td.parse-legendary { color: var(--parse-legendary); font-weight: 600; }
tr td.parse-astounding { color: var(--parse-astounding); font-weight: 600; }
tr td.parse-artifact { color: var(--parse-artifact); font-weight: 700; }
```

- [ ] **Step 7: Commit**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA"
git add apps/web/src/lib/parseColor.ts apps/web/src/lib/parseColor.test.ts apps/web/src/theme.css apps/web/src/index.css
git commit -m "feat(web): WCL parse-percentile color helper + CSS"
```

---

### Task 7: `RankingsGrid` component

**Files:**
- Create: `apps/web/src/components/RankingsGrid.tsx`
- Test: `apps/web/src/components/RankingsGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/RankingsGrid.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { RankingsGrid } from "./RankingsGrid";

afterEach(() => cleanup());

describe("RankingsGrid", () => {
  it("renders a refresh notice when rankings are absent (old cache)", () => {
    render(<RankingsGrid report={{ ...reportFixture, rankings: undefined }} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeTruthy();
  });

  it("renders the three role sections", () => {
    render(<RankingsGrid report={reportFixture} />);
    expect(screen.getByRole("heading", { name: "Damage Dealers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Healers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tanks" })).toBeTruthy();
  });

  it("colors each parse cell on the WCL band scale", () => {
    render(<RankingsGrid report={reportFixture} />);
    // Playerone DPS: 95 on Hydross (legendary), 99 on Lurker (astounding)
    expect(screen.getByText("95").className).toBe("parse-legendary");
    expect(screen.getByText("99").className).toBe("parse-astounding");
    // Playertwo tank: 40 on Hydross (uncommon)
    expect(screen.getByText("40").className).toBe("parse-uncommon");
  });

  it("shows an em dash where a player has no parse for a boss", () => {
    render(<RankingsGrid report={reportFixture} />);
    const tanksHeading = screen.getByRole("heading", { name: "Tanks" });
    const tankTable = tanksHeading.parentElement!.querySelector("table")!;
    // Playertwo has no Lurker entry → one neutral em-dash cell in the tanks table
    expect(within(tankTable).getByText("—")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/web exec vitest run src/components/RankingsGrid.test.tsx`
Expected: FAIL — cannot find module `./RankingsGrid`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/RankingsGrid.tsx`:

```tsx
import { buildRankingsGrid, type RankingsRole, type ReportData } from "@wcl/core";
import { classColor } from "../lib/classColors";
import { parseClass } from "../lib/parseColor";

const ROLE_LABEL: Record<RankingsRole, string> = {
  dps: "Damage Dealers",
  healers: "Healers",
  tanks: "Tanks",
};

export function RankingsGrid({ report }: { report: ReportData }) {
  if (report.rankings === undefined) {
    return <p className="sev-legend">Refresh from WCL to load parse rankings.</p>;
  }
  const grid = buildRankingsGrid(report.rankings);
  if (!grid) return <p className="sev-legend">No ranked boss kills in this report.</p>;

  return (
    <div>
      <h2>Rankings</h2>
      {grid.sections.map((section) => (
        <section key={section.role}>
          <h3>{ROLE_LABEL[section.role]}</h3>
          <table>
            <thead>
              <tr>
                <th>player</th>
                {grid.bosses.map((b) => (
                  <th key={b.fightID}>{b.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.players.map((p) => (
                <tr key={p.name}>
                  <td>
                    <span style={{ color: classColor(p.class), fontWeight: 600 }}>{p.name}</span>
                  </td>
                  {grid.bosses.map((b) => {
                    const cell = p.perBoss[b.fightID];
                    return cell ? (
                      <td key={b.fightID} className={parseClass(cell.rankPercent)}>
                        {cell.rankPercent}
                      </td>
                    ) : (
                      <td key={b.fightID} className="sev-neutral">
                        —
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/web exec vitest run src/components/RankingsGrid.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA"
git add apps/web/src/components/RankingsGrid.tsx apps/web/src/components/RankingsGrid.test.tsx
git commit -m "feat(web): RankingsGrid parse-percentile table"
```

---

### Task 8: Render `RankingsGrid` on Home above the summary

**Files:**
- Modify: `apps/web/src/pages/HomePage.tsx`

- [ ] **Step 1: Add the grid to `HomeSummary`**

In `apps/web/src/pages/HomePage.tsx`:

1. Add the import (with the other component imports near the top):

```ts
import { RankingsGrid } from "../components/RankingsGrid";
```

2. In the `HomeSummary` component's returned JSX, render the grid in its own card **above** the existing summary card. The current return ends with the summary card:

```tsx
  return (
    <div className="card" style={{ marginTop: 24 }}>
      {loadCredentials() !== null && (
        ...
      )}
      <ReportSummary report={result.data} cachedAt={result.cachedAt} />
    </div>
  );
```

Replace it with a fragment that puts the rankings card first:

```tsx
  return (
    <>
      <div className="card" style={{ marginTop: 24 }}>
        <RankingsGrid report={result.data} />
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        {loadCredentials() !== null && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button className="btn-outline" onClick={reload}>
              Refresh from WCL
            </button>
          </div>
        )}
        <ReportSummary report={result.data} cachedAt={result.cachedAt} />
      </div>
    </>
  );
```

(Keep the existing `loading`/`error`/`!result` guards in `HomeSummary` unchanged above this return.)

- [ ] **Step 2: Run the full web test suite**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/web exec vitest run`
Expected: PASS (all web tests, including parseColor + RankingsGrid).

- [ ] **Step 3: Typecheck + build web**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA/apps/web" && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS — tsc clean, vite build succeeds.

- [ ] **Step 4: Commit**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA"
git add apps/web/src/pages/HomePage.tsx
git commit -m "feat(web): show RankingsGrid on Home above the summary"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run every package's tests**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm -r exec vitest run`
Expected: PASS across core / data / api / web (new tests: core +6, api +4, web +~6).

- [ ] **Step 2: Typecheck the whole monorepo**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm --filter @wcl/core exec tsc --noEmit && cd apps/api && pnpm exec tsc --noEmit && cd ../web && pnpm exec tsc --noEmit`
Expected: PASS everywhere.

- [ ] **Step 3: Manual smoke (optional, requires creds — user runs)**

The assistant never handles the WCL secret. The user seeds credentials in the browser, opens Home, pastes a report, and confirms: a "Rankings" card appears above the summary with Damage Dealers / Healers / Tanks tables, parse numbers colored on the WCL scale, and one column per boss killed. A pre-feature cached report shows the "Refresh from WCL to load parse rankings" notice until refreshed.

⚠️ This step also validates the **assumed `rankings` JSON shape**. If parses are missing or healer parses look wrong, apply the documented contingency in the spec (two-call `dps` + `hps` merge) — no interface change.

---

## Notes for the implementer

- **TDD order matters:** core → api fetch → normalize → app wiring → web. Each task is independently committable and leaves the suite green.
- **Defensive mapping:** the WCL `rankings` shape is assumed; every field access uses optional chaining + fallbacks so a shape surprise degrades gracefully (e.g. `class ?? type ?? "Unknown"`) rather than throwing.
- **`undefined` vs `[]`:** `rankings === undefined` means "report cached before this feature" → refresh notice. `rankings === []` (fetched, no ranked kills) → `buildRankingsGrid` returns null → "no ranked boss kills". Preserve this distinction.
- **Colors are a separate scale** from `sev-*`/heatmap on purpose — do not reuse the green/yellow/red classes for parse cells.
