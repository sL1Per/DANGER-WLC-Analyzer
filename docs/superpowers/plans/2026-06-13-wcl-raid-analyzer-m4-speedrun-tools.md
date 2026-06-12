# M4 — CLA Speedrun Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three remaining CLA tabs — `validate` (speedrun trash/boss/start-point requirements), `shadow resi` (per-player Shadow Resistance breakdown), and `fight timeline` (side-by-side timing comparison of two logs).

**Architecture:** Same layering as M2/M3. `packages/data` gains hand-curated reference data (per-zone speedrun rules; SR enchant/buff values) — NOT in the xlsx, so we define and Wowhead/community-verify our own, with `verified` provenance flags (M3 precedent). `apps/api` fetches enemy death events + NPC actor gameIDs and normalizes them into `ReportData.npcKills`/`firstPullNpcIds`, and surfaces combatantInfo `auras` onto each `GearSnapshot`. `packages/core` gets three pure analyses (`validate.ts`, `shadowResistance.ts`, `timeline.ts`). `apps/web` gets three tabs reusing the severity color convention; the timeline tab additionally fetches a second report through the existing `/api/report/:id` cache.

**Tech Stack:** TypeScript pnpm monorepo: Hono API, React 19 + Vite, vitest, @testing-library/react.

**Build order:** validate (Tasks 1–4) → shadow resi (Tasks 5–8) → fight timeline (Tasks 9–10). Timeline is last because its two-report fetch is the only piece stepping outside the single-report model.

**Conventions to follow (already in the codebase):**
- Severity tiers: `IssueSeverity = "major" | "moderate" | "minor"` from `packages/core/src/gearIssues.ts`; web renders `sev-major`/`sev-moderate`/`sev-minor`/`sev-ok` classes + `<SeverityLegend />`.
- Core stays dependency-free: reference data is injected via a `*Config` object; `@wcl/data` wires it in the web view.
- New `ReportData` fields are **optional** so reports cached before M4 still load; the view shows a "refresh from WCL" notice when the field is absent (see `DrumsView.tsx`).
- `itemName(report, itemId)` returns the resolved name or `item <id>`.
- Slot display order for gear-shaped tables: `LISTING_SLOTS` + `SLOT_NAMES` from `slots.ts`.

**Data caveat (applies to Tasks 1 and 5):** the speedrun rules and SR enchant/buff ids are curated by us. Every non-SW value MUST be checked against Wowhead TBC (`https://www.wowhead.com/tbc/spell=<id>` / `npc=<id>` / `item=<id>`) and current community speedrun rules during the task; mark anything you cannot confirm `verified: false` and note it in the commit message.

---

## Phase A — `validate`

### Task 1: Curated speedrun rules in `packages/data`

**Files:**
- Create: `packages/data/src/validateRules.ts`
- Modify: `packages/data/src/index.ts` (re-export)
- Modify: `packages/data/json/trash-requirements.json` → folded into the new module; delete the JSON and its import (see Step 5)
- Test: `packages/data/src/data.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append to `packages/data/src/data.test.ts`)

```ts
import { validateRules, zoneCodeByName } from "./index";

describe("speedrun validation rules", () => {
  it("covers the curated speedrun zones", () => {
    const zones = new Set(validateRules.map((r) => r.zone));
    expect(zones).toEqual(new Set(["SW", "MH", "BT", "ZA"]));
  });
  it("keeps the xlsx-verified SW rules intact", () => {
    const sw = validateRules.find((r) => r.zone === "SW")!;
    expect(sw.verified).toBe(true);
    const protector = sw.trash.find((t) => t.npcIds.includes(25507))!;
    expect(protector.minKills).toBe(5);
    const archmage = sw.trash.find((t) => t.npcIds.includes(25363))!;
    expect(archmage.minKills).toBe(65);
    expect(sw.boss).toEqual({ kind: "single", count: 6 });
  });
  it("uses the split boss rule where two zones are combined", () => {
    const splits = validateRules.filter((r) => r.boss.kind === "split");
    expect(splits.length).toBeGreaterThanOrEqual(1); // MH+BT combined run
  });
  it("flags every non-SW zone as unverified until a human checks it", () => {
    for (const r of validateRules) {
      if (r.zone !== "SW") expect(r.verified).toBe(false);
      expect(r.startingPointNpcIds.length).toBeGreaterThan(0);
      for (const t of r.trash) { expect(t.npcIds.length).toBeGreaterThan(0); expect(t.minKills).toBeGreaterThan(0); }
    }
  });
  it("maps full WCL zone names to short codes", () => {
    expect(zoneCodeByName["Sunwell Plateau"]).toBe("SW");
    expect(zoneCodeByName["Black Temple"]).toBe("BT");
    expect(zoneCodeByName["Mount Hyjal"]).toBe("MH");
    expect(zoneCodeByName["Zul'Aman"]).toBe("ZA");
  });
});
```

- [ ] **Step 2: Run it** — `pnpm --filter @wcl/data test` — expect FAIL (exports missing).

- [ ] **Step 3: Create `packages/data/src/validateRules.ts`.** Copy the SW trash rows verbatim from the current `trash-requirements.json` (already xlsx-verified). For MH/BT/ZA, fill `trash`, `boss`, and `startingPointNpcIds` from current community speedrun rules and **verify every npc id on Wowhead** (`https://www.wowhead.com/tbc/npc=<id>`); keep `verified: false`. SW boss count is 6 (Sunwell has 6 bosses). The MH+BT combined run uses the split form (`5 for MH and 9 for BT`).

```ts
/**
 * Per-zone speedrun validation rules for the CLA `validate` tab.
 * SW is copied from the xlsx sample (verified). MH/BT/ZA are curated from
 * community speedrun rules on 2026-06-13 and flagged verified:false until a
 * human cross-checks them against the rule list on WarcraftLogs.
 * Sources documented per zone below.
 */
export type BossRequirement =
  | { kind: "single"; count: number }
  | { kind: "split"; count1: number; label1: string; count2: number; label2: string };

export interface ZoneTrashRule { name: string; npcIds: number[]; minKills: number; }

export interface ZoneValidation {
  zone: string;                  // short code
  trash: ZoneTrashRule[];
  boss: BossRequirement;
  startingPointNpcIds: number[]; // npc gameIds that constitute a valid first pull
  verified: boolean;
}

export const validateRules: ZoneValidation[] = [
  {
    zone: "SW",
    verified: true, // from the xlsx validate sample
    boss: { kind: "single", count: 6 },
    startingPointNpcIds: [25507], // Sunblade Protector (first pull at the entrance)
    trash: [
      { name: "Sunblade Protector", npcIds: [25507], minKills: 5 },
      { name: "Sunblade Arch Mage/Cabalist/Dawn Priest/Dusk Priest/Slayer/Vindicator", npcIds: [25363, 25367, 25368, 25369, 25370, 25371], minKills: 65 },
      { name: "Sunblade Scout", npcIds: [25372], minKills: 4 },
      { name: "Shadowsword Commander/Lifeshaper/Manafiend/Soulbinder/Vanquisher", npcIds: [25373, 25483, 25486, 25506, 25837], minKills: 26 },
      { name: "Doomfire Destroyer", npcIds: [25592], minKills: 1 },
      { name: "Oblivion Mage/Painbringer/Priestess of Torment", npcIds: [25509, 25591, 25597], minKills: 6 },
      { name: "Apocalypse Guard", npcIds: [25593], minKills: 4 },
      { name: "Cataclysm Hound", npcIds: [25599], minKills: 2 },
      { name: "Shadowsword Guardian", npcIds: [25508], minKills: 2 },
    ],
  },
  // MH — Mount Hyjal. Source: community speedrun ruleset, curated 2026-06-13.
  {
    zone: "MH",
    verified: false,
    boss: { kind: "single", count: 5 },
    startingPointNpcIds: [/* fill: Wave/Winterchill approach trash npc ids */],
    trash: [/* fill: curated MH trash requirements (npc ids + minKills) */],
  },
  // BT — Black Temple. Combined MH+BT speedruns use the split boss rule.
  {
    zone: "BT",
    verified: false,
    boss: { kind: "split", count1: 5, label1: "MH", count2: 9, label2: "BT" },
    startingPointNpcIds: [/* fill */],
    trash: [/* fill: curated BT trash requirements */],
  },
  // ZA — Zul'Aman.
  {
    zone: "ZA",
    verified: false,
    boss: { kind: "single", count: 6 },
    startingPointNpcIds: [/* fill */],
    trash: [/* fill: curated ZA trash requirements */],
  },
];

/** Full WCL zone name → short code used in `validateRules`. */
export const zoneCodeByName: Record<string, string> = {
  "Karazhan": "Kara",
  "Serpentshrine Cavern": "SSC",
  "Tempest Keep": "TK",
  "Mount Hyjal": "MH",
  "Black Temple": "BT",
  "Zul'Aman": "ZA",
  "Sunwell Plateau": "SW",
};
```

