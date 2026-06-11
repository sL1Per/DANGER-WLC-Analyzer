# WCL Raid Analyzer — M2 Gear Issues + Gear Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the CLA gear analyses to the working M1 app: a per-boss-fight **gear listing** (17 slots per player, real item names) and a **gear issues** audit (missing items, missing/bad/cheap enchants, missing/low-quality gems, fun/excluded items, useless shadow-resistance gear) with the original's settings (minimum gem quality, exclude Mother Shahraz, list players with no issues).

**Architecture:** WCL `combatantInfo` events (one per player per boss pull) are fetched and normalized into `ReportData.gear`; item/gem names+qualities come from WCL's `gameData` API into `ReportData.itemMeta`. All analysis logic lives in `packages/core` (`gearListing.ts`, `gearIssues.ts`, `slots.ts`) as pure functions over `ReportData`; `apps/web` adds a tab bar to the report page with two new views.

**Tech Stack:** unchanged — TypeScript, pnpm monorepo, Vitest, Hono, React 19 + Vite. Reference data already in `@wcl/data` (item-sockets, item-shadow-res, bad-enchants, excluded-items).

**Spec:** `docs/superpowers/specs/2026-06-11-wcl-raid-analyzer-design.md` (M2 section). Repo root: `/Users/pviegas/Documents/WOW  RPB_CLA` (double space — always quote).

## Scope decisions (read first)

**In scope (data exists):** empty item slots; no enchant on enchantable slots; cheap/bad enchant (bad-enchants.json, slot-aware); missing gems (item-sockets.json); gem below minimum quality (via WCL gameData quality — with graceful skip when unknown); fun/excluded items (excluded-items.json); useless SR gear outside Shahraz/Kaz'rogal/Azgalor (item-shadow-res.json) with `excludeShahraz` toggle; `listNoIssues` toggle; per-fight gear listing with default "last boss fight with gear".

**Deferred (needs data/roles we don't have yet — noted in spec "Known unknowns"):** inactive meta gems (needs aura analysis), spell-hit-on-non-caster / melee-hit-on-caster (needs role detection, M5), vs-undead/demon items (needs boss creature-type table), useless riding/slowfall/engi gear (needs static item lists). Do NOT implement these.

**Schema risk + mitigation:** the exact WCL v2 `combatantInfo` event shape and whether `gameData.item` exposes `quality` are assumptions from WCL docs. Task 8 ships a probe script the user runs once with real credentials; the code is written to degrade gracefully (unknown gem quality → that rule silently skips that gem). Issues only — never crash the report page because gear data is missing (some T6 fights lack combatantInfo per the spec).

**WoW inventory slot ids** (combatantInfo `gear[].slot`, matches the bad-enchants `[n]` slots from the xlsx): 0 Head, 1 Neck, 2 Shoulders, 3 Shirt, 4 Chest, 5 Waist, 6 Legs, 7 Feet, 8 Bracers, 9 Hands, 10 Ring1, 11 Ring2, 12 Trinket1, 13 Trinket2, 14 Cloak, 15 Weapon, 16 Off-Hand, 17 Wand/Idol/Relic, 18 Tabard.

---

### Task 1: core — gear types, slot constants, fixture extension

**Files:**
- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/slots.ts`, `packages/core/src/slots.test.ts`
- Modify: `packages/core/src/fixtures/report.fixture.ts`, `packages/core/src/index.ts`
- Modify (mechanical): `apps/api/src/normalize.ts` + its test will be updated in Task 5 — for THIS task, add the new required fields with empty defaults so the repo stays green.

- [ ] **Step 1: Extend types** — append to `packages/core/src/types.ts`:

```ts
/** One equipped item from a combatantInfo snapshot. */
export interface GearItem {
  /** WoW inventory slot id (0=Head … 17=Wand/Idol/Relic, 18=Tabard) */
  slot: number;
  itemId: number;
  itemLevel?: number;
  permanentEnchantId?: number;
  temporaryEnchantId?: number;
  gemIds: number[];
}

/** A player's full gear at the start of one boss fight. */
export interface GearSnapshot {
  fightId: number;
  playerId: number;
  items: GearItem[];
}

/** Item/gem metadata resolved via WCL gameData. quality: 1 common … 4 epic. */
export interface ItemMeta { name: string; quality?: number; }
```

and extend `ReportData` with two new required fields:

```ts
  /** combatantInfo gear snapshots, boss fights only; empty when unavailable */
  gear: GearSnapshot[];
  /** itemId/gemId → name+quality, for every id appearing in gear */
  itemMeta: Record<string, ItemMeta>;
```

- [ ] **Step 2: Failing slots test** — `packages/core/src/slots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SLOT_NAMES, LISTING_SLOTS, ENCHANTABLE_SLOTS, REQUIRED_SLOTS } from "./slots";

describe("slot constants", () => {
  it("names match the original spreadsheet layout", () => {
    expect(SLOT_NAMES[8]).toBe("Bracers");
    expect(SLOT_NAMES[14]).toBe("Cloak");
    expect(SLOT_NAMES[17]).toBe("Wand/Idol/Relic");
  });
  it("listing shows 17 slots, no shirt/tabard", () => {
    expect(LISTING_SLOTS).toHaveLength(17);
    expect(LISTING_SLOTS).not.toContain(3);
    expect(LISTING_SLOTS).not.toContain(18);
  });
  it("enchantable slots exclude rings, neck, trinkets, off-hand", () => {
    for (const s of [1, 10, 11, 12, 13, 16]) expect(ENCHANTABLE_SLOTS.has(s)).toBe(false);
    for (const s of [0, 2, 4, 6, 7, 8, 9, 14, 15]) expect(ENCHANTABLE_SLOTS.has(s)).toBe(true);
  });
  it("required slots exclude off-hand and ranged (class-dependent)", () => {
    expect(REQUIRED_SLOTS).not.toContain(16);
    expect(REQUIRED_SLOTS).not.toContain(17);
    expect(REQUIRED_SLOTS).toContain(15);
  });
});
```

- [ ] **Step 3: Run** `cd "<repo>/packages/core" && pnpm test` — slots suite FAILS (module not found).

- [ ] **Step 4: Implement** — `packages/core/src/slots.ts`:

```ts
/** WoW inventory slot ids as used by WCL combatantInfo and the original CLA. */
export const SLOT_NAMES: Record<number, string> = {
  0: "Head", 1: "Neck", 2: "Shoulders", 3: "Shirt", 4: "Chest", 5: "Waist",
  6: "Legs", 7: "Feet", 8: "Bracers", 9: "Hands", 10: "Ring1", 11: "Ring2",
  12: "Trinket1", 13: "Trinket2", 14: "Cloak", 15: "Weapon", 16: "Off-Hand",
  17: "Wand/Idol/Relic", 18: "Tabard",
};

