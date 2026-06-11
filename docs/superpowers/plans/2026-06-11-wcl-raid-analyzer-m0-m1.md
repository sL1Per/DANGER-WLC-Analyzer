# WCL Raid Analyzer — M0+M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo, extract the xlsx reference data, and ship a working webapp slice: paste a WCL report URL → see the report summary (zone, fights, players) with trash/boss/wipe filters, via a caching API proxy using bring-your-own WCL v2 credentials.

**Architecture:** pnpm monorepo. `packages/core` is a pure, framework-free analysis library (types, report-input parsing, fight filters). `packages/data` holds reference JSON extracted from the two xlsx files by a Python script. `apps/api` (Hono on Node) mints WCL OAuth tokens, fetches+normalizes reports via GraphQL, and caches them by report ID. `apps/web` (React+Vite) stores credentials in localStorage and renders analyses client-side.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Hono + @hono/node-server, React 18 + Vite, Python 3 + openpyxl (extraction script only).

**Spec:** `docs/superpowers/specs/2026-06-11-wcl-raid-analyzer-design.md`. This plan covers milestones M0 and M1 only; M2–M6 get follow-up plans.

**Working directory:** repo root `/Users/pviegas/Documents/WOW  RPB_CLA` (note the double space in the folder name — always quote paths).

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.gitignore`, `.npmrc`

- [ ] **Step 1: Create workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`package.json`:
```json
{
  "name": "wcl-raid-analyzer",
  "private": true,
  "scripts": {
    "test": "pnpm -r --if-present test",
    "dev": "pnpm -r --parallel --if-present dev",
    "build": "pnpm -r --if-present build"
  },
  "packageManager": "pnpm@9.15.0"
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.env
*.local
```

`.npmrc`:
```
shamefully-hoist=false
```

- [ ] **Step 2: Verify pnpm resolves the workspace**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm install`
Expected: completes without error (no packages yet, lockfile created). If pnpm is missing: `npm install -g pnpm`.

- [ ] **Step 3: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .gitignore .npmrc pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo"
```

---

### Task 2: packages/data — xlsx extraction script

**Files:**
- Create: `packages/data/package.json`, `packages/data/scripts/extract_xlsx.py`, `packages/data/json/` (generated)

- [ ] **Step 1: Create package.json**

`packages/data/package.json`:
```json
{
  "name": "@wcl/data",
  "version": "0.0.1",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "extract": "python3 scripts/extract_xlsx.py",
    "test": "vitest run"
  },
  "devDependencies": { "vitest": "^3.0.0", "typescript": "^5.6.0" }
}
```

- [ ] **Step 2: Write the extraction script**

`packages/data/scripts/extract_xlsx.py` — reads the two xlsx files from the repo root and writes JSON to `packages/data/json/`. Values come from cached formula results (`data_only=True`); Google-Sheets formula husks look like `__xludf.DUMMYFUNCTION`.

```python
#!/usr/bin/env python3
"""Extract reference data from the CLA/RPB xlsx exports into JSON."""
import json, os, re
import openpyxl

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(os.path.dirname(__file__), "..", "json")
CLA = os.path.join(ROOT, "WoW Classic TBC - Combat Log Analytics V1.6.0a.xlsx")
RPB = os.path.join(ROOT, "WoW Classic TBC - Role Performance Breakdown V1.6.0a.xlsx")

def dump(name, obj):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False, sort_keys=True)
    print(f"wrote {name}: {len(obj)} entries")

def id_value_sheet(ws, skip_header):
    """Sheets shaped: col A = numeric id, col B = numeric value."""
    out = {}
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if skip_header and i == 0:
            continue
        a, b = row[0], row[1]
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            out[str(int(a))] = b if b != int(b) else int(b)
    return out

cla = openpyxl.load_workbook(CLA, data_only=True)
rpb = openpyxl.load_workbook(RPB, data_only=True)

# item id -> number of sockets ('sockets' has a header row)
dump("item-sockets.json", id_value_sheet(cla["sockets"], skip_header=True))
# item id -> shadow resistance ('shadow resistance config' has no header)
dump("item-shadow-res.json", id_value_sheet(cla["shadow resistance config"], skip_header=False))
# spell id -> spell haste value (no header)
dump("spell-haste.json", id_value_sheet(rpb["spell haste config"], skip_header=False))

# cheap/bad enchants: CLA 'gear issues' B5:C..., format "927 [8]" | "Bracers - 7 Str"
enchants = []
ws = cla["gear issues"]
for row in ws.iter_rows(min_row=5, min_col=2, max_col=3, values_only=True):
    bid, name = row
    if isinstance(bid, str) and isinstance(name, str):
        m = re.match(r"^(\d+) \[(\d+)\]$", bid.strip())
        if m:
            enchants.append({"enchantId": int(m.group(1)),
                             "slot": int(m.group(2)), "name": name.strip()})
dump("bad-enchants.json", enchants)

# excluded/fun items: CLA 'gear issues' E5:F...
excluded = []
for row in ws.iter_rows(min_row=5, min_col=5, max_col=6, values_only=True):
    iid, name = row
    if iid is not None and isinstance(name, str):
        try:
            excluded.append({"itemId": int(float(str(iid))), "name": name.strip()})
        except ValueError:
            pass
dump("excluded-items.json", excluded)

# speedrun trash requirements: CLA 'validate' rows A6+ (ids | zone | name | min kills)
reqs = []
for row in cla["validate"].iter_rows(min_row=6, max_col=4, values_only=True):
    ids, zone, name, minimum = row
    if ids is None or name is None or minimum is None:
        continue
    npc_ids = [int(x) for x in str(ids).replace(".0", "").split(",") if x.strip().isdigit()]
    reqs.append({"zone": str(zone), "name": str(name),
                 "npcIds": npc_ids, "minKills": int(float(str(minimum)))})