> **Implementer note:** the `/* fill */` blocks are mandatory research, not optional — populate every one with real, Wowhead-checked npc ids and community-rule minKills before moving on. The test in Step 1 asserts each non-SW zone has ≥1 trash rule with ≥1 npc id, so empty arrays fail. If a zone's rules genuinely cannot be confirmed, reduce the `zones` set assertion in Step 1 to the zones you did curate and record the omission in the commit message — do NOT ship placeholder ids.

- [ ] **Step 4: Re-export from `packages/data/src/index.ts`** — add at the bottom:

```ts
export * from "./validateRules";
```

- [ ] **Step 5: Remove the superseded JSON and its old test.** Delete `packages/data/json/trash-requirements.json`; remove its import + the `trashRequirements`/`TrashRequirement` exports from `packages/data/src/index.ts`; and in `packages/data/src/data.test.ts` drop `trashRequirements` from the top-level import (line 2) and delete the assertion that used it (`expect(trashRequirements.find((t) => t.name === "Sunblade Scout")?.minKills).toBe(4);` — the new `validateRules` test in Step 1 already covers SW). Then grep to confirm nothing else references them:

Run: `grep -rn "trashRequirements\|TrashRequirement\|trash-requirements" packages apps --include=*.ts | grep -v node_modules`
Expected: no matches (the new `validateRules.ts` doesn't use those names).

- [ ] **Step 6: Run tests** — `pnpm --filter @wcl/data test` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/data/src/validateRules.ts packages/data/src/index.ts packages/data/src/data.test.ts packages/data/json/trash-requirements.json
git commit -m "feat(data): curated per-zone speedrun validation rules"
```

---

### Task 2: `ReportData.npcKills` + `firstPullNpcIds` fields and core `validate()`

**Files:**
- Modify: `packages/core/src/types.ts` (add two optional fields)
- Create: `packages/core/src/validate.ts`
- Modify: `packages/core/src/index.ts` (export)
- Test: `packages/core/src/validate.test.ts`

> The shared `report.fixture.ts` is **not** modified — the test spreads the fixture and adds `npcKills`/`firstPullNpcIds` inline, so existing M0–M3 tests stay untouched. The fixture already has 2 boss kills (Hydross fight 3 + Lurker fight 5), which the boss-count assertion relies on.

- [ ] **Step 1: Add the optional fields to `ReportData`** in `packages/core/src/types.ts` (after `drumApplications?`):

```ts
  /** enemy gameId → total kills across the report (M4+); undefined = report cached before M4 */
  npcKills?: Record<string, number>;
  /** enemy gameIds that died in the chronologically first fight (for the valid-start check) */
  firstPullNpcIds?: number[];
```

- [ ] **Step 2: Write the failing test** — create `packages/core/src/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validate, type ValidateConfig } from "./validate";
import { reportFixture } from "./fixtures/report.fixture";
import type { ReportData } from "./types";

const cfg: ValidateConfig = {
  zoneCodeByName: { "Serpentshrine Cavern": "SSC" },
  rules: [{
    zone: "SSC",
    verified: false,
    boss: { kind: "single", count: 2 },
    startingPointNpcIds: [21508], // Underbog Colossus (first fixture pull)
    trash: [
      { name: "Underbog Colossus", npcIds: [21508], minKills: 1 },
      { name: "Coilfang Shatterer", npcIds: [99999], minKills: 3 }, // not enough
    ],
  }],
};

function report(): ReportData {
  return structuredClone({
    ...reportFixture,
    npcKills: { "21508": 1, "99999": 1 },
    firstPullNpcIds: [21508],
  });
}

describe("validate", () => {
  it("counts kills per trash requirement and flags shortfalls", () => {
    const r = validate(report(), cfg);
    expect(r.zone).toBe("SSC");
    const colossus = r.trash.find((t) => t.name.startsWith("Underbog"))!;
    expect(colossus.killed).toBe(1);
    expect(colossus.enough).toBe(true);
    expect(colossus.severity).toBe("minor");
    const shatterer = r.trash.find((t) => t.name.startsWith("Coilfang"))!;
    expect(shatterer.killed).toBe(1);
    expect(shatterer.enough).toBe(false);
    expect(shatterer.severity).toBe("major");
  });
  it("counts boss kills and the valid starting point, then the overall verdict", () => {
    const r = validate(report(), cfg);
    expect(r.bosses.killed).toBe(2); // fixture has 2 boss kills (Hydross kill + Lurker)
    expect(r.bosses.enough).toBe(true);
    expect(r.validStartingPoint).toBe(true);
    expect(r.totalCharacters).toBe(2);
    expect(r.isValid).toBe(false); // shatterer requirement unmet
  });
  it("renders the split boss requirement text", () => {
    const split: ValidateConfig = { ...cfg, rules: [{ ...cfg.rules[0]!, boss: { kind: "split", count1: 5, label1: "MH", count2: 9, label2: "BT" } }] };
    expect(validate(report(), split).bosses.required).toBe("5 for MH and 9 for BT");
  });
  it("honours a manual zone override", () => {
    const r = validate(report(), cfg, { zoneOverride: "SSC" });
    expect(r.zone).toBe("SSC");
    expect(r.unsupportedZone).toBe(false);
  });
  it("reports unsupported zones gracefully", () => {
    const r = validate({ ...report(), zoneName: "Naxxramas" }, cfg);
    expect(r.unsupportedZone).toBe(true);
    expect(r.isValid).toBe(false);
  });
  it("returns null when the report predates M4 (no npc kill data)", () => {
    const r = structuredClone(reportFixture); // no npcKills
    expect(validate(r, cfg)).toBeNull();
  });
});
```

- [ ] **Step 3: Run it** — `pnpm --filter @wcl/core test validate` — expect FAIL (module missing).

- [ ] **Step 4: Create `packages/core/src/validate.ts`:**

```ts
import type { ReportData } from "./types";
import type { IssueSeverity } from "./gearIssues";

export type BossRequirement =
  | { kind: "single"; count: number }
  | { kind: "split"; count1: number; label1: string; count2: number; label2: string };

export interface ZoneValidation {
  zone: string;
  trash: { name: string; npcIds: number[]; minKills: number }[];
  boss: BossRequirement;
  startingPointNpcIds: number[];
  verified: boolean;
}

export interface ValidateConfig {
  rules: ZoneValidation[];
  /** full WCL zone name → short code used in `rules` */
  zoneCodeByName: Record<string, string>;
}

export interface ValidateTrashRow {
  name: string; minKills: number; killed: number; enough: boolean; severity: IssueSeverity;
}
export interface ValidateResult {
  zone: string;
  zoneVerified: boolean;
  unsupportedZone: boolean;
  trash: ValidateTrashRow[];
  bosses: { required: string; killed: number; enough: boolean; severity: IssueSeverity };
  validStartingPoint: boolean;
  totalCharacters: number;
  isValid: boolean;
}

const sev = (ok: boolean): IssueSeverity => (ok ? "minor" : "major");

/**
 * CLA `validate`: check a report against per-zone speedrun requirements.
 * Whole-report (a speedrun log is validated end to end, like the original).
 * Returns null when the report predates M4 (no kill data) so the view can show
 * a refresh notice instead of all-zero rows.
 */