/** Display order of the original CLA "gear listing" tab (17 columns). */
export const LISTING_SLOTS = [0, 1, 2, 14, 4, 8, 9, 5, 6, 7, 10, 11, 12, 13, 15, 16, 17];

/**
 * Slots that always take a permanent enchant in TBC.
 * Excluded: rings (enchanter-only), off-hand (held-in-hand items can't be
 * enchanted and we can't tell shields apart), neck/trinkets/waist (no enchants).
 */
export const ENCHANTABLE_SLOTS = new Set([0, 2, 4, 6, 7, 8, 9, 14, 15]);

/** Slots every raider must have filled; off-hand/ranged are class-dependent. */
export const REQUIRED_SLOTS = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export const QUALITY_NAMES: Record<number, string> = {
  1: "common", 2: "uncommon", 3: "rare", 4: "epic",
};
```

Add `export * from "./slots";` to `packages/core/src/index.ts`.

- [ ] **Step 5: Extend the fixture** — in `packages/core/src/fixtures/report.fixture.ts` add to the object (fight 3 = Hydross kill, players 1+2):

```ts
  gear: [
    {
      fightId: 3, playerId: 1, items: [
        { slot: 0, itemId: 24266, gemIds: [24030, 24030, 31867], permanentEnchantId: 29191 }, // Spellstrike Hood: 2 good gems + 1 cheap, enchanted
        { slot: 4, itemId: 21848, gemIds: [24030], permanentEnchantId: 1144 },                // Spellfire Robe: 1 of 2 gems, cheap enchant (id 1144 in badEnchants fixture sense)
        { slot: 8, itemId: 24250, gemIds: [] },                                               // Bracers of Havok: no enchant, 0 of 1 gem
        { slot: 14, itemId: 15138, gemIds: [], permanentEnchantId: 368 },                     // Onyxia Scale Cloak: excluded/fun item
        { slot: 10, itemId: 28227, gemIds: [] },                                              // Sha'tari ring (no enchant required)
      ],
    },
    {
      fightId: 3, playerId: 2, items: [
        { slot: 0, itemId: 29093, gemIds: [], permanentEnchantId: 29192 },   // no sockets, enchanted: clean
        { slot: 4, itemId: 29096, gemIds: [], permanentEnchantId: 1891 },
        { slot: 15, itemId: 28767, gemIds: [], permanentEnchantId: 2669 },
        { slot: 6, itemId: 30538, gemIds: [], permanentEnchantId: 3010 },    // Midnight Legguards w/ SR? no — plain
        { slot: 5, itemId: 30106, gemIds: [] },                              // Belt of the Black Eagle (has SR in item-shadow-res? no)
      ],
    },
  ],
  itemMeta: {
    "24266": { name: "Spellstrike Hood", quality: 4 },
    "21848": { name: "Spellfire Robe", quality: 4 },
    "24250": { name: "Bracers of Havok", quality: 3 },
    "15138": { name: "Onyxia Scale Cloak", quality: 4 },
    "28227": { name: "Sha'tari Vengeance Ring", quality: 3 },
    "29093": { name: "Mask of Penance", quality: 4 },
    "29096": { name: "Breastplate of Many Graces", quality: 4 },
    "28767": { name: "The Decapitator", quality: 4 },
    "30538": { name: "Midnight Legguards", quality: 4 },
    "30106": { name: "Belt of the Black Eagle", quality: 4 },
    "24030": { name: "Runed Living Ruby", quality: 3 },
    "31867": { name: "Great Golden Draenite", quality: 2 },
  },
```

NOTE for implementer: these item/gem ids are realistic but their socket counts must AGREE with `packages/data/json/item-sockets.json` for the Task 4 tests to behave. Before committing, check with `python3 -c "import json; d=json.load(open('packages/data/json/item-sockets.json')); print({k: d.get(k) for k in ['24266','21848','24250','29093']})"` and adjust the fixture's `gemIds` arrays (or swap item ids for ones present/absent in the DB) so that: item 24266 has 3 sockets filled with 3 gems (one uncommon), item 21848 has MORE sockets than gems provided (missing-gem case), item 24250 has ≥1 socket and 0 gems, and player 2's items have no sockets in the DB (clean). Report what you adjusted.

- [ ] **Step 6: Keep the repo green** — `apps/api/src/normalize.ts` must now produce the new required fields; add to the returned object (full wiring comes in Task 5):

```ts
    gear: [],
    itemMeta: {},
```

Run `cd "<repo>" && pnpm -r test` — all suites pass (62 + 4 new slots tests; api normalize tests unaffected because the new fields aren't asserted there yet).

- [ ] **Step 7: Commit**

```bash
git add packages/core apps/api/src/normalize.ts
git commit -m "feat(core): gear types, slot constants, gear fixture"
```

---

### Task 2: core — gearListing analysis

**Files:**
- Create: `packages/core/src/gearListing.ts`, `packages/core/src/gearListing.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Failing tests** — `packages/core/src/gearListing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gearListing, listGearFights } from "./gearListing";
import { reportFixture } from "./fixtures/report.fixture";

describe("listGearFights", () => {
  it("returns boss fights that have gear snapshots", () => {
    expect(listGearFights(reportFixture).map((f) => f.id)).toEqual([3]);
  });
});

describe("gearListing", () => {
  it("defaults to the last boss fight with gear", () => {
    const { fight, rows } = gearListing(reportFixture);
    expect(fight?.id).toBe(3);
    expect(rows).toHaveLength(2);
  });
  it("resolves item names per slot", () => {
    const { rows } = gearListing(reportFixture, 3);
    const p1 = rows.find((r) => r.playerName === "Playerone")!;
    expect(p1.items[0]?.name).toBe("Spellstrike Hood");
    expect(p1.items[14]?.name).toBe("Onyxia Scale Cloak");
    expect(p1.items[15]).toBeUndefined(); // no weapon recorded in fixture
  });
  it("falls back to the item id when meta is missing", () => {
    const report = structuredClone(reportFixture);
    delete (report.itemMeta as Record<string, unknown>)["24266"];
    const { rows } = gearListing(report, 3);
    expect(rows.find((r) => r.playerName === "Playerone")!.items[0]?.name).toBe("item 24266");
  });
  it("returns empty rows when the report has no gear", () => {
    const { fight, rows } = gearListing({ ...reportFixture, gear: [] });
    expect(fight).toBeNull();
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** — FAIL (module not found).

- [ ] **Step 3: Implement** — `packages/core/src/gearListing.ts`:

```ts
import type { Fight, ReportData } from "./types";