dump("trash-requirements.json", reqs)
```

- [ ] **Step 3: Run the extraction**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA/packages/data" && python3 scripts/extract_xlsx.py`
Expected output (counts may differ by ±a few; sanity-check against these):
```
wrote item-sockets.json: ~1505 entries
wrote item-shadow-res.json: ~1492 entries
wrote spell-haste.json: ~543 entries
wrote bad-enchants.json: ~120 entries
wrote excluded-items.json: ~40 entries
wrote trash-requirements.json: ~9 entries
```
If `openpyxl` is missing: `python3 -m pip install --user openpyxl`.
Note: `trash-requirements.json` only captures the zone currently shown on the `validate` tab (SW). The full per-zone tables live in CLA `trans` columns W–AA and are extracted in the M4 plan; the JSON shape already includes `zone` so M4 only appends entries.

- [ ] **Step 4: Commit**

```bash
git add packages/data
git commit -m "feat(data): xlsx reference-data extraction script + generated JSON"
```

---

### Task 3: packages/data — typed exports + data test

**Files:**
- Create: `packages/data/src/index.ts`, `packages/data/src/data.test.ts`, `packages/data/tsconfig.json`

- [ ] **Step 1: Write the failing test**

`packages/data/src/data.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { itemSockets, itemShadowRes, spellHaste, badEnchants, excludedItems, trashRequirements } from "./index";

describe("reference data", () => {
  it("loads item sockets with plausible volume and values", () => {
    expect(Object.keys(itemSockets).length).toBeGreaterThan(1000);
    expect(itemSockets["21865"]).toBe(3); // Soulcloth Vest, visible in xlsx dump
  });
  it("loads shadow res data", () => {
    expect(Object.keys(itemShadowRes).length).toBeGreaterThan(1000);
  });
  it("loads spell haste data", () => {
    expect(Object.keys(spellHaste).length).toBeGreaterThan(400);
    expect(spellHaste["34340"]).toBe(30); // first row of the config sheet
  });
  it("loads enchant/item/trash lists", () => {
    expect(badEnchants.find((e) => e.enchantId === 927)).toMatchObject({ slot: 8, name: "Bracers - 7 Str" });
    expect(excludedItems.find((i) => i.itemId === 15138)?.name).toBe("Onyxia Scale Cloak");
    expect(trashRequirements.find((t) => t.name === "Sunblade Scout")?.minKills).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/data && pnpm install && pnpm test`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write the implementation**

`packages/data/src/index.ts`:
```ts
import itemSocketsJson from "../json/item-sockets.json";
import itemShadowResJson from "../json/item-shadow-res.json";
import spellHasteJson from "../json/spell-haste.json";
import badEnchantsJson from "../json/bad-enchants.json";
import excludedItemsJson from "../json/excluded-items.json";
import trashRequirementsJson from "../json/trash-requirements.json";

export interface BadEnchant { enchantId: number; slot: number; name: string; }
export interface ExcludedItem { itemId: number; name: string; }
export interface TrashRequirement { zone: string; name: string; npcIds: number[]; minKills: number; }

export const itemSockets: Record<string, number> = itemSocketsJson;
export const itemShadowRes: Record<string, number> = itemShadowResJson;
export const spellHaste: Record<string, number> = spellHasteJson;
export const badEnchants: BadEnchant[] = badEnchantsJson;
export const excludedItems: ExcludedItem[] = excludedItemsJson;
export const trashRequirements: TrashRequirement[] = trashRequirementsJson;
```

`packages/data/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "json"] }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/data && pnpm test`
Expected: PASS (4 tests). If a specific asserted value differs, check the regenerated JSON against `/tmp/wow_dump/` ground truth before changing the assertion.

- [ ] **Step 5: Commit**

```bash
git add packages/data
git commit -m "feat(data): typed exports for reference JSON"
```

---

### Task 4: packages/core — types and report-input parsing

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/types.ts`, `packages/core/src/reportInput.ts`, `packages/core/src/reportInput.test.ts`, `packages/core/src/index.ts`

- [ ] **Step 1: Create the package**

`packages/core/package.json`:
```json
{
  "name": "@wcl/core",
  "version": "0.0.1",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run" },
  "devDependencies": { "vitest": "^3.0.0", "typescript": "^5.6.0" }
}
```
`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Define the shared types (no test — pure declarations)**

`packages/core/src/types.ts`:
```ts
/** Normalized report payload produced by apps/api and consumed by all analyses. */
export interface ReportData {
  reportId: string;
  title: string;
  zoneName: string;
  /** ms epoch of report start; fight times are ms relative to this */
  startTime: number;
  endTime: number;
  fights: Fight[];
  players: Player[];
}

export interface Fight {
  id: number;
  name: string;
  /** 0 = trash pull, otherwise WCL encounter id */
  encounterId: number;
  isBoss: boolean;
  /** true=kill, false=wipe; undefined for trash */
  kill?: boolean;
  startTime: number; // ms relative to report start
  endTime: number;
}

export interface Player {
  id: number;
  name: string;
  /** WCL subType, e.g. "Mage" */
  class: string;
}

export type FightMode = "all" | "bosses" | "trash";

export interface FightFilter {
  mode: FightMode;
  excludeWipes: boolean;
  /** mutually exclusive with range */
  fightId?: number | "last";
  /** mutually exclusive with fightId; ms relative to report start */
  range?: { start: number; end: number };
}
```

- [ ] **Step 3: Write the failing test for report-input parsing**

`packages/core/src/reportInput.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseReportInput } from "./reportInput";

describe("parseReportInput", () => {
  it("accepts a bare report id", () => {
    expect(parseReportInput("a1B2c3D4e5F6g7H8")).toBe("a1B2c3D4e5F6g7H8");
  });
  it("extracts the id from a classic WCL url with fragment", () => {
    expect(parseReportInput("https://classic.warcraftlogs.com/reports/a1B2c3D4e5F6g7H8#fight=28"))
      .toBe("a1B2c3D4e5F6g7H8");
  });
  it("extracts from fresh/vanilla hosts and trailing slash", () => {
    expect(parseReportInput("https://fresh.warcraftlogs.com/reports/a1B2c3D4e5F6g7H8/"))
      .toBe("a1B2c3D4e5F6g7H8");
  });
  it("rejects garbage", () => {
    expect(parseReportInput("not a report")).toBeNull();
    expect(parseReportInput("")).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/core && pnpm install && pnpm test`