export function validate(
  report: ReportData,
  cfg: ValidateConfig,
  opts?: { zoneOverride?: string },
): ValidateResult | null {
  if (report.npcKills === undefined) return null;

  const zone = opts?.zoneOverride ?? cfg.zoneCodeByName[report.zoneName] ?? report.zoneName;
  const rule = cfg.rules.find((r) => r.zone === zone);
  const totalCharacters = report.players.length;

  if (!rule) {
    return {
      zone, zoneVerified: false, unsupportedZone: true,
      trash: [], bosses: { required: "?", killed: 0, enough: false, severity: "major" },
      validStartingPoint: false, totalCharacters, isValid: false,
    };
  }

  const kills = report.npcKills;
  const trash: ValidateTrashRow[] = rule.trash.map((t) => {
    const killed = t.npcIds.reduce((sum, id) => sum + (kills[String(id)] ?? 0), 0);
    const enough = killed >= t.minKills;
    return { name: t.name, minKills: t.minKills, killed, enough, severity: sev(enough) };
  });

  const bossKills = report.fights.filter((f) => f.isBoss && f.kill === true).length;
  let bosses: ValidateResult["bosses"];
  if (rule.boss.kind === "single") {
    const enough = bossKills >= rule.boss.count;
    bosses = { required: String(rule.boss.count), killed: bossKills, enough, severity: sev(enough) };
  } else {
    const need = rule.boss.count1 + rule.boss.count2;
    const enough = bossKills >= need;
    bosses = {
      required: `${rule.boss.count1} for ${rule.boss.label1} and ${rule.boss.count2} for ${rule.boss.label2}`,
      killed: bossKills, enough, severity: sev(enough),
    };
  }

  const firstPull = report.firstPullNpcIds ?? [];
  const validStartingPoint = firstPull.some((id) => rule.startingPointNpcIds.includes(id));

  const isValid = trash.every((t) => t.enough) && bosses.enough && validStartingPoint;
  return {
    zone, zoneVerified: rule.verified, unsupportedZone: false,
    trash, bosses, validStartingPoint, totalCharacters, isValid,
  };
}
```

- [ ] **Step 5: Export from `packages/core/src/index.ts`** — add after the `gearIssues` export line:

```ts
export * from "./validate";
```

- [ ] **Step 6: Run tests** — `pnpm --filter @wcl/core test` — Expected: PASS (validate green; the two new optional fields don't touch other analyses, so existing suites stay green).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/validate.ts packages/core/src/index.ts packages/core/src/validate.test.ts
git commit -m "feat(core): validate analysis + npcKills/firstPullNpcIds report fields"
```

---

### Task 3: API fetches enemy deaths + NPC gameIds, normalizes `npcKills`

**Files:**
- Modify: `apps/api/src/wcl.ts` (NPC actors in report query; `fetchDeaths`)
- Modify: `apps/api/src/normalize.ts` (build `npcKills` + `firstPullNpcIds`)
- Modify: `apps/api/src/app.ts` (wire `fetchDeaths` into deps + parallel fetch)
- Test: `apps/api/src/normalize.test.ts` (append) and `apps/api/src/app.test.ts` (extend the mock deps)

- [ ] **Step 1: Probe the real WCL shape first.** With `WCL_CLIENT_ID`/`WCL_CLIENT_SECRET` set, run the probe against a known speedrun report to confirm Deaths events expose `targetID` and that NPC actors expose `gameID`:

Run: `pnpm --filter @wcl/api probe <speedrunReportCode>`
Expected: death events carry `targetID` + `fight`; `masterData` NPC actors carry `id` + `gameID`. If the field names differ, adjust the query/normalize below to match what the probe prints (note any change in the commit message).

- [ ] **Step 2: Extend the report query for NPC gameIds** in `apps/api/src/wcl.ts`. Change the `masterData` selection inside `REPORT_QUERY`:

```graphql
      masterData {
        actors(type: "Player") { id name subType }
        npcs: actors(type: "NPC") { id gameID }
      }
```

and extend the `RawReport` interface's `masterData` type:

```ts
  masterData: {
    actors: { id: number; name: string; subType: string }[];
    npcs: { id: number; gameID: number }[];
  } | null;
```

- [ ] **Step 3: Add `fetchDeaths`** to `apps/api/src/wcl.ts` (after `fetchCastEvents`):

```ts
export interface RawDeathEvent { timestamp: number; type: string; targetID: number; fight: number; }

/** All enemy/player death events (whole report). targetID maps to a masterData actor. */
export async function fetchDeaths(code: string, accessToken: string): Promise<RawDeathEvent[]> {
  const out: RawDeathEvent[] = [];
  let start = 0;
  for (;;) {
    const data = await gql<{ reportData: { report: { events: { data: Record<string, unknown>[]; nextPageTimestamp: number | null } } } }>(
      EVENTS_QUERY, { code, dataType: "Deaths", filter: null, start }, accessToken);
    const page = data.reportData.report.events;
    for (const e of page.data) if (e.type === "death") out.push(e as unknown as RawDeathEvent);
    if (page.nextPageTimestamp == null || page.nextPageTimestamp <= start) break;
    start = page.nextPageTimestamp;
  }
  return out;
}
```

> `EVENTS_QUERY` already declares `$filter: String` (nullable), so passing `filter: null` is valid — no query change needed.

- [ ] **Step 4: Write the failing normalize test** (append to `apps/api/src/normalize.test.ts`). Mirror the existing tests' style (they call `normalizeReport(id, raw, combatants, itemMeta, events)`):

```ts
describe("normalizeReport — npc kills (validate)", () => {
  const raw = {
    title: "SW run", startTime: 0, endTime: 1000, zone: { name: "Sunwell Plateau" },
    fights: [
      { id: 1, name: "Sunblade Protector", encounterID: 0, kill: null, startTime: 0, endTime: 100, friendlyPlayers: [10] },
      { id: 2, name: "Kalecgos", encounterID: 724, kill: true, startTime: 200, endTime: 300, friendlyPlayers: [10] },
    ],
    masterData: {
      actors: [{ id: 10, name: "Tank", subType: "Warrior" }],
      npcs: [{ id: 50, gameID: 25507 }, { id: 51, gameID: 25363 }],
    },
  };
  it("counts deaths per gameId and records the first pull's npcs", () => {
    const data = normalizeReport("c", raw as never, [], {}, {
      deaths: [
        { timestamp: 40, type: "death", targetID: 50, fight: 1 },
        { timestamp: 60, type: "death", targetID: 50, fight: 1 },
        { timestamp: 80, type: "death", targetID: 51, fight: 1 },
        { timestamp: 250, type: "death", targetID: 10, fight: 2 }, // a player death — ignored
      ],
    });
    expect(data.npcKills).toEqual({ "25507": 2, "25363": 1 });
    expect(data.firstPullNpcIds).toEqual(expect.arrayContaining([25507, 25363]));
  });
  it("leaves npc fields undefined when no death data is supplied", () => {
    const data = normalizeReport("c", raw as never, [], {}, {});
    expect(data.npcKills).toBeUndefined();
    expect(data.firstPullNpcIds).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run it** — `pnpm --filter @wcl/api test normalize` — expect FAIL (`deaths` not handled; fields undefined).

- [ ] **Step 6: Implement in `apps/api/src/normalize.ts`.** Add `deaths` to the inputs interface, import the type, and build the fields. Add to `NormalizeEventInputs`:

```ts
  /** enemy/player death events; enemy deaths become npcKills */
  deaths?: RawDeathEvent[];