export interface ListedItem { itemId: number; name: string; }
export interface GearListingRow {
  playerId: number;
  playerName: string;
  /** keyed by slot id; absent slot = nothing equipped/recorded */
  items: Partial<Record<number, ListedItem>>;
}

export function itemName(report: ReportData, itemId: number): string {
  return report.itemMeta[String(itemId)]?.name ?? `item ${itemId}`;
}

/** Boss fights that have at least one gear snapshot, in fight order. */
export function listGearFights(report: ReportData): Fight[] {
  const withGear = new Set(report.gear.map((g) => g.fightId));
  return report.fights.filter((f) => f.isBoss && withGear.has(f.id));
}

export function gearListing(
  report: ReportData,
  fightId?: number,
): { fight: Fight | null; rows: GearListingRow[] } {
  const candidates = listGearFights(report);
  const fight = fightId !== undefined
    ? candidates.find((f) => f.id === fightId) ?? null
    : candidates[candidates.length - 1] ?? null;
  if (!fight) return { fight: null, rows: [] };

  const rows: GearListingRow[] = [];
  for (const snap of report.gear.filter((g) => g.fightId === fight.id)) {
    const player = report.players.find((p) => p.id === snap.playerId);
    if (!player) continue;
    const items: GearListingRow["items"] = {};
    for (const item of snap.items) {
      if (item.itemId === 0) continue;
      items[item.slot] = { itemId: item.itemId, name: itemName(report, item.itemId) };
    }
    rows.push({ playerId: player.id, playerName: player.name, items });
  }
  rows.sort((a, b) => a.playerName.localeCompare(b.playerName));
  return { fight, rows };
}
```

Add `export * from "./gearListing";` to `packages/core/src/index.ts`.

- [ ] **Step 4: Run** core tests — all pass.

- [ ] **Step 5: Commit** — `git add packages/core && git commit -m "feat(core): gear listing analysis"`

---

### Task 3: core — gearIssues analysis (enchants, empty slots, excluded items)

**Files:**
- Create: `packages/core/src/gearIssues.ts`, `packages/core/src/gearIssues.test.ts`
- Modify: `packages/core/src/index.ts`

This task implements the rule engine and three rule groups; Task 4 adds gem + SR rules to the same files. `@wcl/core` must NOT import `@wcl/data` (core stays dependency-free): the reference lists are passed in as an options object, wired by the web app in Task 7.

- [ ] **Step 1: Failing tests** — `packages/core/src/gearIssues.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gearIssues, type GearIssueConfig } from "./gearIssues";
import { reportFixture } from "./fixtures/report.fixture";

export const testConfig: GearIssueConfig = {
  minGemQuality: 3,
  excludeShahraz: false,
  listNoIssues: false,
  itemSockets: { "24266": 3, "21848": 2, "24250": 1 }, // aligned with fixture
  itemShadowRes: {},
  badEnchants: [{ enchantId: 1144, slot: 4, name: "Chest - 5 Mana" }],
  excludedItems: [{ itemId: 15138, name: "Onyxia Scale Cloak" }],
};

const issuesFor = (name: string, cfg = testConfig) =>
  gearIssues(reportFixture, cfg).find((r) => r.playerName === name)?.issues ?? [];