Expected: FAIL — `Cannot find module './reportInput'`.

- [ ] **Step 5: Implement**

`packages/core/src/reportInput.ts`:
```ts
const ID_RE = /^[a-zA-Z0-9]{16}$/;
const URL_RE = /warcraftlogs\.com\/reports\/([a-zA-Z0-9]{16})/;

/** Returns the 16-char WCL report code from a raw id or report URL, else null. */
export function parseReportInput(input: string): string | null {
  const trimmed = input.trim();
  if (ID_RE.test(trimmed)) return trimmed;
  const m = trimmed.match(URL_RE);
  return m?.[1] ?? null;
}
```

`packages/core/src/index.ts`:
```ts
export * from "./types";
export * from "./reportInput";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/core && pnpm test`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): ReportData types and report input parsing"
```

---

### Task 5: packages/core — fight filtering + fixture

**Files:**
- Create: `packages/core/src/fixtures/report.fixture.ts`, `packages/core/src/filters.ts`, `packages/core/src/filters.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create the shared fixture**

`packages/core/src/fixtures/report.fixture.ts` (used by core, api and web tests):
```ts
import type { ReportData } from "../types";

export const reportFixture: ReportData = {
  reportId: "a1B2c3D4e5F6g7H8",
  title: "T5 fun",
  zoneName: "Serpentshrine Cavern",
  startTime: 1_700_000_000_000,
  endTime: 1_700_000_400_000,
  fights: [
    { id: 1, name: "Underbog Colossus", encounterId: 0, isBoss: false, startTime: 0, endTime: 60_000 },
    { id: 2, name: "Hydross the Unstable", encounterId: 623, isBoss: true, kill: false, startTime: 70_000, endTime: 130_000 },
    { id: 3, name: "Hydross the Unstable", encounterId: 623, isBoss: true, kill: true, startTime: 150_000, endTime: 250_000 },
    { id: 4, name: "Coilfang Shatterer", encounterId: 0, isBoss: false, startTime: 260_000, endTime: 290_000 },
    { id: 5, name: "The Lurker Below", encounterId: 624, isBoss: true, kill: true, startTime: 300_000, endTime: 380_000 },
  ],
  players: [
    { id: 1, name: "Playerone", class: "Mage" },
    { id: 2, name: "Playertwo", class: "Warrior" },
  ],
};
```

- [ ] **Step 2: Write the failing tests**

`packages/core/src/filters.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { filterFights, validateFilter } from "./filters";
import { reportFixture } from "./fixtures/report.fixture";

const fights = reportFixture.fights;
const ids = (f: ReturnType<typeof filterFights>) => f.map((x) => x.id);

describe("filterFights", () => {
  it("returns everything in 'all' mode", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: false }))).toEqual([1, 2, 3, 4, 5]);
  });
  it("filters bosses only", () => {
    expect(ids(filterFights(fights, { mode: "bosses", excludeWipes: false }))).toEqual([2, 3, 5]);
  });
  it("filters trash only", () => {
    expect(ids(filterFights(fights, { mode: "trash", excludeWipes: false }))).toEqual([1, 4]);
  });
  it("excludes wipes (trash unaffected)", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: true }))).toEqual([1, 3, 4, 5]);
  });
  it("selects a single fight id", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: false, fightId: 2 }))).toEqual([2]);
  });
  it("'last' selects the final fight matching the mode", () => {
    expect(ids(filterFights(fights, { mode: "bosses", excludeWipes: false, fightId: "last" }))).toEqual([5]);
  });
  it("selects by time range overlap", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: false, range: { start: 0, end: 100_000 } })))
      .toEqual([1, 2]);
  });
});

describe("validateFilter", () => {
  it("rejects fightId and range together", () => {
    expect(validateFilter({ mode: "all", excludeWipes: false, fightId: 2, range: { start: 0, end: 1 } }))
      .toMatch(/fight id OR a start and end/i);
  });
  it("accepts either alone", () => {
    expect(validateFilter({ mode: "all", excludeWipes: false, fightId: 2 })).toBeNull();
    expect(validateFilter({ mode: "all", excludeWipes: false })).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/core && pnpm test`
Expected: FAIL — `Cannot find module './filters'`.

- [ ] **Step 4: Implement**

`packages/core/src/filters.ts`:
```ts
import type { Fight, FightFilter } from "./types";

/** Returns an error message if the filter is invalid, else null. */
export function validateFilter(filter: FightFilter): string | null {
  if (filter.fightId !== undefined && filter.range !== undefined) {
    return "You can only specify a fight id OR a start and end timestamp.";
  }
  return null;
}

export function filterFights(fights: Fight[], filter: FightFilter): Fight[] {
  let result = fights.filter((f) => {
    if (filter.mode === "bosses" && !f.isBoss) return false;
    if (filter.mode === "trash" && f.isBoss) return false;
    if (filter.excludeWipes && f.isBoss && f.kill === false) return false;
    return true;
  });
  if (filter.range) {
    result = result.filter((f) => f.endTime > filter.range!.start && f.startTime < filter.range!.end);
  }
  if (filter.fightId === "last") {
    result = result.length > 0 ? [result[result.length - 1]!] : [];
  } else if (typeof filter.fightId === "number") {
    result = result.filter((f) => f.id === filter.fightId);
  }
  return result;
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from "./filters";
export { reportFixture } from "./fixtures/report.fixture";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm test`
Expected: PASS (13 tests total).

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): fight filtering with wipe/fight-id/range support"
```

---

### Task 6: packages/core — TBC zone validation

**Files:**
- Create: `packages/core/src/zones.ts`, `packages/core/src/zones.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/zones.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isTbcRaidZone } from "./zones";