```

Import `RawDeathEvent` in the existing `import { ... } from "./wcl"` block. Then add a helper and call it inside the returned object:

```ts
function buildNpcKills(
  deaths: RawDeathEvent[],
  npcs: { id: number; gameID: number }[],
  fights: Fight[],
): { npcKills: Record<string, number>; firstPullNpcIds: number[] } {
  const gameIdByActor = new Map(npcs.map((n) => [n.id, n.gameID]));
  const npcKills: Record<string, number> = {};
  const firstFightId = fights.length === 0 ? undefined
    : fights.reduce((a, b) => (b.startTime < a.startTime ? b : a)).id;
  const firstPull = new Set<number>();
  for (const d of deaths) {
    const gameId = gameIdByActor.get(d.targetID);
    if (gameId === undefined) continue; // not an NPC (e.g. a player death)
    npcKills[String(gameId)] = (npcKills[String(gameId)] ?? 0) + 1;
    if (d.fight === firstFightId) firstPull.add(gameId);
  }
  return { npcKills, firstPullNpcIds: [...firstPull] };
}
```

In the returned object, conditionally spread the npc fields (only when `events.deaths` was provided, so pre-M4 cache stays undefined):

```ts
    ...(events.deaths
      ? buildNpcKills(events.deaths, raw.masterData!.npcs ?? [], fights)
      : {}),
```

Place that spread alongside the other fields (e.g. after `drumApplications`). `raw.masterData` is already null-checked earlier in the function.

- [ ] **Step 7: Run it** — `pnpm --filter @wcl/api test normalize` — Expected: PASS.

- [ ] **Step 8: Wire `fetchDeaths` into `app.ts`.** Add to the import block from `./wcl`:

```ts
  fetchDeaths as realFetchDeaths,
  type RawDeathEvent,
```

Add to `AppDeps`:

```ts
  fetchDeaths: typeof realFetchDeaths;
```

Add to the default `createApp` deps object:

```ts
  fetchDeaths: realFetchDeaths,
```

In the parallel fetch block, add deaths as a fourth best-effort fetch and pass it to `normalizeReport`:

```ts
      let deaths: RawDeathEvent[] = [];
      // ... inside the Promise.allSettled array, add as a 4th element:
        const [combatantsR, buffR, castR, deathR] = await Promise.allSettled([
          bossFightIds.length > 0 ? deps.fetchCombatantInfo(id, token, bossFightIds) : none,
          bossFightIds.length > 0 ? deps.fetchBuffEvents(id, token, TRACKED_BUFF_IDS) : none,
          deps.fetchCastEvents(id, token, DRUM_CAST_IDS),
          deps.fetchDeaths(id, token),
        ]);
        // ... after the existing assignments:
        if (deathR.status === "fulfilled") deaths = deathR.value as RawDeathEvent[];
```

And add `deaths` to the `normalizeReport(... , { ... })` events object:

```ts
        buffEvents, castEvents, deaths,
        trackedBuffIds: TRACKED_BUFF_IDS, drumBuffIds: DRUM_BUFF_IDS,
```

- [ ] **Step 9: Update `app.test.ts` mock deps.** Find where the test builds the `createApp({...})` deps (search `fetchCastEvents:` in `apps/api/src/app.test.ts`) and add a sibling stub plus an assertion that npcKills lands in the response:

```ts
      fetchDeaths: async () => [
        { timestamp: 40, type: "death", targetID: 50, fight: 1 },
      ],
```

If the mock `fetchRawReport` in that test returns a `masterData` without `npcs`, add `npcs: [{ id: 50, gameID: 25507 }]` to it (and an enemy fight if needed) so the stubbed death maps. Then in the success-path assertion add:

```ts
    expect(body.data.npcKills).toEqual({ "25507": 1 });
```

- [ ] **Step 10: Run all api tests** — `pnpm --filter @wcl/api test` — Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/wcl.ts apps/api/src/normalize.ts apps/api/src/app.ts apps/api/src/normalize.test.ts apps/api/src/app.test.ts
git commit -m "feat(api): fetch enemy deaths + npc gameIds into npcKills"
```

---

### Task 4: `validate` web tab

**Files:**
- Create: `apps/web/src/components/ValidateView.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx` (add tab)
- Test: `apps/web/src/components/ValidateView.test.tsx`

- [ ] **Step 1: Write the failing test** — create `apps/web/src/components/ValidateView.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { reportFixture, type ReportData } from "@wcl/core";
import { ValidateView } from "./ValidateView";

afterEach(cleanup);

function report(): ReportData {
  // fixture zone is SSC, which has no curated rules → unsupported-zone path
  return structuredClone({ ...reportFixture, npcKills: { "21508": 1 }, firstPullNpcIds: [21508] });
}

describe("ValidateView", () => {
  it("shows a refresh notice for reports cached before M4", () => {
    const r = structuredClone(reportFixture); // no npcKills
    render(<ValidateView report={r} />);
    expect(screen.getByText(/cached before/i)).toBeTruthy();
  });
  it("shows an unsupported-zone message when no rules match", () => {
    render(<ValidateView report={report()} />);
    expect(screen.getByText(/no speedrun rules/i)).toBeTruthy();
  });
  it("renders trash rows and the verdict for a supported zone (SW, verified)", () => {
    const r = structuredClone({
      ...reportFixture, zoneName: "Sunwell Plateau",
      npcKills: { "25507": 5, "25363": 70, "25372": 4, "25373": 26, "25592": 1, "25509": 6, "25593": 4, "25599": 2, "25508": 2 },
      firstPullNpcIds: [25507],
    });
    render(<ValidateView report={r} />);
    expect(screen.getByText("Sunblade Protector")).toBeTruthy();
    // SW is verified:true, so NO unverified badge shows
    expect(screen.queryByText(/unverified speedrun rules/i)).toBeNull();
  });
  it("badges unverified zones (override to a verified:false zone)", () => {
    // any non-SW curated zone is verified:false; override to it and assert the badge.
    // The fixture needs npc data so validate() doesn't return the pre-M4 null.
    const verifiedFalseZone = "MH"; // adjust to a zone you curated in Task 1
    const r = structuredClone({ ...reportFixture, npcKills: {}, firstPullNpcIds: [] });
    render(<ValidateView report={r} />);
    // switch the zone selector to the unverified zone
    fireEvent.change(screen.getByRole("combobox"), { target: { value: verifiedFalseZone } });
    expect(screen.getByText(/unverified speedrun rules/i)).toBeTruthy();
  });
});
```

> The second test imports `fireEvent` — add it to the `@testing-library/react` import. If you curated a different first non-SW zone in Task 1, set `verifiedFalseZone` to that code.

- [ ] **Step 2: Run it** — `pnpm --filter @wcl/web test ValidateView` — expect FAIL (component missing).

- [ ] **Step 3: Create `apps/web/src/components/ValidateView.tsx`:**

```tsx
import { useMemo, useState } from "react";
import { validate, type ReportData } from "@wcl/core";
import { validateRules, zoneCodeByName } from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";

const ZONE_CODES = validateRules.map((r) => r.zone);

export function ValidateView({ report }: { report: ReportData }) {
  const [override, setOverride] = useState<string | undefined>(undefined);
  const result = useMemo(
    () => validate(report, { rules: validateRules, zoneCodeByName }, { zoneOverride: override }),
    [report, override],
  );

  if (result === null) {
    return <p>This report was cached before speedrun validation — refresh it from WCL (requires credentials).</p>;
  }

  return (
    <div>
      <p>
        <label>
          zone:{" "}
          <select value={result.zone} onChange={(e) => setOverride(e.target.value)}>
            {!ZONE_CODES.includes(result.zone) && <option value={result.zone}>{result.zone} (auto)</option>}
            {ZONE_CODES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        {!result.zoneVerified && !result.unsupportedZone && (
          <span className="sev-moderate"> unverified speedrun rules — cross-check against WCL</span>
        )}
      </p>

      {result.unsupportedZone ? (
        <p className="sev-moderate">No speedrun rules are configured for “{result.zone}”. Pick a zone manually above.</p>
      ) : (
        <>
          <SeverityLegend />
          <table>
            <thead>
              <tr><th>name</th><th>minimum to kill</th><th>how many killed?</th><th>killed enough?</th></tr>
            </thead>
            <tbody>
              {result.trash.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td>{t.minKills}</td>
                  <td>{t.killed}</td>
                  <td className={t.severity === "minor" ? "sev-ok" : "sev-major"}>{t.enough ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="validate-summary">
            <li className={result.bosses.enough ? "sev-ok" : "sev-major"}>
              bosses killed ({result.bosses.required} necessary): {result.bosses.killed}
            </li>
            <li className={result.validStartingPoint ? "sev-ok" : "sev-major"}>
              contains a valid starting point: {result.validStartingPoint ? "yes" : "no"}
            </li>
            <li>total characters used: {result.totalCharacters}</li>
            <li className={result.isValid ? "sev-ok" : "sev-major"}>
              <strong>is the log valid (trash + boss requirements met): {result.isValid ? "yes" : "no"}</strong>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it** — `pnpm --filter @wcl/web test ValidateView` — Expected: PASS.

- [ ] **Step 5: Wire the tab into `ReportPage.tsx`.** Add the import:

```tsx
import { ValidateView } from "../components/ValidateView";
```

Add `"validate"` to the `tab` union type, to the `(["summary", ...] as const)` nav array, and render it:

```tsx
      {tab === "validate" && <ValidateView key={result.data.reportId} report={result.data} />}