describe("gearIssues — enchants/slots/excluded", () => {
  it("flags missing enchants on enchantable slots only", () => {
    const p1 = issuesFor("Playerone");
    expect(p1).toContainEqual(expect.objectContaining({ itemId: 24250, issue: "no enchant" }));
    // ring (slot 10) must NOT be flagged
    expect(p1.find((i) => i.itemId === 28227)).toBeUndefined();
  });
  it("flags cheap/bad enchants by enchant id (slot-aware)", () => {
    expect(issuesFor("Playerone")).toContainEqual(
      expect.objectContaining({ itemId: 21848, issue: "cheap or bad enchant (Chest - 5 Mana)" }));
  });
  it("flags excluded/fun items", () => {
    expect(issuesFor("Playerone")).toContainEqual(
      expect.objectContaining({ itemId: 15138, issue: "useless/fun item" }));
  });
  it("flags empty required slots", () => {
    // Playerone's fixture has no weapon (slot 15), no neck (1) etc.
    expect(issuesFor("Playerone")).toContainEqual(
      expect.objectContaining({ issue: "no item on Weapon" }));
  });
  it("players with no issues are omitted unless listNoIssues", () => {
    const rows = gearIssues(reportFixture, { ...testConfig, itemSockets: {} });
    // Playertwo has full enchants and no other problems except empty slots…
    // (Playertwo's fixture lacks neck/rings/trinkets, so use a config-independent check:)
    expect(rows.every((r) => r.issues.length > 0)).toBe(true);
    const all = gearIssues(reportFixture, { ...testConfig, listNoIssues: true });
    expect(all).toHaveLength(2);
  });
  it("dedupes identical issues across multiple boss fights", () => {
    const report = structuredClone(reportFixture);
    report.gear.push({ ...report.gear[0]!, fightId: 5 }); // same gear on Lurker
    const p1 = gearIssues(report, testConfig).find((r) => r.playerName === "Playerone")!;
    const dupes = p1.issues.filter((i) => i.itemId === 24250 && i.issue === "no enchant");
    expect(dupes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run** — FAIL (module not found).

- [ ] **Step 3: Implement** — `packages/core/src/gearIssues.ts`:

```ts
import { ENCHANTABLE_SLOTS, QUALITY_NAMES, REQUIRED_SLOTS, SLOT_NAMES } from "./slots";
import { itemName } from "./gearListing";
import type { GearItem, ReportData } from "./types";

export interface GearIssueConfig {
  /** flag gems below this quality (1 common … 4 epic) */
  minGemQuality: number;
  /** skip Mother Shahraz fights entirely (SR gear is legitimate there) */
  excludeShahraz: boolean;
  /** include players that have zero issues in the result */
  listNoIssues: boolean;
  // reference data, injected so core stays dependency-free (@wcl/data wires these)
  itemSockets: Record<string, number>;
  itemShadowRes: Record<string, number>;
  badEnchants: { enchantId: number; slot: number | null; name: string }[];
  excludedItems: { itemId: number; name: string }[];
}

export interface GearIssue { itemId: number; itemName: string; issue: string; }
export interface PlayerGearIssues { playerId: number; playerName: string; issues: GearIssue[]; }

/** Boss names where shadow-resistance gear is legitimate, not "useless". */
const SR_FIGHT_NAMES = new Set(["Mother Shahraz", "Kaz'rogal", "Azgalor"]);
const SHAHRAZ = "Mother Shahraz";

export function gearIssues(report: ReportData, cfg: GearIssueConfig): PlayerGearIssues[] {
  const badEnchantById = new Map(cfg.badEnchants.map((e) => [e.enchantId, e]));
  const excludedById = new Map(cfg.excludedItems.map((i) => [i.itemId, i]));
  const fightById = new Map(report.fights.map((f) => [f.id, f]));

  const result: PlayerGearIssues[] = [];
  for (const player of report.players) {
    const seen = new Set<string>();
    const issues: GearIssue[] = [];
    const add = (itemId: number, issue: string) => {
      const key = `${itemId}|${issue}`;
      if (seen.has(key)) return;
      seen.add(key);
      issues.push({ itemId, itemName: itemId ? itemName(report, itemId) : "", issue });
    };

    for (const snap of report.gear) {
      if (snap.playerId !== player.id) continue;
      const fight = fightById.get(snap.fightId);
      if (!fight) continue;
      if (cfg.excludeShahraz && fight.name === SHAHRAZ) continue;

      const bySlot = new Map<number, GearItem>(
        snap.items.filter((i) => i.itemId !== 0).map((i) => [i.slot, i]));

      for (const slot of REQUIRED_SLOTS) {
        if (!bySlot.has(slot)) add(0, `no item on ${SLOT_NAMES[slot]}`);
      }

      for (const item of bySlot.values()) {
        if (excludedById.has(item.itemId)) add(item.itemId, "useless/fun item");
        checkEnchant(item, badEnchantById, add);
        checkGems(report, item, cfg, add);
        checkShadowRes(item, fight.name, cfg, add);
      }
    }
    if (issues.length > 0 || cfg.listNoIssues) {
      result.push({ playerId: player.id, playerName: player.name, issues });
    }
  }
  result.sort((a, b) => a.playerName.localeCompare(b.playerName));
  return result;
}

function checkEnchant(
  item: GearItem,
  badEnchantById: Map<number, { slot: number | null; name: string }>,
  add: (itemId: number, issue: string) => void,
): void {
  if (!ENCHANTABLE_SLOTS.has(item.slot)) return;
  if (item.permanentEnchantId === undefined) {
    add(item.itemId, "no enchant");
    return;
  }
  const bad = badEnchantById.get(item.permanentEnchantId);
  if (bad && (bad.slot === null || bad.slot === item.slot)) {
    add(item.itemId, `cheap or bad enchant (${bad.name})`);
  }
}

function checkGems(
  report: ReportData,
  item: GearItem,
  cfg: GearIssueConfig,
  add: (itemId: number, issue: string) => void,
): void {
  const sockets = cfg.itemSockets[String(item.itemId)] ?? 0;
  if (sockets === 0) return;
  const missing = sockets - item.gemIds.length;
  if (missing > 0) add(item.itemId, `missing gem(s) (${item.gemIds.length}/${sockets})`);
  for (const gemId of item.gemIds) {
    const quality = report.itemMeta[String(gemId)]?.quality;
    if (quality !== undefined && quality < cfg.minGemQuality) {
      // one entry per offending gem, like the original — bypass dedupe via counter suffix
      add(item.itemId, `${QUALITY_NAMES[quality] ?? "low-quality"} gem used`);
    }
  }
}

function checkShadowRes(
  item: GearItem,
  fightName: string,
  cfg: GearIssueConfig,
  add: (itemId: number, issue: string) => void,
): void {
  if (SR_FIGHT_NAMES.has(fightName)) return;
  if (cfg.itemShadowRes[String(item.itemId)] !== undefined) {
    add(item.itemId, "useless SR gear");
  }
}
```

NOTE: `checkGems`/`checkShadowRes` are referenced here and fully tested in Task 4 — implement them now as shown so this task compiles; Task 4 only ADDS tests (and fixes if its tests reveal bugs). The "one entry per offending gem" comment is aspirational — the dedupe means multiple same-quality gems on one item collapse to one issue line; that's an accepted simplification vs the original (which repeated rows), keep it.

Add `export * from "./gearIssues";` to `packages/core/src/index.ts`.

- [ ] **Step 4: Run** core tests — all pass.

- [ ] **Step 5: Commit** — `git add packages/core && git commit -m "feat(core): gear issues engine — enchants, empty slots, excluded items"`

---

### Task 4: core — gearIssues gem + shadow-resistance rules

**Files:**
- Modify: `packages/core/src/gearIssues.test.ts` (add a describe block)

- [ ] **Step 1: Add failing/pinning tests** to `packages/core/src/gearIssues.test.ts`:

```ts
import { reportFixture as fixture } from "./fixtures/report.fixture";

describe("gearIssues — gems", () => {
  it("flags items with unfilled sockets", () => {
    expect(issuesFor("Playerone")).toContainEqual(
      expect.objectContaining({ itemId: 21848, issue: "missing gem(s) (1/2)" }));
  });
  it("flags gems below the minimum quality", () => {
    // gem 31867 is quality 2 (uncommon) in the fixture itemMeta, min is 3
    expect(issuesFor("Playerone")).toContainEqual(
      expect.objectContaining({ itemId: 24266, issue: "uncommon gem used" }));
  });
  it("respects a lower minimum quality", () => {
    const p1 = issuesFor("Playerone", { ...testConfig, minGemQuality: 2 });
    expect(p1.find((i) => i.issue === "uncommon gem used")).toBeUndefined();
  });
  it("skips gems with unknown quality", () => {
    const report = structuredClone(fixture);
    delete (report.itemMeta as Record<string, unknown>)["31867"];
    const p1 = gearIssues(report, testConfig).find((r) => r.playerName === "Playerone")!;
    expect(p1.issues.find((i) => i.issue === "uncommon gem used")).toBeUndefined();
  });
});

describe("gearIssues — shadow resistance", () => {
  const srConfig: GearIssueConfig = {
    ...testConfig,
    itemShadowRes: { "29096": 20 }, // pretend Playertwo's chest has SR
  };
  it("flags SR gear on non-SR fights", () => {
    expect(issuesFor("Playertwo", srConfig)).toContainEqual(
      expect.objectContaining({ itemId: 29096, issue: "useless SR gear" }));
  });
  it("does not flag SR gear on SR fights", () => {
    const report = structuredClone(fixture);
    report.fights = report.fights.map((f) => (f.id === 3 ? { ...f, name: "Mother Shahraz" } : f));
    const rows = gearIssues(report, srConfig);
    const p2 = rows.find((r) => r.playerName === "Playertwo");
    expect(p2?.issues.find((i) => i.issue === "useless SR gear")).toBeUndefined();
  });
  it("excludeShahraz drops Shahraz snapshots entirely", () => {
    const report = structuredClone(fixture);
    report.fights = report.fights.map((f) => (f.id === 3 ? { ...f, name: "Mother Shahraz" } : f));
    const rows = gearIssues(report, { ...srConfig, excludeShahraz: true });
    expect(rows.find((r) => r.playerName === "Playertwo")).toBeUndefined();
  });
});
```

(Reuse `issuesFor` and `testConfig` from the existing test file — they're exported/in-scope at module level. Adjust imports as needed.)

- [ ] **Step 2: Run** — expect mostly PASS (rules were implemented in Task 3); fix any failures IN THE IMPLEMENTATION (not by weakening tests) and report what was wrong.

- [ ] **Step 3: Commit** — `git add packages/core && git commit -m "test(core): pin gem and shadow-resistance gear rules"`

---

### Task 5: api — fetch combatantInfo + item metadata, extend normalization

**Files:**
- Modify: `apps/api/src/wcl.ts`, `apps/api/src/wcl.test.ts`
- Modify: `apps/api/src/normalize.ts`, `apps/api/src/normalize.test.ts`

- [ ] **Step 1: Failing wcl tests** — append to `apps/api/src/wcl.test.ts`:

```ts
import { fetchCombatantInfo, fetchItemMeta } from "./wcl";

describe("fetchCombatantInfo", () => {
  const page = (events: unknown[], next: number | null) =>
    new Response(JSON.stringify({ data: { reportData: { report: { events: { data: events, nextPageTimestamp: next } } } } }), { status: 200 });

  it("collects combatantinfo events across pages", async () => {
    const e1 = { type: "combatantinfo", sourceID: 7, fight: 3, gear: [] };
    const e2 = { type: "combatantinfo", sourceID: 8, fight: 3, gear: [] };
    const mock = vi.fn()
      .mockResolvedValueOnce(page([e1], 12345))
      .mockResolvedValueOnce(page([e2], null));
    vi.stubGlobal("fetch", mock);
    const events = await fetchCombatantInfo("a1B2c3D4e5F6g7H8", "tok", [3, 5]);
    expect(events).toHaveLength(2);
    expect(mock).toHaveBeenCalledTimes(2);
    const vars2 = JSON.parse((mock.mock.calls[1]![1]!.body as string)).variables;
    expect(vars2.start).toBe(12345);
    expect(vars2.fightIds).toEqual([3, 5]);
  });
  it("filters out non-combatantinfo events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      page([{ type: "damage", sourceID: 1 }, { type: "combatantinfo", sourceID: 7, fight: 3, gear: [] }], null)));
    const events = await fetchCombatantInfo("a1B2c3D4e5F6g7H8", "tok", [3]);
    expect(events).toHaveLength(1);
  });
});

describe("fetchItemMeta", () => {
  it("batches ids into one aliased gameData query", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { gameData: {
        i0: { id: 24266, name: "Spellstrike Hood", quality: 4 },
        i1: { id: 31867, name: "Great Golden Draenite", quality: 2 },
        i2: null,
      } },
    }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const meta = await fetchItemMeta([24266, 31867, 99999], "tok");
    expect(meta["24266"]).toEqual({ name: "Spellstrike Hood", quality: 4 });
    expect(meta["99999"]).toBeUndefined();
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("retries without the quality field if WCL rejects it", async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: 'Cannot query field "quality"' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { gameData: { i0: { id: 24266, name: "Spellstrike Hood" } } } }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const meta = await fetchItemMeta([24266], "tok");
    expect(meta["24266"]).toEqual({ name: "Spellstrike Hood", quality: undefined });
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run** — FAIL (exports missing).

- [ ] **Step 3: Implement in `apps/api/src/wcl.ts`** (append; reuse the existing fetch/error style):

```ts
const COMBATANT_QUERY = `
query CombatantInfo($code: String!, $fightIds: [Int], $start: Float) {
  reportData {
    report(code: $code) {
      events(dataType: CombatantInfo, fightIDs: $fightIds, startTime: $start, endTime: 100000000000) {
        data
        nextPageTimestamp
      }
    }
  }
}`;

export interface RawGearEntry {
  id: number; slot: number; itemLevel?: number;
  permanentEnchant?: number; temporaryEnchant?: number;
  gems?: { id: number }[];
}
export interface RawCombatantInfo { sourceID: number; fight: number; gear: RawGearEntry[]; }

async function gql<T>(query: string, variables: Record<string, unknown>, accessToken: string): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new WclError(res.status, `WCL API request failed (${res.status})`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new WclError(502, json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new WclError(502, "Empty WCL response");
  return json.data;
}

export async function fetchCombatantInfo(
  code: string, accessToken: string, fightIds: number[],
): Promise<RawCombatantInfo[]> {
  const events: RawCombatantInfo[] = [];
  let start = 0;
  for (;;) {
    const data = await gql<{ reportData: { report: { events: { data: Record<string, unknown>[]; nextPageTimestamp: number | null } } } }>(
      COMBATANT_QUERY, { code, fightIds, start }, accessToken);
    const page = data.reportData.report.events;
    for (const e of page.data) {
      if (e.type === "combatantinfo") events.push(e as unknown as RawCombatantInfo);
    }
    if (page.nextPageTimestamp == null) break;
    start = page.nextPageTimestamp;
  }
  return events;
}

export async function fetchItemMeta(
  ids: number[], accessToken: string,
): Promise<Record<string, { name: string; quality?: number }>> {
  const meta: Record<string, { name: string; quality?: number }> = {};
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  for (const chunk of chunks) {
    const fields = (withQuality: boolean) =>
      chunk.map((id, i) => `i${i}: item(id: ${id}) { id name${withQuality ? " quality" : ""} }`).join("\n");
    let data: Record<string, { id: number; name: string; quality?: number } | null>;
    try {
      data = (await gql<{ gameData: typeof data }>(`{ gameData { ${fields(true)} } }`, {}, accessToken)).gameData;
    } catch (e) {
      // schema may not expose quality; retry name-only (documented fallback)
      if (e instanceof WclError && e.status === 502 && /quality/i.test(e.message)) {
        data = (await gql<{ gameData: typeof data }>(`{ gameData { ${fields(false)} } }`, {}, accessToken)).gameData;
      } else throw e;
    }
    for (const entry of Object.values(data)) {
      if (entry) meta[String(entry.id)] = { name: entry.name, quality: entry.quality };
    }
  }
  return meta;
}
```

Also refactor the EXISTING `fetchRawReport` to use the new `gql` helper (behavior identical; its tests must keep passing unchanged).

- [ ] **Step 4: Failing normalize tests** — append to `apps/api/src/normalize.test.ts`:

```ts
import type { RawCombatantInfo } from "./wcl";

describe("normalizeReport — gear", () => {
  const combatants: RawCombatantInfo[] = [
    { sourceID: 7, fight: 2, gear: [
      { id: 24266, slot: 0, permanentEnchant: 29191, gems: [{ id: 24030 }] },
      { id: 0, slot: 3 },         // empty shirt slot — dropped
    ] },
  ];
  const itemMeta = { "24266": { name: "Spellstrike Hood", quality: 4 } };

  it("maps combatant info onto GearSnapshots and itemMeta", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, combatants, itemMeta);
    expect(data.gear).toEqual([{
      fightId: 2, playerId: 7, items: [{
        slot: 0, itemId: 24266, itemLevel: undefined,
        permanentEnchantId: 29191, temporaryEnchantId: undefined, gemIds: [24030],
      }],
    }]);
    expect(data.itemMeta["24266"]?.name).toBe("Spellstrike Hood");
  });
  it("defaults to empty gear when not provided", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw);
    expect(data.gear).toEqual([]);
    expect(data.itemMeta).toEqual({});
  });
});
```

- [ ] **Step 5: Implement** — change `normalizeReport` signature in `apps/api/src/normalize.ts`:

```ts
export function normalizeReport(
  reportId: string,
  raw: RawReport,
  combatants: RawCombatantInfo[] = [],
  itemMeta: Record<string, ItemMeta> = {},
): ReportData {
```

and replace the placeholder fields with:

```ts
    gear: combatants.map((c) => ({
      fightId: c.fight,
      playerId: c.sourceID,
      items: (c.gear ?? [])
        .filter((g) => g.id !== 0)
        .map((g) => ({
          slot: g.slot,
          itemId: g.id,
          itemLevel: g.itemLevel,
          permanentEnchantId: g.permanentEnchant,
          temporaryEnchantId: g.temporaryEnchant,
          gemIds: (g.gems ?? []).map((gem) => gem.id),
        })),
    })),
    itemMeta,
```

(import `RawCombatantInfo` from "./wcl" and `ItemMeta` from "@wcl/core").

- [ ] **Step 6: Run** `cd "<repo>/apps/api" && pnpm test` — all pass (21 prior + 4 wcl + 2 normalize = 27).

- [ ] **Step 7: Commit** — `git add apps/api && git commit -m "feat(api): combatantInfo + item metadata fetch, gear normalization"`

---

### Task 6: api — wire gear into the report route

**Files:**
- Modify: `apps/api/src/app.ts`, `apps/api/src/app.test.ts`

- [ ] **Step 1: Failing test** — append to `apps/api/src/app.test.ts`:

```ts
import type { RawCombatantInfo } from "./wcl";

describe("GET /api/report/:id — gear", () => {
  const rawWithBoss: RawReport = {
    ...raw,
    fights: [
      { id: 1, name: "Trash", encounterID: 0, kill: null, startTime: 0, endTime: 1 },
      { id: 2, name: "Attumen the Huntsman", encounterID: 652, kill: true, startTime: 2, endTime: 3 },
    ],
  };
  const combatants: RawCombatantInfo[] = [
    { sourceID: 7, fight: 2, gear: [{ id: 24266, slot: 0, gems: [{ id: 31867 }] }] },
  ];

  it("fetches combatant info for boss fights and resolves item meta", async () => {
    const fetchCombatantInfo = vi.fn().mockResolvedValue(combatants);
    const fetchItemMeta = vi.fn().mockResolvedValue({ "24266": { name: "Spellstrike Hood", quality: 4 } });
    const app = makeApp({
      fetchRawReport: vi.fn().mockResolvedValue(rawWithBoss),
      fetchCombatantInfo, fetchItemMeta,
    });
    const res = await app.request("/api/report/a1B2c3D4e5F6g7H8", { headers: { Authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.gear).toHaveLength(1);
    expect(body.data.itemMeta["24266"].name).toBe("Spellstrike Hood");
    expect(fetchCombatantInfo).toHaveBeenCalledWith("a1B2c3D4e5F6g7H8", "tok", [2]); // boss fights only
    // item ids AND gem ids requested:
    expect(fetchItemMeta.mock.calls[0]![0]).toEqual(expect.arrayContaining([24266, 31867]));
  });
  it("serves the report even when combatant info fails", async () => {
    const app = makeApp({
      fetchRawReport: vi.fn().mockResolvedValue(rawWithBoss),
      fetchCombatantInfo: vi.fn().mockRejectedValue(new WclError(502, "boom")),
      fetchItemMeta: vi.fn(),
    });
    const res = await app.request("/api/report/a1B2c3D4e5F6g7H8", { headers: { Authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
    expect((await res.json()).data.gear).toEqual([]);
  });
});
```

Update `makeApp` defaults to include the two new deps:

```ts
    fetchCombatantInfo: vi.fn().mockResolvedValue([]),
    fetchItemMeta: vi.fn().mockResolvedValue({}),
```

- [ ] **Step 2: Run** — FAIL (AppDeps doesn't accept new keys).

- [ ] **Step 3: Implement in `apps/api/src/app.ts`:** extend `AppDeps` and the default:

```ts
export interface AppDeps {
  fetchToken: typeof realFetchToken;
  fetchRawReport: typeof realFetchRawReport;
  fetchCombatantInfo: typeof realFetchCombatantInfo;
  fetchItemMeta: typeof realFetchItemMeta;
  cacheTtlMs: number;
}
```

and replace the GET handler's fetch block with:

```ts
    try {
      const rawReport = await deps.fetchRawReport(id, token);
      const bossFightIds = rawReport.fights.filter((f) => f.encounterID !== 0).map((f) => f.id);
      let combatants: RawCombatantInfo[] = [];
      let itemMeta: Record<string, ItemMeta> = {};
      if (bossFightIds.length > 0) {
        // gear is best-effort: a failure here must not take down the whole report
        try {
          combatants = await deps.fetchCombatantInfo(id, token, bossFightIds);
          const ids = new Set<number>();
          for (const c of combatants) for (const g of c.gear ?? []) {
            if (g.id !== 0) ids.add(g.id);
            for (const gem of g.gems ?? []) ids.add(gem.id);
          }
          if (ids.size > 0) itemMeta = await deps.fetchItemMeta([...ids], token);
        } catch {
          combatants = [];
          itemMeta = {};
        }
      }
      const data = normalizeReport(id, rawReport, combatants, itemMeta);
      cache.set(id, data);
      return c.json({ data, cachedAt: cache.get(id)!.cachedAt });
    } catch (e) {
      return toErrorResponse(c, e);
    }
```

(imports: `RawCombatantInfo`, `fetchCombatantInfo as realFetchCombatantInfo`, `fetchItemMeta as realFetchItemMeta` from "./wcl"; `ItemMeta` from "@wcl/core".)

- [ ] **Step 4: Run** apps/api tests — all pass (29).

- [ ] **Step 5: Commit** — `git add apps/api && git commit -m "feat(api): include gear snapshots and item metadata in report payload"`

---

### Task 7: web — report tabs + Gear Listing view

**Files:**
- Create: `apps/web/src/components/GearListingView.tsx`, `apps/web/src/components/GearListingView.test.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx`, `apps/web/src/index.css` (tab styles, a few lines)

- [ ] **Step 1: Failing test** — `apps/web/src/components/GearListingView.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { GearListingView } from "./GearListingView";

afterEach(cleanup);

describe("GearListingView", () => {
  it("renders the gear table for the default fight", () => {
    render(<GearListingView report={reportFixture} />);
    expect(screen.getByText("Spellstrike Hood")).toBeTruthy();
    expect(screen.getByText("Playerone")).toBeTruthy();
    // fight selector shows the boss fight
    expect((screen.getByLabelText("boss fight") as HTMLSelectElement).value).toBe("3");
  });
  it("shows a notice when the report has no gear data", () => {
    render(<GearListingView report={{ ...reportFixture, gear: [] }} />);
    expect(screen.getByText(/no gear data/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run** — FAIL (module not found).

- [ ] **Step 3: Implement** — `apps/web/src/components/GearListingView.tsx`:

```tsx
import { useMemo, useState } from "react";
import { gearListing, listGearFights, LISTING_SLOTS, SLOT_NAMES, type ReportData } from "@wcl/core";

export function GearListingView({ report }: { report: ReportData }) {
  const fights = useMemo(() => listGearFights(report), [report]);
  const [fightId, setFightId] = useState<number | undefined>(undefined);
  const { fight, rows } = useMemo(() => gearListing(report, fightId), [report, fightId]);

  if (!fight) {
    return <p>No gear data in this report (combatantInfo missing — loggers may have been too far from the boss at pull).</p>;
  }
  return (
    <div>
      <label>
        Boss fight:{" "}
        <select aria-label="boss fight" value={fight.id}
          onChange={(e) => setFightId(Number(e.target.value))}>
          {fights.map((f) => (
            <option key={f.id} value={f.id}>{f.name} ({f.kill ? "kill" : "wipe"})</option>
          ))}
        </select>
      </label>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>player</th>
              {LISTING_SLOTS.map((s) => <th key={s}>{SLOT_NAMES[s]}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId}>
                <td>{r.playerName}</td>
                {LISTING_SLOTS.map((s) => <td key={s}>{r.items[s]?.name ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add tabs to `apps/web/src/pages/ReportPage.tsx`** — replace the final return with:

```tsx
  return (
    <div>
      {loadCredentials() !== null && (
        <button onClick={() => refreshReport(reportId).then(setResult).catch((e) =>
          setError(e instanceof ApiError ? e : new ApiError(500, String(e))))}>
          Refresh from WCL
        </button>
      )}
      <nav className="tabs">
        {(["summary", "gear issues", "gear listing"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === "summary" && <ReportSummary report={result.data} cachedAt={result.cachedAt} />}
      {tab === "gear issues" && <GearIssuesView report={result.data} />}
      {tab === "gear listing" && <GearListingView report={result.data} />}
    </div>
  );
```

with state `const [tab, setTab] = useState<"summary" | "gear issues" | "gear listing">("summary");` and the imports. `GearIssuesView` comes in Task 8 — for THIS task create it as the real file there? No: to keep the repo green commit Task 7 with only two tabs ("summary", "gear listing") and let Task 8 add the third. Keep the union type and nav array at two entries for now.

Add to `apps/web/src/index.css`:

```css
.tabs { margin: 1rem 0; display: flex; gap: 0.5rem; }
.tabs button.active { font-weight: bold; text-decoration: underline; }
.scroll-x { overflow-x: auto; }
```

- [ ] **Step 5: Run** `cd "<repo>/apps/web" && pnpm test` and `pnpm --filter @wcl/web build` — green/clean.

- [ ] **Step 6: Commit** — `git add apps/web && git commit -m "feat(web): report tabs and gear listing view"`

---

### Task 8: web — Gear Issues view (with settings) + third tab

**Files:**
- Create: `apps/web/src/components/GearIssuesView.tsx`, `apps/web/src/components/GearIssuesView.test.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx` (add third tab)

- [ ] **Step 1: Failing test** — `apps/web/src/components/GearIssuesView.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { GearIssuesView } from "./GearIssuesView";

afterEach(cleanup);

describe("GearIssuesView", () => {
  it("lists players with their gear issues", () => {
    render(<GearIssuesView report={reportFixture} />);
    expect(screen.getByText("Playerone")).toBeTruthy();
    expect(screen.getAllByText(/no enchant/).length).toBeGreaterThan(0);
  });
  it("min gem quality select changes flagged gems", () => {
    render(<GearIssuesView report={reportFixture} />);
    expect(screen.getAllByText(/uncommon gem used/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("minimum gem quality"), { target: { value: "2" } });
    expect(screen.queryAllByText(/uncommon gem used/).length).toBe(0);
  });
});
```

NOTE: this test depends on the fixture gemIds aligning with the REAL `@wcl/data` socket DB (the view wires real data). Verify with the Task 1 fixture-alignment check; if item 24266's real socket count ≠ 3, adjust the fixture (preferred) — never the data.

- [ ] **Step 2: Run** — FAIL (module not found).

- [ ] **Step 3: Implement** — `apps/web/src/components/GearIssuesView.tsx`:

```tsx
import { useMemo, useState } from "react";
import { gearIssues, QUALITY_NAMES, type GearIssueConfig, type ReportData } from "@wcl/core";
import { badEnchants, excludedItems, itemShadowRes, itemSockets } from "@wcl/data";

export function GearIssuesView({ report }: { report: ReportData }) {
  const [minGemQuality, setMinGemQuality] = useState(3);
  const [excludeShahraz, setExcludeShahraz] = useState(false);
  const [listNoIssues, setListNoIssues] = useState(false);

  const rows = useMemo(() => {
    const cfg: GearIssueConfig = {
      minGemQuality, excludeShahraz, listNoIssues,
      itemSockets, itemShadowRes, badEnchants, excludedItems,
    };
    return gearIssues(report, cfg);
  }, [report, minGemQuality, excludeShahraz, listNoIssues]);

  if (report.gear.length === 0) {
    return <p>No gear data in this report (combatantInfo missing — loggers may have been too far from the boss at pull).</p>;
  }
  return (
    <div>
      <fieldset>
        <legend>Settings</legend>
        <label>
          minimum gem quality:{" "}
          <select aria-label="minimum gem quality" value={minGemQuality}
            onChange={(e) => setMinGemQuality(Number(e.target.value))}>
            {[2, 3, 4].map((q) => <option key={q} value={q}>{QUALITY_NAMES[q]}</option>)}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={excludeShahraz}
            onChange={(e) => setExcludeShahraz(e.target.checked)} />
          exclude Mother Shahraz
        </label>
        <label>
          <input type="checkbox" checked={listNoIssues}
            onChange={(e) => setListNoIssues(e.target.checked)} />
          list players with no issues
        </label>
      </fieldset>
      <p><small>Gear is only recorded at the start of boss fights. Issues are aggregated across all boss fights in the report.</small></p>
      <table>
        <thead><tr><th>player</th><th>issues</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId}>
              <td>{r.playerName}</td>
              <td>
                <ul className="issues">
                  {r.issues.map((i, idx) => (
                    <li key={idx}>{i.itemName ? `${i.itemName} ` : ""}[{i.issue}]</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Add the third tab in `ReportPage.tsx` (extend the union + nav array + conditional render). Add `.issues { margin: 0; padding-left: 1rem; }` to index.css.

- [ ] **Step 4: Run** web tests + build — green. Run `pnpm -r test` at root.

- [ ] **Step 5: Commit** — `git add apps/web && git commit -m "feat(web): gear issues view with audit settings"`

---

### Task 9: probe script + README + final verification

**Files:**
- Create: `apps/api/scripts/probe.ts`
- Modify: `README.md`, `apps/api/package.json` (probe script entry)

- [ ] **Step 1: Probe script** — `apps/api/scripts/probe.ts` (run manually by the user; validates the WCL schema assumptions against reality):

```ts
/**
 * One-shot schema probe. Usage:
 *   WCL_CLIENT_ID=xxx WCL_CLIENT_SECRET=yyy pnpm --filter @wcl/api probe <reportCode>
 * Prints fight list, one raw combatantinfo event, and a gameData item lookup,
 * so the shapes assumed in wcl.ts can be verified against the live API.
 */
import { fetchCombatantInfo, fetchItemMeta, fetchRawReport, fetchToken } from "../src/wcl";

const code = process.argv[2];
const { WCL_CLIENT_ID, WCL_CLIENT_SECRET } = process.env;
if (!code || !WCL_CLIENT_ID || !WCL_CLIENT_SECRET) {
  console.error("usage: WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api probe <reportCode>");
  process.exit(1);
}

const token = (await fetchToken(WCL_CLIENT_ID, WCL_CLIENT_SECRET)).accessToken;
const report = await fetchRawReport(code, token);
console.log("zone:", report.zone?.name, "| fights:", report.fights.length);

const bossIds = report.fights.filter((f) => f.encounterID !== 0).map((f) => f.id);
const combatants = await fetchCombatantInfo(code, token, bossIds.slice(0, 1));
console.log(`combatantinfo events for fight ${bossIds[0]}: ${combatants.length}`);
console.dir(combatants[0], { depth: 4 });

const firstItem = combatants[0]?.gear.find((g) => g.id !== 0);
if (firstItem) {
  console.log("item meta:", await fetchItemMeta([firstItem.id], token));
}
```

Add to `apps/api/package.json` scripts: `"probe": "tsx scripts/probe.ts"`.

- [ ] **Step 2: README** — add under "Use":

```markdown
### Gear analyses (M2)

The report page has three tabs: summary, gear issues, gear listing. Gear is
read from WCL combatantInfo (recorded at boss-pull only; some T6 fights miss
it). Reports cached before M2 lack gear — hit "Refresh from WCL".

To verify the WCL schema assumptions against the live API once:

    WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api probe <reportCode>
```

- [ ] **Step 3: Full verification** — `pnpm -r test` (expect ~80 tests, all green), `pnpm --filter @wcl/web build` (clean). Start `pnpm dev` briefly and confirm the API still boots.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: M2 probe script and docs"`

---

## Out of scope (future plans)

- M2 deferred rules: inactive meta gems, role-dependent hit-gear checks, vs-undead/demon items, riding/slowfall/engi gear.
- M3: consumables + drums (extends the same combatantInfo/auras + buff-table fetching).
- Cache versioning: old cached payloads lack `gear` — TTL (24h) plus manual refresh covers M1→M2 transition; no migration code.

## Verification (user, with real credentials)

1. `pnpm dev`, load a TBC report (use Refresh if it was cached pre-M2).
2. Gear listing tab: pick different bosses, check names/slots against WCL's own gear pane.
3. Gear issues tab: spot-check a few flagged players against the WCL report; toggle min gem quality and watch uncommon-gem flags appear/disappear.
4. Run the probe script once and compare its dumped combatantinfo shape with `RawCombatantInfo` in `apps/api/src/wcl.ts` — report discrepancies.