describe("isTbcRaidZone", () => {
  it.each([
    "Karazhan", "Gruul's Lair", "Magtheridon's Lair", "Serpentshrine Cavern",
    "Tempest Keep", "Hyjal Summit", "Black Temple", "Zul'Aman", "Sunwell Plateau",
  ])("accepts %s", (z) => expect(isTbcRaidZone(z)).toBe(true));

  it.each(["Molten Core", "Naxxramas", "Icecrown Citadel", ""])(
    "rejects %s", (z) => expect(isTbcRaidZone(z)).toBe(false));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test`
Expected: FAIL — `Cannot find module './zones'`.

- [ ] **Step 3: Implement**

`packages/core/src/zones.ts`:
```ts
/** Validate by zone NAME, not id — WCL zone ids differ between classic re-releases. */
const TBC_RAID_ZONES = new Set([
  "Karazhan", "Gruul's Lair", "Magtheridon's Lair", "Gruul / Magtheridon",
  "Serpentshrine Cavern", "Tempest Keep", "SSC/TK",
  "Hyjal Summit", "Mount Hyjal", "Black Temple", "Zul'Aman", "Sunwell Plateau",
]);

export function isTbcRaidZone(zoneName: string): boolean {
  return TBC_RAID_ZONES.has(zoneName);
}
```

Add to `packages/core/src/index.ts`: `export * from "./zones";`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): TBC raid zone validation by name"
```

---

### Task 7: apps/api — WCL client (token + report fetch)

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/wcl.ts`, `apps/api/src/wcl.test.ts`

- [ ] **Step 1: Create the package**

`apps/api/package.json`:
```json
{
  "name": "@wcl/api",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "hono": "^4.6.0",
    "@wcl/core": "workspace:*"
  },
  "devDependencies": { "tsx": "^4.19.0", "typescript": "^5.6.0", "vitest": "^3.0.0" }
}
```
`apps/api/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```
Run `pnpm install` at repo root after creating.

- [ ] **Step 2: Write the failing tests (mocked fetch)**

`apps/api/src/wcl.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchToken, fetchRawReport, WclError } from "./wcl";

afterEach(() => vi.unstubAllGlobals());

describe("fetchToken", () => {
  it("posts client_credentials with basic auth and returns the token", async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 86400 }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const token = await fetchToken("myid", "mysecret");
    expect(token).toEqual({ accessToken: "tok", expiresIn: 86400 });
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe("https://www.warcraftlogs.com/oauth/token");
    expect(init.headers.Authorization).toBe("Basic " + Buffer.from("myid:mysecret").toString("base64"));
    expect(init.body.toString()).toContain("grant_type=client_credentials");
  });
  it("throws WclError(401) on bad credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    await expect(fetchToken("bad", "creds")).rejects.toMatchObject({ status: 401 });
  });
});