```

- [ ] **Step 6: Run all web tests** — `pnpm --filter @wcl/web test` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ValidateView.tsx apps/web/src/components/ValidateView.test.tsx apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): validate tab"
```

---

## Phase B — `shadow resi`

### Task 5: Curated SR enchant/buff data + soft target in `packages/data`

**Files:**
- Create: `packages/data/src/shadowResistance.ts`
- Modify: `packages/data/src/index.ts` (re-export)
- Test: `packages/data/src/data.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append to `packages/data/src/data.test.ts`):

```ts
import { shadowResEnchants, shadowResBuffs, SR_SOFT_TARGET } from "./index";

describe("shadow resistance reference data", () => {
  it("maps SR permanent enchants to their values", () => {
    expect(Object.keys(shadowResEnchants).length).toBeGreaterThan(0);
    for (const v of Object.values(shadowResEnchants)) expect(v).toBeGreaterThan(0);
  });
  it("maps SR buff auras to their values (Shadow Protection ≈ 70)", () => {
    expect(Object.values(shadowResBuffs)).toContain(70);
  });
  it("exposes an advisory soft target", () => {
    expect(SR_SOFT_TARGET).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it** — `pnpm --filter @wcl/data test` — expect FAIL.

- [ ] **Step 3: Create `packages/data/src/shadowResistance.ts`.** **Verify every id on Wowhead** (`https://www.wowhead.com/tbc/spell=<id>` for enchants/buffs). The cloak Greater Shadow Resistance enchant is +15; Shadow Protection (priest) is +70 at max rank; Shadow Resistance Aura (paladin) +70; the Shadow Protection Potion +60. Map each rank id you include.

```ts
/**
 * Shadow Resistance from permanent enchants and from buff auras, for the
 * `shadow resi` tab. NOT in the xlsx (the original kept these in Apps Script).
 * Item innate SR lives in json/item-shadow-res.json. Every id below verified
 * against wowhead.com/tbc on 2026-06-13.
 */

/** permanent-enchant spell/enchant id → Shadow Resistance granted. */
export const shadowResEnchants: Record<string, number> = {
  // e.g. "2664": 15, // Enchant Cloak - Greater Shadow Resistance (+15)
  // fill: verified SR enchant ids (cloak/chest/etc.) with their SR values
};

/** buff aura spell id → Shadow Resistance granted (use the per-rank ids). */
export const shadowResBuffs: Record<string, number> = {
  // e.g. "25433": 70, // Shadow Protection (max rank)
  // e.g. "27683": 70, // Prayer of Shadow Protection
  // fill: verified SR buff ids (priest Shadow Protection ranks, paladin
  // Shadow Resistance Aura, Shadow Protection Potion) with their SR values
};

/**
 * Advisory soft target for colouring a player's TOTAL SR. NOT an official
 * threshold — Shahraz/Kaz'rogal/Azgalor have no hard SR gate; this is guidance.
 */
export const SR_SOFT_TARGET = 100;
```

> **Implementer note:** the enchant/buff maps must be non-empty and value-checked (the Step 1 test asserts ≥1 enchant and that a buff value of 70 exists). Populate the real ids — do not ship the comment-only stubs.

- [ ] **Step 4: Re-export from `packages/data/src/index.ts`** — add:

```ts
export * from "./shadowResistance";
```

- [ ] **Step 5: Run tests** — `pnpm --filter @wcl/data test` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/data/src/shadowResistance.ts packages/data/src/index.ts packages/data/src/data.test.ts
git commit -m "feat(data): SR enchant/buff values + advisory soft target"
```

---

### Task 6: `GearSnapshot.auras` field + core `shadowResistance()`

**Files:**
- Modify: `packages/core/src/types.ts` (add `auras?` to `GearSnapshot`)
- Create: `packages/core/src/shadowResistance.ts`
- Modify: `packages/core/src/index.ts` (export)
- Test: `packages/core/src/shadowResistance.test.ts`

> The shared `report.fixture.ts` is **not** modified — the test builds a small self-contained report with a Mother Shahraz fight, so existing M0–M3 tests (gearIssues/consumables key off the fixture) stay untouched.

- [ ] **Step 1: Add `auras?` to `GearSnapshot`** in `packages/core/src/types.ts`:

```ts
export interface GearSnapshot {
  fightId: number;
  playerId: number;
  items: GearItem[];
  /** spell ids active at boss pull (combatantInfo auras); used for SR-from-buffs */
  auras?: number[];
}
```

- [ ] **Step 2: Write the failing test** — create `packages/core/src/shadowResistance.test.ts` with a self-contained report (item 34204 = Pendant of Shadow's End, cloak enchant 2664 = +15, Shadow Protection aura 25433 = +70):

```ts
import { describe, expect, it } from "vitest";
import { shadowResistance, type ShadowResConfig } from "./shadowResistance";
import type { ReportData } from "./types";

const cfg: ShadowResConfig = {
  itemShadowRes: { "34204": 30 },   // Pendant of Shadow's End
  enchantShadowRes: { "2664": 15 }, // cloak +15 SR
  buffShadowRes: { "25433": 70 },   // Shadow Protection
  softTarget: 100,
};

function report(fights: ReportData["fights"]): ReportData {
  return {
    reportId: "sr", title: "BT", zoneName: "Black Temple",
    startTime: 0, endTime: 1_000_000,
    fights,
    players: [{ id: 2, name: "Playertwo", class: "Priest" }],
    gear: [{
      fightId: 60, playerId: 2, auras: [25433],
      items: [
        { slot: 1, itemId: 34204, gemIds: [] },                            // neck: ~30 innate
        { slot: 14, itemId: 30000, gemIds: [], permanentEnchantId: 2664 }, // cloak: +15 enchant
      ],
    }],
    itemMeta: { "34204": { name: "Pendant of Shadow's End" } },
  };
}
const KILL = { id: 60, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: true, startTime: 400_000, endTime: 560_000 };

describe("shadowResistance", () => {
  it("sums SR from gear (items + enchants) and from buffs on the kill fight", () => {
    const r = shadowResistance(report([KILL]), cfg, { boss: "Mother Shahraz" })!;
    expect(r.boss).toBe("Mother Shahraz");
    expect(r.isKill).toBe(true);
    const p = r.players.find((x) => x.name === "Playertwo")!;
    expect(p.fromGear).toBe(45);  // 30 innate + 15 enchant
    expect(p.fromBuffs).toBe(70); // Shadow Protection
    expect(p.total).toBe(115);
    expect(p.slots[1]).toMatch(/~30 SR/);   // neck innate
    expect(p.slots[14]).toMatch(/\+15 SR/); // cloak enchant
    expect(p.severity).toBe("minor"); // 115 ≥ 100 soft target → ok/green
  });
  it("returns null when the report has none of the SR bosses", () => {
    const noBoss = report([{ id: 1, name: "Najentus", encounterId: 601, isBoss: true, kill: true, startTime: 0, endTime: 100 }]);
    expect(shadowResistance(noBoss, cfg)).toBeNull();
  });
});
```

- [ ] **Step 3: Run it** — `pnpm --filter @wcl/core test shadowResistance` — expect FAIL.

- [ ] **Step 4: Create `packages/core/src/shadowResistance.ts`:**

```ts
import type { ReportData } from "./types";
import { itemName } from "./itemName";
import type { IssueSeverity } from "./gearIssues";

export const SR_BOSSES = ["Mother Shahraz", "Kaz'rogal", "Azgalor"] as const;
export type SrBoss = (typeof SR_BOSSES)[number];

export interface ShadowResConfig {
  itemShadowRes: Record<string, number>;
  enchantShadowRes: Record<string, number>;
  buffShadowRes: Record<string, number>;
  /** advisory soft target for colouring total SR (not an official threshold) */
  softTarget: number;
}

export interface ShadowResPlayer {
  playerId: number; name: string;
  total: number; fromGear: number; fromBuffs: number;
  /** slot id → contribution text, e.g. "Pendant of Shadow's End (~30 SR) +15 SR" */
  slots: Record<number, string>;
  severity: IssueSeverity;
}
export interface ShadowResResult {
  boss: string; fightId: number; isKill: boolean;
  /** SR bosses actually present in the report, for the view's selector */
  availableBosses: SrBoss[];
  players: ShadowResPlayer[];
}

function srSeverity(total: number, softTarget: number): IssueSeverity {
  if (total >= softTarget) return "minor";        // green / ok
  if (total >= softTarget * 0.6) return "moderate"; // yellow
  return "major";                                  // red
}

/**
 * CLA `shadow resi`: per-player Shadow Resistance for Shahraz/Kaz'rogal/Azgalor.
 * Analyzes the kill, else the longest wipe of the chosen boss. SR-from-buffs is
 * read from combatantInfo pull auras (no extra event fetch). Returns null when
 * none of the three SR bosses are in the report.
 */
export function shadowResistance(
  report: ReportData,
  cfg: ShadowResConfig,
  opts?: { boss?: SrBoss },
): ShadowResResult | null {
  const availableBosses = SR_BOSSES.filter((b) => report.fights.some((f) => f.isBoss && f.name === b));
  const boss = opts?.boss && availableBosses.includes(opts.boss) ? opts.boss : availableBosses[0];
  if (!boss) return null;

  const bossFights = report.fights.filter((f) => f.isBoss && f.name === boss);
  const kill = bossFights.find((f) => f.kill === true);
  const fight = kill ?? bossFights.reduce((a, b) => (b.endTime - b.startTime > a.endTime - a.startTime ? b : a));

  const playerById = new Map(report.players.map((p) => [p.id, p]));
  const players: ShadowResPlayer[] = [];
  for (const snap of report.gear.filter((g) => g.fightId === fight.id)) {
    const player = playerById.get(snap.playerId);
    if (!player) continue;

    let fromGear = 0;
    const slots: Record<number, string> = {};
    for (const item of snap.items) {
      const innate = cfg.itemShadowRes[String(item.itemId)] ?? 0;
      const ench = item.permanentEnchantId ? (cfg.enchantShadowRes[String(item.permanentEnchantId)] ?? 0) : 0;
      if (innate === 0 && ench === 0) continue;
      fromGear += innate + ench;
      const parts: string[] = [];
      if (innate > 0) parts.push(`${itemName(report, item.itemId)} (~${innate} SR)`);
      if (ench > 0) parts.push(`+${ench} SR`);
      slots[item.slot] = parts.join(" ");
    }

    // distinct auras only (combatantInfo lists each aura once); sum their SR
    let fromBuffs = 0;
    for (const spellId of snap.auras ?? []) fromBuffs += cfg.buffShadowRes[String(spellId)] ?? 0;

    const total = fromGear + fromBuffs;
    players.push({ playerId: player.id, name: player.name, total, fromGear, fromBuffs, slots, severity: srSeverity(total, cfg.softTarget) });
  }
  players.sort((a, b) => a.name.localeCompare(b.name));
  return { boss, fightId: fight.id, isKill: kill !== undefined, availableBosses, players };
}
```

- [ ] **Step 5: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./shadowResistance";
```

- [ ] **Step 6: Run tests** — `pnpm --filter @wcl/core test` — Expected: PASS (the new optional `auras?` field on `GearSnapshot` doesn't affect existing analyses; the SR test is self-contained, so the full suite stays green).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/shadowResistance.ts packages/core/src/index.ts packages/core/src/shadowResistance.test.ts
git commit -m "feat(core): shadow resistance analysis + GearSnapshot.auras"
```

---

### Task 7: API surfaces combatantInfo auras onto `GearSnapshot`

**Files:**
- Modify: `apps/api/src/normalize.ts` (add `auras` to the mapped gear)
- Test: `apps/api/src/normalize.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append to `apps/api/src/normalize.test.ts`). The combatant shape already carries `auras` (used for buff seeding); assert it now also lands on the snapshot:

```ts
describe("normalizeReport — gear auras (shadow resi)", () => {
  const raw = {
    title: "BT", startTime: 0, endTime: 1000, zone: { name: "Black Temple" },
    fights: [{ id: 1, name: "Mother Shahraz", encounterID: 602, kill: true, startTime: 0, endTime: 100, friendlyPlayers: [10] }],
    masterData: { actors: [{ id: 10, name: "Heal", subType: "Priest" }], npcs: [] },
  };
  it("copies combatantInfo aura ids onto the gear snapshot", () => {
    const data = normalizeReport("c", raw as never, [
      { sourceID: 10, fight: 1, gear: [{ id: 34204 }], auras: [{ source: 10, ability: 25433 }] },
    ], {});
    expect(data.gear[0]!.auras).toEqual([25433]);
  });
});
```

- [ ] **Step 2: Run it** — `pnpm --filter @wcl/api test normalize` — expect FAIL (`auras` undefined on snapshot).

- [ ] **Step 3: Implement** in `apps/api/src/normalize.ts` — in the `gear: combatants.map((c) => ({ ... }))` block, add an `auras` field next to `items`:

```ts
      auras: (c.auras ?? []).map((a) => a.ability),
```

- [ ] **Step 4: Run it** — `pnpm --filter @wcl/api test normalize` — Expected: PASS.

- [ ] **Step 5: Run all api tests** — `pnpm --filter @wcl/api test` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/normalize.ts apps/api/src/normalize.test.ts
git commit -m "feat(api): surface combatantInfo auras onto gear snapshots"
```

---

### Task 8: `shadow resi` web tab

**Files:**
- Create: `apps/web/src/components/ShadowResView.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx` (add tab)
- Test: `apps/web/src/components/ShadowResView.test.tsx`

- [ ] **Step 1: Write the failing test** — create `apps/web/src/components/ShadowResView.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { reportFixture, type ReportData } from "@wcl/core";
import { ShadowResView } from "./ShadowResView";

afterEach(cleanup);

/** self-contained report with a Mother Shahraz kill + one geared player. */
function srReport(): ReportData {
  return {
    reportId: "sr", title: "BT", zoneName: "Black Temple",
    startTime: 0, endTime: 1_000_000,
    fights: [{ id: 60, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: true, startTime: 0, endTime: 100 }],
    players: [{ id: 2, name: "Playertwo", class: "Priest" }],
    gear: [{ fightId: 60, playerId: 2, auras: [], items: [{ slot: 1, itemId: 34204, gemIds: [] }] }],
    itemMeta: { "34204": { name: "Pendant of Shadow's End" } },
  };
}

describe("ShadowResView", () => {
  it("renders per-player SR rows for the SR boss", () => {
    render(<ShadowResView report={srReport()} />);
    expect(screen.getByText("Playertwo")).toBeTruthy();
    expect(screen.getByText(/SR from gear \+ buffs/i)).toBeTruthy();
  });
  it("shows a notice when the report has no SR bosses", () => {
    render(<ShadowResView report={reportFixture} />); // fixture has no SR boss
    expect(screen.getByText(/no shadow-resistance boss/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it** — `pnpm --filter @wcl/web test ShadowResView` — expect FAIL.

- [ ] **Step 3: Create `apps/web/src/components/ShadowResView.tsx`:**

```tsx
import { useMemo, useState } from "react";
import { shadowResistance, LISTING_SLOTS, SLOT_NAMES, type SrBoss, type ReportData } from "@wcl/core";
import { itemShadowRes, shadowResEnchants, shadowResBuffs, SR_SOFT_TARGET } from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";

export function ShadowResView({ report }: { report: ReportData }) {
  const [boss, setBoss] = useState<SrBoss | undefined>(undefined);
  const result = useMemo(
    () => shadowResistance(report, {
      itemShadowRes, enchantShadowRes: shadowResEnchants, buffShadowRes: shadowResBuffs, softTarget: SR_SOFT_TARGET,
    }, { boss }),
    [report, boss],
  );

  if (result === null) {
    return <p>This report has no shadow-resistance boss (Mother Shahraz, Kaz'rogal, or Azgalor).</p>;
  }

  return (
    <div>
      <p>
        <label>
          boss:{" "}
          <select value={result.boss} onChange={(e) => setBoss(e.target.value as SrBoss)}>
            {result.availableBosses.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>{" "}
        <small>analyzing the {result.isKill ? "kill" : "longest wipe"}. SR total colouring is advisory, not an official threshold. Priest/mage buff SR may be missing from logs.</small>
      </p>
      <SeverityLegend />
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>player</th>
              <th>SR from gear + buffs</th>
              <th>from gear</th>
              <th>from buffs</th>
              {LISTING_SLOTS.map((s) => <th key={s}>{SLOT_NAMES[s]}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.players.map((p) => (
              <tr key={p.playerId}>
                <td>{p.name}</td>
                <td className={`sev-${p.severity}`}>{p.total}</td>
                <td>{p.fromGear}</td>
                <td>{p.fromBuffs}</td>
                {LISTING_SLOTS.map((s) => <td key={s}>{p.slots[s] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

> `LISTING_SLOTS`/`SLOT_NAMES` are exported from `@wcl/core` (via `slots.ts`), so they come in the single core import above.

- [ ] **Step 4: Run it** — `pnpm --filter @wcl/web test ShadowResView` — Expected: PASS.

- [ ] **Step 5: Wire the tab into `ReportPage.tsx`** — import `ShadowResView`, add `"shadow resi"` to the `tab` union + nav array, and render:

```tsx
      {tab === "shadow resi" && <ShadowResView key={result.data.reportId} report={result.data} />}
```

- [ ] **Step 6: Run all web tests** — `pnpm --filter @wcl/web test` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ShadowResView.tsx apps/web/src/components/ShadowResView.test.tsx apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): shadow resi tab"
```

---

## Phase C — `fight timeline`

### Task 9: core `compareTimelines()`

**Files:**
- Create: `packages/core/src/timeline.ts`
- Modify: `packages/core/src/index.ts` (export)
- Test: `packages/core/src/timeline.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/core/src/timeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compareTimelines } from "./timeline";
import type { ReportData } from "./types";

function rep(title: string, fights: ReportData["fights"]): ReportData {
  return {
    reportId: title, title, zoneName: "Sunwell Plateau",
    startTime: 0, endTime: 1_000_000, fights, players: [], gear: [], itemMeta: {},
  };
}

const A = rep("log A", [
  { id: 1, name: "Trash", encounterId: 0, isBoss: false, startTime: 0, endTime: 10_000 },
  { id: 2, name: "Kalecgos", encounterId: 724, isBoss: true, kill: true, startTime: 30_000, endTime: 90_000 },
]);
const B = rep("log B", [
  { id: 1, name: "Trash", encounterId: 0, isBoss: false, startTime: 0, endTime: 12_000 },
  { id: 2, name: "Kalecgos", encounterId: 724, isBoss: true, kill: true, startTime: 20_000, endTime: 70_000 },
]);

describe("compareTimelines", () => {
  it("builds per-pull idle/start/duration/end for each log", () => {
    const r = compareTimelines(A, B);
    expect(r.a.pulls[0]!.idle).toBeNull();        // first pull has no idle
    expect(r.a.pulls[0]!.duration).toBe(10_000);
    expect(r.a.pulls[1]!.idle).toBe(20_000);      // 30000 - 10000
    expect(r.a.totalIdle).toBe(20_000);
  });
  it("computes per-boss cumulative time difference matched by boss identity", () => {
    const r = compareTimelines(A, B);
    const diff = r.bossDiffs.find((d) => d.boss === "Kalecgos")!;
    expect(diff.cumulativeDiff).toBe(20_000);     // A reached boss-end at 90000, B at 70000
    expect(diff.severity).toBe("major");          // A is slower → behind → red
  });
  it("flags long idle gaps", () => {
    const slow = rep("slow", [
      { id: 1, name: "T", encounterId: 0, isBoss: false, startTime: 0, endTime: 1000 },
      { id: 2, name: "T2", encounterId: 0, isBoss: false, startTime: 200_000, endTime: 201_000 },
    ]);
    const r = compareTimelines(slow, B);
    expect(r.a.pulls[1]!.idleSeverity).toBe("major");
  });
});
```

- [ ] **Step 2: Run it** — `pnpm --filter @wcl/core test timeline` — expect FAIL.

- [ ] **Step 3: Create `packages/core/src/timeline.ts`:**

```ts
import type { ReportData } from "./types";
import type { IssueSeverity } from "./gearIssues";

/** idle gaps above this are flagged red, half of it yellow. */
const LONG_IDLE_MS = 120_000;

export interface TimelinePull {
  name: string; isBoss: boolean;
  idle: number | null; start: number; duration: number; end: number;
  idleSeverity: IssueSeverity;
}
export interface TimelineSide { title: string; pulls: TimelinePull[]; totalIdle: number; }
export interface TimelineBossDiff { boss: string; cumulativeDiff: number; severity: IssueSeverity; }
export interface TimelineComparison { a: TimelineSide; b: TimelineSide; bossDiffs: TimelineBossDiff[]; }

function idleSeverity(idle: number | null): IssueSeverity {
  if (idle === null || idle <= LONG_IDLE_MS / 2) return "minor";
  return idle > LONG_IDLE_MS ? "major" : "moderate";
}

function buildSide(report: ReportData): TimelineSide {
  const fights = [...report.fights].sort((a, b) => a.startTime - b.startTime);
  let prevEnd: number | null = null;
  let totalIdle = 0;
  const pulls = fights.map((f) => {
    const idle = prevEnd === null ? null : f.startTime - prevEnd;
    if (idle !== null && idle > 0) totalIdle += idle;
    prevEnd = f.endTime;
    return {
      name: f.name, isBoss: f.isBoss, idle,
      start: f.startTime, duration: f.endTime - f.startTime, end: f.endTime,
      idleSeverity: idleSeverity(idle),
    };
  });
  return { title: report.title, pulls, totalIdle };
}

/** elapsed time (relative to report start) at which this boss was completed. */
function bossReachedAt(report: ReportData, boss: string): number | null {
  const fs = report.fights.filter((f) => f.isBoss && f.name === boss);
  if (fs.length === 0) return null;
  const done = fs.find((f) => f.kill === true) ?? fs[fs.length - 1]!;
  return done.endTime;
}

/**
 * CLA `fightsSW`: compare two logs pull by pull. Columns are independent (logs
 * may differ in pull order/count); only boss rows are cross-matched by identity
 * for the cumulative time difference (positive = log A reached it later/slower).
 */
export function compareTimelines(a: ReportData, b: ReportData): TimelineComparison {
  const sideA = buildSide(a);
  const sideB = buildSide(b);

  const bossNames = [...new Set(a.fights.filter((f) => f.isBoss).map((f) => f.name))]
    .filter((name) => b.fights.some((f) => f.isBoss && f.name === name));
  const bossDiffs: TimelineBossDiff[] = bossNames.map((boss) => {
    const ta = bossReachedAt(a, boss)!;
    const tb = bossReachedAt(b, boss)!;
    const diff = ta - tb;
    return { boss, cumulativeDiff: diff, severity: diff <= 0 ? "minor" : "major" };
  });

  return { a: sideA, b: sideB, bossDiffs };
}
```

- [ ] **Step 4: Run it** — `pnpm --filter @wcl/core test timeline` — Expected: PASS.

- [ ] **Step 5: Export from `packages/core/src/index.ts`** — add:

```ts
export * from "./timeline";
```

- [ ] **Step 6: Run all core tests** — `pnpm --filter @wcl/core test` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/timeline.ts packages/core/src/index.ts packages/core/src/timeline.test.ts
git commit -m "feat(core): two-log fight timeline comparison"
```

---

### Task 10: `fight timeline` web tab (fetches the second report)

**Files:**
- Create: `apps/web/src/components/TimelineView.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx` (add tab)
- Test: `apps/web/src/components/TimelineView.test.tsx`

- [ ] **Step 1: Confirm the api helper signature.** `apps/web/src/lib/api.ts` exports `fetchReport(reportId): Promise<ReportResponse>` (used in `ReportPage.tsx`). The timeline tab reuses it for the second report. Read the file to confirm `ReportResponse.data` is a `ReportData` and `REPORT_ID_RE`/id validation lives server-side.

Run: `grep -n "export" apps/web/src/lib/api.ts`
Expected: `fetchReport` and `ReportResponse` are exported.

- [ ] **Step 2: Write the failing test** — create `apps/web/src/components/TimelineView.test.tsx`. Mock the api module so no network is hit:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { reportFixture, type ReportData } from "@wcl/core";

vi.mock("../lib/api", () => ({
  fetchReport: vi.fn(async (): Promise<{ data: ReportData; cachedAt: number }> => ({
    data: structuredClone(reportFixture), cachedAt: Date.now(),
  })),
  ApiError: class extends Error { constructor(public status = 500, m = "") { super(m); } },
}));

import { TimelineView } from "./TimelineView";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("TimelineView", () => {
  it("prompts for a second report id", () => {
    render(<TimelineView report={reportFixture} />);
    expect(screen.getByPlaceholderText(/report/i)).toBeTruthy();
  });
  it("renders the comparison after fetching the second report", async () => {
    render(<TimelineView report={reportFixture} />);
    fireEvent.change(screen.getByPlaceholderText(/report/i), { target: { value: "b2C3d4E5f6G7h8I9" } });
    fireEvent.click(screen.getByRole("button", { name: /compare/i }));
    await waitFor(() => expect(screen.getAllByText(/Hydross the Unstable/).length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 3: Run it** — `pnpm --filter @wcl/web test TimelineView` — expect FAIL.

- [ ] **Step 4: Create `apps/web/src/components/TimelineView.tsx`:**

```tsx
import { useState } from "react";
import { compareTimelines, type TimelineComparison, type TimelinePull, type ReportData } from "@wcl/core";
import { ApiError, fetchReport } from "../lib/api";
import { SeverityLegend } from "./SeverityLegend";

function hms(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

function PullRows({ pulls }: { pulls: TimelinePull[] }) {
  return (
    <>
      {pulls.map((p, i) => (
        <tr key={i}>
          <td>{p.name}{p.isBoss ? "" : " (trash)"}</td>
          <td className={`sev-${p.idleSeverity}`}>{p.idle === null ? "---" : hms(p.idle)}</td>
          <td>{hms(p.start)}</td>
          <td>{hms(p.duration)}</td>
          <td>{hms(p.end)}</td>
        </tr>
      ))}
    </>
  );
}

export function TimelineView({ report }: { report: ReportData }) {
  const [id, setId] = useState("");
  const [cmp, setCmp] = useState<TimelineComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const compare = () => {
    setError(null);
    setLoading(true);
    fetchReport(id.trim())
      .then((res) => setCmp(compareTimelines(report, res.data)))
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <p>
        Compare this log's pull timing against a second log.{" "}
        <input placeholder="second report id or url" value={id} onChange={(e) => setId(e.target.value)} />{" "}
        <button onClick={compare} disabled={!id.trim() || loading}>compare</button>
      </p>
      {loading && <p>Loading second report…</p>}
      {error && <p role="alert" className="sev-major">{error}</p>}
      {cmp && (
        <div>
          <SeverityLegend />
          {cmp.bossDiffs.length > 0 && (
            <ul className="timeline-diffs">
              {cmp.bossDiffs.map((d) => (
                <li key={d.boss} className={`sev-${d.severity}`}>
                  {d.boss}: {d.cumulativeDiff <= 0 ? "ahead by " : "behind by "}{hms(Math.abs(d.cumulativeDiff))}
                </li>
              ))}
            </ul>
          )}
          <div className="scroll-x timeline-pair">
            <table>
              <caption>{cmp.a.title} — total idle {hms(cmp.a.totalIdle)}</caption>
              <thead><tr><th>name</th><th>idle</th><th>start</th><th>duration</th><th>end</th></tr></thead>
              <tbody><PullRows pulls={cmp.a.pulls} /></tbody>
            </table>
            <table>
              <caption>{cmp.b.title} — total idle {hms(cmp.b.totalIdle)}</caption>
              <thead><tr><th>name</th><th>idle</th><th>start</th><th>duration</th><th>end</th></tr></thead>
              <tbody><PullRows pulls={cmp.b.pulls} /></tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run it** — `pnpm --filter @wcl/web test TimelineView` — Expected: PASS.

- [ ] **Step 6: Wire the tab into `ReportPage.tsx`** — import `TimelineView`, add `"fight timeline"` to the `tab` union + nav array, and render:

```tsx
      {tab === "fight timeline" && <TimelineView key={result.data.reportId} report={result.data} />}
```

- [ ] **Step 7: Run the full suite** — `pnpm -r test` — Expected: PASS across all packages.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/TimelineView.tsx apps/web/src/components/TimelineView.test.tsx apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): fight timeline comparison tab"
```

---

## Final wrap-up (after Task 10)

- [ ] **Manual E2E** (per the project's verification habit): `pnpm dev`, open a real speedrun report, and check all three tabs against WCL — validate kill counts vs. the WCL Deaths view, shadow resi totals for a Shahraz/Hyjal kill, and the timeline against a second report. Note any data-curation fixes (especially the `verified:false` zones).
- [ ] **Update `handoff.md`** — mark M4 done; record: curated `validateRules` (SW verified, MH/BT/ZA unverified), SR enchant/buff curation, the new `ReportData` fields (`npcKills`, `firstPullNpcIds`, `GearSnapshot.auras`), the Deaths-based kill-count fetch, and that timeline fetches a second report via the existing cache. Note any zone whose rules couldn't be confirmed.
- [ ] **Update `README.md`** tab list if it enumerates tabs.
- [ ] **Update the memory** `wcl-raid-analyzer-project.md` (state → M4 merged, M5 next).
- [ ] **Whole-branch review + finish** via superpowers:finishing-a-development-branch (user has always chosen merge-to-main locally).

---

## Self-review notes (coverage vs. spec)

- validate (rules data, npcKills fetch, core, web, zone override, split boss rule, starting point, unverified badge) → Tasks 1–4. ✓
- shadow resi (enchant/buff data, auras field, core kill/longest-wipe selection, per-slot strings, advisory severity, web) → Tasks 5–8. ✓
- fight timeline (core two-log compare, idle/diff severity, web second-report fetch) → Tasks 9–10. ✓
- ReportData additions (`npcKills`, `firstPullNpcIds`, `GearSnapshot.auras`) defined in Tasks 2 & 6, populated by api in Tasks 3 & 7. ✓
- Graceful degradation for pre-M4 caches: validate returns null (Task 2/4); shadow resi/timeline don't depend on the new gear/kill fields breaking older caches (auras optional). ✓
- Type names consistent across tasks: `ValidateConfig`/`ZoneValidation`/`BossRequirement` (core mirrors data shape), `ShadowResConfig`, `TimelineComparison`. The data module's `ZoneValidation` (Task 1) and core's `ZoneValidation` (Task 2) are structurally identical by design — the web passes `validateRules` straight into `validate()`.
```