describe("fetchRawReport", () => {
  it("queries the classic v2 endpoint with bearer token", async () => {
    const report = { title: "T5 fun" };
    const mock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { reportData: { report } } }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const raw = await fetchRawReport("a1B2c3D4e5F6g7H8", "tok");
    expect(raw).toEqual(report);
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe("https://classic.warcraftlogs.com/api/v2/client");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body).variables.code).toBe("a1B2c3D4e5F6g7H8");
  });
  it("throws WclError(404) when the report is null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { reportData: { report: null } } }), { status: 200 })));
    await expect(fetchRawReport("a1B2c3D4e5F6g7H8", "tok")).rejects.toMatchObject({ status: 404 });
  });
  it("throws WclError(429) on rate limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("limit", { status: 429 })));
    await expect(fetchRawReport("a1B2c3D4e5F6g7H8", "tok")).rejects.toMatchObject({ status: 429 });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/api && pnpm test`
Expected: FAIL — `Cannot find module './wcl'`.

- [ ] **Step 4: Implement**

`apps/api/src/wcl.ts`:
```ts
const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
const API_URL = "https://classic.warcraftlogs.com/api/v2/client";

export class WclError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface Token { accessToken: string; expiresIn: number; }

export async function fetchToken(clientId: string, clientSecret: string): Promise<Token> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new WclError(res.status, `WCL token request failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

/** M1 query: report metadata, fights, players. Extended with tables/events in M2+. */
const REPORT_QUERY = `
query Report($code: String!) {
  reportData {
    report(code: $code) {
      title
      startTime
      endTime
      zone { name }
      fights { id name encounterID kill startTime endTime }
      masterData { actors(type: "Player") { id name subType } }
    }
  }
}`;

export interface RawReport {
  title: string;
  startTime: number;
  endTime: number;
  zone: { name: string } | null;
  fights: { id: number; name: string; encounterID: number; kill: boolean | null;
            startTime: number; endTime: number }[];
  masterData: { actors: { id: number; name: string; subType: string }[] };
}

export async function fetchRawReport(code: string, accessToken: string): Promise<RawReport> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: REPORT_QUERY, variables: { code } }),
  });
  if (!res.ok) throw new WclError(res.status, `WCL API request failed (${res.status})`);
  const json = (await res.json()) as { data?: { reportData?: { report: RawReport | null } }; errors?: { message: string }[] };
  if (json.errors?.length) throw new WclError(502, json.errors.map((e) => e.message).join("; "));
  const report = json.data?.reportData?.report;
  if (!report) throw new WclError(404, "Report not found or not accessible with these credentials");
  return report;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && pnpm test`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): WCL v2 token exchange and raw report fetch"
```

---

### Task 8: apps/api — normalization to ReportData

**Files:**
- Create: `apps/api/src/normalize.ts`, `apps/api/src/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/src/normalize.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { normalizeReport } from "./normalize";
import type { RawReport } from "./wcl";

const raw: RawReport = {
  title: "T5 fun",
  startTime: 1_700_000_000_000,
  endTime: 1_700_000_400_000,
  zone: { name: "Serpentshrine Cavern" },
  fights: [
    { id: 1, name: "Underbog Colossus", encounterID: 0, kill: null, startTime: 0, endTime: 60_000 },
    { id: 2, name: "Hydross the Unstable", encounterID: 623, kill: false, startTime: 70_000, endTime: 130_000 },
  ],
  masterData: { actors: [{ id: 7, name: "Playerone", subType: "Mage" }] },
};

describe("normalizeReport", () => {
  it("maps raw WCL fields onto ReportData", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw);
    expect(data.reportId).toBe("a1B2c3D4e5F6g7H8");
    expect(data.zoneName).toBe("Serpentshrine Cavern");
    expect(data.fights[0]).toMatchObject({ id: 1, isBoss: false, kill: undefined });
    expect(data.fights[1]).toMatchObject({ id: 2, isBoss: true, kill: false, encounterId: 623 });
    expect(data.players).toEqual([{ id: 7, name: "Playerone", class: "Mage" }]);
  });
  it("throws for non-TBC zones", () => {
    expect(() => normalizeReport("a1B2c3D4e5F6g7H8", { ...raw, zone: { name: "Naxxramas" } }))
      .toThrow(/TBC/);
  });
  it("throws when zone is missing", () => {
    expect(() => normalizeReport("a1B2c3D4e5F6g7H8", { ...raw, zone: null })).toThrow(/zone/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test`
Expected: FAIL — `Cannot find module './normalize'`.

- [ ] **Step 3: Implement**

`apps/api/src/normalize.ts`:
```ts
import { isTbcRaidZone, type ReportData } from "@wcl/core";
import { WclError, type RawReport } from "./wcl";

export function normalizeReport(reportId: string, raw: RawReport): ReportData {
  if (!raw.zone?.name) {
    throw new WclError(422, "The zone of the report was not recognized by WCL.");
  }
  if (!isTbcRaidZone(raw.zone.name)) {
    throw new WclError(422,
      `This is the TBC analyzer; report zone "${raw.zone.name}" is not a TBC raid.`);
  }
  return {
    reportId,
    title: raw.title,
    zoneName: raw.zone.name,
    startTime: raw.startTime,
    endTime: raw.endTime,
    fights: raw.fights.map((f) => ({
      id: f.id,
      name: f.name,
      encounterId: f.encounterID,
      isBoss: f.encounterID !== 0,
      kill: f.encounterID !== 0 ? (f.kill ?? false) : undefined,
      startTime: f.startTime,
      endTime: f.endTime,
    })),
    players: raw.masterData.actors.map((a) => ({ id: a.id, name: a.name, class: a.subType })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test`
Expected: PASS (8 tests total in apps/api).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): normalize raw WCL report to ReportData with TBC zone check"
```

---

### Task 9: apps/api — TTL cache

**Files:**
- Create: `apps/api/src/cache.ts`, `apps/api/src/cache.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/src/cache.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
  it("stores and returns entries with their timestamp", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    expect(cache.get("k")?.value).toBe("v");
    expect(cache.get("k")?.cachedAt).toBeTypeOf("number");
  });
  it("expires entries after the ttl", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    vi.advanceTimersByTime(1001);
    expect(cache.get("k")).toBeUndefined();
    vi.useRealTimers();
  });
  it("delete removes an entry (manual refresh)", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    cache.delete("k");
    expect(cache.get("k")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test`
Expected: FAIL — `Cannot find module './cache'`.

- [ ] **Step 3: Implement**

`apps/api/src/cache.ts`:
```ts
export interface CacheEntry<T> { value: T; cachedAt: number; }

/** In-memory TTL cache. Swappable for Cloudflare KV at deploy time (M6). */
export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  constructor(private ttlMs: number) {}

  get(key: string): CacheEntry<T> | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }
  set(key: string, value: T): void {
    this.store.set(key, { value, cachedAt: Date.now() });
  }
  delete(key: string): void {
    this.store.delete(key);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): in-memory TTL cache"
```

---

### Task 10: apps/api — HTTP app (routes) + server entry

**Files:**
- Create: `apps/api/src/app.ts`, `apps/api/src/app.test.ts`, `apps/api/src/server.ts`

- [ ] **Step 1: Write the failing tests**

`apps/api/src/app.test.ts` — uses Hono's built-in `app.request()`, WCL calls mocked via dependency injection:
```ts
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { WclError, type RawReport } from "./wcl";

const raw: RawReport = {
  title: "T5 fun", startTime: 1, endTime: 2, zone: { name: "Karazhan" },
  fights: [], masterData: { actors: [] },
};

function makeApp(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  return createApp({
    fetchToken: vi.fn().mockResolvedValue({ accessToken: "tok", expiresIn: 86400 }),
    fetchRawReport: vi.fn().mockResolvedValue(raw),
    cacheTtlMs: 60_000,
    ...overrides,
  });
}

describe("POST /api/token", () => {
  it("mints a token from client credentials", async () => {
    const res = await makeApp().request("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "id", clientSecret: "sec" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accessToken: "tok", expiresIn: 86400 });
  });
  it("maps WCL 401 to 401 with a friendly message", async () => {
    const app = makeApp({ fetchToken: vi.fn().mockRejectedValue(new WclError(401, "bad")) });
    const res = await app.request("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "id", clientSecret: "sec" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/report/:id", () => {
  it("returns normalized data and caches it", async () => {
    const fetchRawReport = vi.fn().mockResolvedValue(raw);
    const app = makeApp({ fetchRawReport });
    const r1 = await app.request("/api/report/a1B2c3D4e5F6g7H8", {
      headers: { Authorization: "Bearer tok" },
    });
    expect(r1.status).toBe(200);
    const body1 = await r1.json();
    expect(body1.data.zoneName).toBe("Karazhan");
    expect(body1.cachedAt).toBeTypeOf("number");

    // second request: no auth header at all -> served from cache
    const r2 = await app.request("/api/report/a1B2c3D4e5F6g7H8");
    expect(r2.status).toBe(200);
    expect(fetchRawReport).toHaveBeenCalledTimes(1);
  });
  it("returns 401 with needsKey on cache miss without token", async () => {
    const res = await makeApp().request("/api/report/a1B2c3D4e5F6g7H8");
    expect(res.status).toBe(401);
    expect((await res.json()).needsKey).toBe(true);
  });
  it("rejects malformed report ids", async () => {
    const res = await makeApp().request("/api/report/short", {
      headers: { Authorization: "Bearer tok" },
    });
    expect(res.status).toBe(400);
  });
  it("DELETE evicts the cache (manual refresh)", async () => {
    const fetchRawReport = vi.fn().mockResolvedValue(raw);
    const app = makeApp({ fetchRawReport });
    const auth = { headers: { Authorization: "Bearer tok" } };
    await app.request("/api/report/a1B2c3D4e5F6g7H8", auth);
    await app.request("/api/report/a1B2c3D4e5F6g7H8", { ...auth, method: "DELETE" });
    await app.request("/api/report/a1B2c3D4e5F6g7H8", auth);
    expect(fetchRawReport).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test`
Expected: FAIL — `Cannot find module './app'`.

- [ ] **Step 3: Implement**

`apps/api/src/app.ts`:
```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ReportData } from "@wcl/core";
import { TtlCache } from "./cache";
import { normalizeReport } from "./normalize";
import { WclError, fetchRawReport as realFetchRawReport, fetchToken as realFetchToken } from "./wcl";

export interface AppDeps {
  fetchToken: typeof realFetchToken;
  fetchRawReport: typeof realFetchRawReport;
  cacheTtlMs: number;
}

const REPORT_ID_RE = /^[a-zA-Z0-9]{16}$/;

export function createApp(deps: AppDeps = {
  fetchToken: realFetchToken,
  fetchRawReport: realFetchRawReport,
  cacheTtlMs: 24 * 60 * 60 * 1000,
}) {
  const cache = new TtlCache<ReportData>(deps.cacheTtlMs);
  const app = new Hono();
  app.use("/api/*", cors());

  app.post("/api/token", async (c) => {
    const { clientId, clientSecret } = await c.req.json<{ clientId?: string; clientSecret?: string }>();
    if (!clientId || !clientSecret) return c.json({ error: "clientId and clientSecret required" }, 400);
    try {
      return c.json(await deps.fetchToken(clientId, clientSecret));
    } catch (e) {
      return toErrorResponse(c, e);
    }
  });

  app.get("/api/report/:id", async (c) => {
    const id = c.req.param("id");
    if (!REPORT_ID_RE.test(id)) return c.json({ error: "Malformed report id" }, 400);

    const cached = cache.get(id);
    if (cached) return c.json({ data: cached.value, cachedAt: cached.cachedAt });

    const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
    if (!token) {
      return c.json({
        needsKey: true,
        error: "Report not cached yet. Load it once with WCL credentials (Settings page).",
      }, 401);
    }
    try {
      const data = normalizeReport(id, await deps.fetchRawReport(id, token));
      cache.set(id, data);
      return c.json({ data, cachedAt: Date.now() });
    } catch (e) {
      return toErrorResponse(c, e);
    }
  });

  app.delete("/api/report/:id", (c) => {
    cache.delete(c.req.param("id"));
    return c.json({ ok: true });
  });

  return app;
}

function toErrorResponse(c: any, e: unknown) {
  if (e instanceof WclError) {
    const friendly: Record<number, string> = {
      401: "WCL rejected the credentials. Check your client ID and secret.",
      429: "WCL rate limit reached. Wait for your hourly points to reset (see your WCL profile).",
    };
    return c.json({ error: friendly[e.status] ?? e.message }, e.status as 400);
  }
  return c.json({ error: "Unexpected server error" }, 500);
}
```

`apps/api/src/server.ts`:
```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp().fetch, port });
console.log(`API listening on http://localhost:${port}`);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm test`
Expected: PASS (all api tests).

- [ ] **Step 5: Smoke-test the server starts**

Run: `cd apps/api && timeout 5 pnpm dev; true` (or start and Ctrl-C)
Expected: prints `API listening on http://localhost:8787`.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): HTTP routes for token minting and cached report fetch"
```

---

### Task 11: apps/web — scaffold + credentials storage

**Files:**
- Create: `apps/web/` via Vite scaffold, then `apps/web/src/lib/storage.ts`, `apps/web/src/lib/storage.test.ts`, `apps/web/src/lib/api.ts`

- [ ] **Step 1: Scaffold the Vite app**

```bash
cd "/Users/pviegas/Documents/WOW  RPB_CLA/apps"
pnpm create vite web --template react-ts
```
Then edit `apps/web/package.json`: set `"name": "@wcl/web"`, and add to it:
```json
{
  "scripts": { "test": "vitest run" },
  "dependencies": { "react-router-dom": "^6.28.0", "@wcl/core": "workspace:*" },
  "devDependencies": {
    "vitest": "^3.0.0", "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0", "@testing-library/jest-dom": "^6.6.0"
  }
}
```
(Merge with the scaffold's existing entries, don't replace them.) Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom" },
});
```
Add a dev proxy in `apps/web/vite.config.ts` so the SPA reaches the API without CORS fuss:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8787" } },
});
```
Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm install`
Expected: installs cleanly. Delete the scaffold's `App.css` demo content later in Task 12.

- [ ] **Step 2: Write the failing storage test**

`apps/web/src/lib/storage.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { loadCredentials, saveCredentials, loadToken, saveToken } from "./storage";

beforeEach(() => localStorage.clear());

describe("credentials storage", () => {
  it("round-trips credentials", () => {
    saveCredentials({ clientId: "id", clientSecret: "sec" });
    expect(loadCredentials()).toEqual({ clientId: "id", clientSecret: "sec" });
  });
  it("returns null when nothing stored", () => {
    expect(loadCredentials()).toBeNull();
    expect(loadToken()).toBeNull();
  });
  it("drops expired tokens", () => {
    saveToken({ accessToken: "tok", expiresAt: Date.now() - 1000 });
    expect(loadToken()).toBeNull();
  });
  it("returns valid tokens", () => {
    saveToken({ accessToken: "tok", expiresAt: Date.now() + 60_000 });
    expect(loadToken()?.accessToken).toBe("tok");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && pnpm test`
Expected: FAIL — `Cannot find module './storage'`.

- [ ] **Step 4: Implement storage + API client**

`apps/web/src/lib/storage.ts`:
```ts
export interface Credentials { clientId: string; clientSecret: string; }
export interface StoredToken { accessToken: string; expiresAt: number; }

const CREDS_KEY = "wcl.credentials";
const TOKEN_KEY = "wcl.token";

export function saveCredentials(c: Credentials): void {
  localStorage.setItem(CREDS_KEY, JSON.stringify(c));
}
export function loadCredentials(): Credentials | null {
  const raw = localStorage.getItem(CREDS_KEY);
  return raw ? (JSON.parse(raw) as Credentials) : null;
}
export function saveToken(t: StoredToken): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}
export function loadToken(): StoredToken | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  const token = JSON.parse(raw) as StoredToken;
  if (token.expiresAt <= Date.now()) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}
```

`apps/web/src/lib/api.ts`:
```ts
import type { ReportData } from "@wcl/core";
import { loadCredentials, loadToken, saveToken } from "./storage";

export class ApiError extends Error {
  constructor(public status: number, message: string, public needsKey = false) { super(message); }
}

async function ensureToken(): Promise<string | null> {
  const existing = loadToken();
  if (existing) return existing.accessToken;
  const creds = loadCredentials();
  if (!creds) return null;
  const res = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) throw new ApiError(res.status, (await res.json()).error ?? "Token request failed");
  const { accessToken, expiresIn } = await res.json();
  // refresh 5 minutes before actual expiry
  saveToken({ accessToken, expiresAt: Date.now() + (expiresIn - 300) * 1000 });
  return accessToken;
}

export interface ReportResponse { data: ReportData; cachedAt: number; }

export async function fetchReport(reportId: string): Promise<ReportResponse> {
  const token = await ensureToken();
  const res = await fetch(`/api/report/${reportId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Request failed", body.needsKey ?? false);
  return body as ReportResponse;
}

export async function refreshReport(reportId: string): Promise<ReportResponse> {
  await fetch(`/api/report/${reportId}`, { method: "DELETE" });
  return fetchReport(reportId);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && pnpm test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): Vite scaffold, credential/token storage, API client"
```

---

### Task 12: apps/web — pages (Settings, Home, Report summary)

**Files:**
- Create: `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/pages/HomePage.tsx`, `apps/web/src/pages/ReportPage.tsx`, `apps/web/src/components/ReportSummary.tsx`, `apps/web/src/components/ReportSummary.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/src/index.css`
- Delete: `apps/web/src/App.css`, `apps/web/src/assets/react.svg` (scaffold leftovers)

- [ ] **Step 1: Write the failing component test**

`apps/web/src/components/ReportSummary.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { ReportSummary } from "./ReportSummary";

describe("ReportSummary", () => {
  it("shows report metadata, fights and players", () => {
    render(<ReportSummary report={reportFixture} cachedAt={Date.now()} />);
    expect(screen.getByText("T5 fun")).toBeTruthy();
    expect(screen.getByText("Serpentshrine Cavern")).toBeTruthy();
    expect(screen.getAllByText("Hydross the Unstable").length).toBe(2);
    expect(screen.getByText("Playerone")).toBeTruthy();
  });
  it("filters to bosses without wipes via the controls", async () => {
    const { getByLabelText, queryAllByText } = render(
      <ReportSummary report={reportFixture} cachedAt={Date.now()} />);
    (getByLabelText("only bosses") as HTMLInputElement).click();
    (getByLabelText("no wipes") as HTMLInputElement).click();
    // wipe fight 2 disappears, kill fight 3 stays
    expect(queryAllByText("Hydross the Unstable").length).toBe(1);
    expect(queryAllByText("Underbog Colossus").length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test`
Expected: FAIL — `Cannot find module './ReportSummary'`.

- [ ] **Step 3: Implement the components and pages**

`apps/web/src/components/ReportSummary.tsx`:
```tsx
import { useMemo, useState } from "react";
import { filterFights, type FightMode, type ReportData } from "@wcl/core";

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ReportSummary({ report, cachedAt }: { report: ReportData; cachedAt: number }) {
  const [mode, setMode] = useState<FightMode>("all");
  const [excludeWipes, setExcludeWipes] = useState(false);

  const fights = useMemo(
    () => filterFights(report.fights, { mode, excludeWipes }),
    [report, mode, excludeWipes],
  );

  return (
    <div>
      <header>
        <h1>{report.title}</h1>
        <p>
          <strong>{report.zoneName}</strong> · {new Date(report.startTime).toLocaleString()} ·{" "}
          <small>cached {new Date(cachedAt).toLocaleTimeString()}</small>
        </p>
      </header>

      <fieldset>
        <legend>Fights</legend>
        {(["all", "bosses", "trash"] as const).map((m) => (
          <label key={m}>
            <input type="radio" name="mode" aria-label={m === "all" ? "trash & bosses" : `only ${m}`}
              checked={mode === m} onChange={() => setMode(m)} />
            {m === "all" ? "trash & bosses" : `only ${m}`}
          </label>
        ))}
        <label>
          <input type="checkbox" aria-label="no wipes"
            checked={excludeWipes} onChange={(e) => setExcludeWipes(e.target.checked)} />
          no wipes
        </label>
      </fieldset>

      <table>
        <thead>
          <tr><th>id</th><th>name</th><th>type</th><th>result</th><th>duration</th></tr>
        </thead>
        <tbody>
          {fights.map((f) => (
            <tr key={f.id}>
              <td>{f.id}</td>
              <td>{f.name}</td>
              <td>{f.isBoss ? "boss" : "trash"}</td>
              <td>{f.isBoss ? (f.kill ? "kill" : "wipe") : "—"}</td>
              <td>{fmtDuration(f.endTime - f.startTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Players ({report.players.length})</h2>
      <ul>
        {report.players.map((p) => (
          <li key={p.id}>{p.name} <small>({p.class})</small></li>
        ))}
      </ul>
    </div>
  );
}
```

`apps/web/src/pages/SettingsPage.tsx`:
```tsx
import { FormEvent, useState } from "react";
import { loadCredentials, saveCredentials } from "../lib/storage";

export function SettingsPage() {
  const existing = loadCredentials();
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState(existing?.clientSecret ?? "");
  const [saved, setSaved] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveCredentials({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>WCL API credentials</h1>
      <p>
        Create a (free) v2 API client at{" "}
        <a href="https://classic.warcraftlogs.com/api/clients/" target="_blank" rel="noreferrer">
          classic.warcraftlogs.com/api/clients
        </a>{" "}
        and paste the client ID and secret here. They are stored only in this browser.
      </p>
      <label>Client ID <input value={clientId} onChange={(e) => setClientId(e.target.value)} required /></label>
      <label>Client secret <input value={clientSecret} type="password"
        onChange={(e) => setClientSecret(e.target.value)} required /></label>
      <button type="submit">Save</button>
      {saved && <p role="status">Saved.</p>}
    </form>
  );
}
```

`apps/web/src/pages/HomePage.tsx`:
```tsx
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseReportInput } from "@wcl/core";

export function HomePage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = parseReportInput(input);
    if (!id) {
      setError("That doesn't look like a WCL report URL or id.");
      return;
    }
    navigate(`/report/${id}`);
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>WCL Raid Analyzer</h1>
      <p>Paste a WarcraftLogs report URL or id:</p>
      <input value={input} onChange={(e) => setInput(e.target.value)}
        placeholder="https://classic.warcraftlogs.com/reports/…" size={60} />
      <button type="submit">Analyze</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

`apps/web/src/pages/ReportPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, fetchReport, refreshReport, type ReportResponse } from "../lib/api";
import { ReportSummary } from "../components/ReportSummary";

export function ReportPage() {
  const { reportId = "" } = useParams();
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchReport(reportId)
      .then(setResult)
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError(500, String(e))))
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) return <p>Loading report…</p>;
  if (error) {
    return (
      <div role="alert">
        <p>{error.message}</p>
        {error.needsKey && <p><Link to="/settings">Add your WCL credentials</Link> to load this report.</p>}
      </div>
    );
  }
  if (!result) return null;
  return (
    <div>
      <button onClick={() => refreshReport(reportId).then(setResult)}>Refresh from WCL</button>
      <ReportSummary report={result.data} cachedAt={result.cachedAt} />
    </div>
  );
}
```

`apps/web/src/App.tsx` (replace scaffold content):
```tsx
import { Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { ReportPage } from "./pages/ReportPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <div className="app">
      <nav>
        <Link to="/">Home</Link> · <Link to="/settings">Settings</Link>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/report/:reportId" element={<ReportPage />} />
      </Routes>
    </div>
  );
}
```

`apps/web/src/main.tsx` (wrap with router):
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

Keep `index.css` minimal (system font, readable table padding); delete `App.css` and the import of it, plus `assets/react.svg`. No design-system work in M1.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm test`
Expected: PASS (storage + ReportSummary tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): settings, home and report summary pages with fight filters"
```

---

### Task 13: End-to-end verification + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Full test suite**

Run: `cd "/Users/pviegas/Documents/WOW  RPB_CLA" && pnpm test`
Expected: all package test suites PASS.

- [ ] **Step 2: Manual end-to-end check (requires real WCL credentials)**

1. `pnpm dev` at the repo root (starts API on :8787 and web on :5173).
2. Open `http://localhost:5173/settings`, paste a real WCL v2 client ID/secret, Save.
3. Paste a real TBC report URL on the home page → expect zone, fight table (filters working), player list.
4. Open the same `/report/<id>` URL in a private/incognito window (no credentials) → expect the report to load from cache.
5. Paste a non-TBC (e.g. vanilla) report → expect the friendly "not a TBC raid" error.

If WCL rejects the token request, verify the client was created on the *classic* site and the secret was copied fully.

- [ ] **Step 3: Write README**

`README.md`:
```markdown
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

## Layout

- `packages/core` — pure analysis engine (no I/O)
- `packages/data` — reference JSON extracted from the original xlsx files
  (`pnpm --filter @wcl/data extract` to regenerate)
- `apps/api` — Hono proxy: WCL OAuth, GraphQL fetch, report cache
- `apps/web` — React SPA
```

- [ ] **Step 4: Add CI workflow**

`.github/workflows/ci.yml` (runs once the repo gets a GitHub remote; harmless until then):
```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add README.md .github
git commit -m "docs: README and CI workflow"
```

---

## Out of scope for this plan (follow-up plans)

- **M2:** gear issues + gear listing (extends the GraphQL query with combatantInfo events; adds `packages/core/src/gearIssues.ts`, `gearListing.ts`).
- **M3:** consumables + drums. 
- **M4:** validate + shadow resi + fight timeline (incl. extracting the remaining per-zone trash tables from CLA `trans` W–AA). 
- **M5:** RPB. 
- **M6:** Discord webhook, dark mode, Cloudflare Workers deploy (swap `TtlCache` for KV behind the same interface).
