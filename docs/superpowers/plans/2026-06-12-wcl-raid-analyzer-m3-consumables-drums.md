# M3 — CLA Consumables + Drums Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the CLA `buff consumables` and `drums` tabs: per-player consumable uptimes on boss fights and drum-effectiveness scores, with severity color coding.

**Architecture:** Same layering as M2 — `packages/data` gains hand-curated TBC consumable/drum spell-id sets (NOT in the xlsx; the lists lived in the original's Apps Script, so we define and document our own). `apps/api` fetches buff events + drum cast events from WCL v2 and normalizes them into `ReportData` (`buffs` intervals seeded from combatantInfo pull-auras, `drumCasts`, `drumApplications`). `packages/core` gets two pure analyses (`consumables.ts`, `drums.ts`). `apps/web` gets two new tabs reusing the severity color convention (`sev-*` classes + `<SeverityLegend />`).

**Tech Stack:** TypeScript pnpm monorepo: Hono API, React 19 + Vite, vitest.

**Reverse-engineered formulas (from `/tmp/wow_dump/CLA__buff_consumables.txt` and `CLA__drums.txt`; regenerate dump per CLAUDE.md if missing):**
- Category uptime = (time a buff of the category is active during boss fights) / (total boss-fight time), shown 0–1.
- `Elixir or Flask` = uptime of the **union** of battle elixir + guardian elixir + flask intervals.
- `total average (excl. Scrolls)` = mean of (`Elixir or Flask`, `Food Buff`, `Weapon Enhancement`) **where Weapon Enhancement is skipped when it is 0** (verified against all 25 sample rows, e.g. Player5: (0.2+0.83)/2 = 0.515 ✓; Player13: (0+1+1)/3 = 0.667 ✓).
- Drums `weighted score` = total successful buff applications = round(casts × ⌀ buffs) (verified on all 7 sample rows).
- Drums "on Tinnitus" = casts that buffed 0 targets (the sheet's own note: "pointless casts and drums were applied to 0 targets"). We detect: a drum cast with no matching drum-buff application from the same source within 1500 ms.
- `Weapon Enhancement` uptime: derived from gear snapshots — Σ duration(boss fights where the weapon, slot 15, has a `temporaryEnchantId`) / Σ duration(boss fights that have a gear snapshot for the player). **Our formula, documented, not claimed as parity.**

**Data caveat:** consumable spell ids are curated by us. Every id MUST be verified against Wowhead TBC (`https://www.wowhead.com/tbc/spell=<id>`) during Task 1. Where a verification fails, fix the id and note it in the commit message.

---

### Task 1: Curated consumable & drum spell-id sets in `packages/data`

**Files:**
- Create: `packages/data/src/consumables.ts`
- Modify: `packages/data/src/index.ts` (re-export)
- Test: `packages/data/src/data.test.ts` (append)

This is hand-curated reference data (the xlsx only contains UI strings — verified: `grep -i elixir /tmp/wow_dump/CLA__trans.txt` shows labels only).

- [ ] **Step 1: Write the failing test** (append to `packages/data/src/data.test.ts`)

```ts
import { consumableBuffs, drumSpells, jcNecks, suboptimalConsumables } from "./index";

describe("consumable reference data", () => {
  it("classifies buffs into the CLA categories", () => {
    const categories = new Set(consumableBuffs.map((b) => b.category));
    expect(categories).toEqual(new Set(["battleElixir", "guardianElixir", "flask", "food", "scroll"]));
    // spot checks
    expect(consumableBuffs.find((b) => b.spellId === 28497)?.category).toBe("battleElixir"); // Elixir of Major Agility
    expect(consumableBuffs.find((b) => b.spellId === 28520)?.category).toBe("flask"); // Relentless Assault
  });
  it("scroll entries carry type and level", () => {
    const agi5 = consumableBuffs.find((b) => b.scroll?.type === "Agi" && b.scroll.level === 5);
    expect(agi5).toBeDefined();
  });
  it("drum spells distinguish greater/lesser and map cast->buff", () => {
    expect(drumSpells.some((d) => d.kind === "battle" && d.greater)).toBe(true);
    expect(drumSpells.some((d) => d.kind === "battle" && !d.greater)).toBe(true);
    for (const d of drumSpells) expect(d.buffId).toBeGreaterThan(0);
  });
  it("JC necks map item id to on-use buff id", () => {
    expect(jcNecks.length).toBeGreaterThanOrEqual(4);
    for (const n of jcNecks) { expect(n.itemId).toBeGreaterThan(0); expect(n.buffId).toBeGreaterThan(0); }
  });
});
```

- [ ] **Step 2: Run it** — `pnpm --filter @wcl/data test` — expect FAIL (exports missing).

- [ ] **Step 3: Create `packages/data/src/consumables.ts`** with the structure below. The id values shown are best-effort starting points — **verify EVERY id on Wowhead TBC via WebFetch before committing**, fixing as needed (search `https://www.wowhead.com/tbc/search?q=<name>` if a direct id looks wrong). These are buff (aura) ids as they appear in combat logs, not item ids.

```ts
/**
 * TBC consumable buff (aura) spell ids, hand-curated for the consumables tab.
 * NOT extracted from the xlsx (the original kept these in its Apps Script).
 * Every id verified against wowhead.com/tbc on 2026-06-12.
 */
export type ConsumableCategory = "battleElixir" | "guardianElixir" | "flask" | "food" | "scroll";
export type ScrollType = "Agi" | "Int" | "Prot" | "Spi" | "Sta" | "Str";

export interface ConsumableBuff {
  spellId: number;
  name: string;
  category: ConsumableCategory;
  scroll?: { type: ScrollType; level: number };
}

export const consumableBuffs: ConsumableBuff[] = [
  // --- battle elixirs ---
  { spellId: 28490, name: "Elixir of Major Strength", category: "battleElixir" },
  { spellId: 28491, name: "Elixir of Healing Power", category: "battleElixir" },
  { spellId: 28493, name: "Elixir of Major Frost Power", category: "battleElixir" },
  { spellId: 28497, name: "Elixir of Major Agility", category: "battleElixir" },
  { spellId: 28501, name: "Elixir of Major Firepower", category: "battleElixir" },
  { spellId: 28503, name: "Elixir of Major Shadow Power", category: "battleElixir" },
  { spellId: 33720, name: "Onslaught Elixir", category: "battleElixir" },
  { spellId: 33721, name: "Adept's Elixir", category: "battleElixir" },
  { spellId: 33726, name: "Elixir of Mastery", category: "battleElixir" },
  { spellId: 38954, name: "Fel Strength Elixir", category: "battleElixir" },
  { spellId: 17539, name: "Greater Arcane Elixir", category: "battleElixir" },
  { spellId: 11406, name: "Elixir of Demonslaying", category: "battleElixir" },
  // --- guardian elixirs ---
  { spellId: 28502, name: "Elixir of Major Defense", category: "guardianElixir" },
  { spellId: 28509, name: "Elixir of Major Mageblood", category: "guardianElixir" },
  { spellId: 39625, name: "Elixir of Major Fortitude", category: "guardianElixir" },
  { spellId: 39626, name: "Earthen Elixir", category: "guardianElixir" },
  { spellId: 39627, name: "Elixir of Draenic Wisdom", category: "guardianElixir" },
  { spellId: 39628, name: "Elixir of Ironskin", category: "guardianElixir" },
  // --- flasks (TBC + Shattrath + Unstable + usable vanilla) ---
  { spellId: 28518, name: "Flask of Fortification", category: "flask" },
  { spellId: 28519, name: "Flask of Mighty Restoration", category: "flask" },
  { spellId: 28520, name: "Flask of Relentless Assault", category: "flask" },
  { spellId: 28521, name: "Flask of Blinding Light", category: "flask" },
  { spellId: 28540, name: "Flask of Pure Death", category: "flask" },
  { spellId: 42735, name: "Flask of Chromatic Wonder", category: "flask" },
  { spellId: 41608, name: "Shattrath Flask of Fortification", category: "flask" },
  { spellId: 41609, name: "Shattrath Flask of Mighty Restoration", category: "flask" },
  { spellId: 41610, name: "Shattrath Flask of Supreme Power", category: "flask" },
  { spellId: 41611, name: "Shattrath Flask of Relentless Assault", category: "flask" },
  { spellId: 46837, name: "Shattrath Flask of Pure Death", category: "flask" },
  { spellId: 46839, name: "Shattrath Flask of Blinding Light", category: "flask" },
  { spellId: 40567, name: "Unstable Flask of the Bandit", category: "flask" },
  { spellId: 40568, name: "Unstable Flask of the Elder", category: "flask" },
  { spellId: 40572, name: "Unstable Flask of the Beast", category: "flask" },
  { spellId: 40573, name: "Unstable Flask of the Physician", category: "flask" },
  { spellId: 40575, name: "Unstable Flask of the Soldier", category: "flask" },
  { spellId: 40576, name: "Unstable Flask of the Sorcerer", category: "flask" },
  { spellId: 17626, name: "Flask of the Titans", category: "flask" },
  { spellId: 17627, name: "Flask of Distilled Wisdom", category: "flask" },
  { spellId: 17628, name: "Flask of Supreme Power", category: "flask" },
  { spellId: 17629, name: "Flask of Chromatic Resistance", category: "flask" },
  // --- food (Well Fed variants; verify each) ---
  { spellId: 33256, name: "Well Fed (Roasted Clefthoof, +20 Str)", category: "food" },
  { spellId: 33259, name: "Well Fed (Grilled Mudfish, +20 Agi)", category: "food" },
  { spellId: 33261, name: "Well Fed (Warp Burger, +20 Agi)", category: "food" },
  { spellId: 33263, name: "Well Fed (Blackened Basilisk, +23 spell dmg)", category: "food" },
  { spellId: 33265, name: "Well Fed (Golden Fish Sticks, +44 healing)", category: "food" },
  { spellId: 33268, name: "Well Fed (generic, +20 Sta/Spi)", category: "food" },
  { spellId: 33272, name: "Well Fed (Spicy Crawdad, +30 Sta)", category: "food" },
  { spellId: 43722, name: "Enlightened (Skullfish Soup, +20 spell crit)", category: "food" },
  { spellId: 43730, name: "Well Fed (Stamina/Spirit fish)", category: "food" },
  { spellId: 35272, name: "Well Fed (Sporeggar fish)", category: "food" },
  // --- scrolls (level 5 = TBC, lower levels flagged with *) ---
  { spellId: 33077, name: "Scroll of Agility V", category: "scroll", scroll: { type: "Agi", level: 5 } },
  { spellId: 33078, name: "Scroll of Intellect V", category: "scroll", scroll: { type: "Int", level: 5 } },
  { spellId: 33079, name: "Scroll of Protection V", category: "scroll", scroll: { type: "Prot", level: 5 } },
  { spellId: 33080, name: "Scroll of Spirit V", category: "scroll", scroll: { type: "Spi", level: 5 } },
  { spellId: 33081, name: "Scroll of Stamina V", category: "scroll", scroll: { type: "Sta", level: 5 } },
  { spellId: 33082, name: "Scroll of Strength V", category: "scroll", scroll: { type: "Str", level: 5 } },
  { spellId: 12174, name: "Scroll of Agility IV", category: "scroll", scroll: { type: "Agi", level: 4 } },
  { spellId: 12177, name: "Scroll of Intellect IV", category: "scroll", scroll: { type: "Int", level: 4 } },
  { spellId: 12175, name: "Scroll of Protection IV", category: "scroll", scroll: { type: "Prot", level: 4 } },
  { spellId: 12176, name: "Scroll of Spirit IV", category: "scroll", scroll: { type: "Spi", level: 4 } },
  { spellId: 12178, name: "Scroll of Stamina IV", category: "scroll", scroll: { type: "Sta", level: 4 } },
  { spellId: 12179, name: "Scroll of Strength IV", category: "scroll", scroll: { type: "Str", level: 4 } },
];

/** Drums: cast spell id -> buff id; `greater` distinguishes the TBC-Classic Greater versions. */
export interface DrumSpell {
  castId: number;
  buffId: number;
  kind: "battle" | "war" | "restoration" | "speed";
  greater: boolean;
  name: string;
}
export const drumSpells: DrumSpell[] = [
  { castId: 35476, buffId: 35476, kind: "battle", greater: false, name: "Drums of Battle" },
  { castId: 35475, buffId: 35475, kind: "war", greater: false, name: "Drums of War" },
  { castId: 35478, buffId: 35478, kind: "restoration", greater: false, name: "Drums of Restoration" },
  { castId: 35477, buffId: 35477, kind: "speed", greater: false, name: "Drums of Speed" },
  // TBC Classic "Greater" versions — VERIFY ids on wowhead.com/tbc (items 351355..?)
  { castId: 351355, buffId: 351355, kind: "battle", greater: true, name: "Greater Drums of Battle" },
  { castId: 351360, buffId: 351360, kind: "war", greater: true, name: "Greater Drums of War" },
  { castId: 351358, buffId: 351358, kind: "restoration", greater: true, name: "Greater Drums of Restoration" },
  { castId: 351359, buffId: 351359, kind: "speed", greater: true, name: "Greater Drums of Speed" },
];
export const TINNITUS_SPELL_ID = 36005;

/** TBC JC on-use absorb pendants: equipped neck item id -> on-use buff id. VERIFY all. */
export interface JcNeck { itemId: number; buffId: number; name: string; }
export const jcNecks: JcNeck[] = [
  { itemId: 25856, buffId: 31771, name: "Pendant of Frozen Flame" },
  { itemId: 25857, buffId: 31770, name: "Pendant of Thawing" },
  { itemId: 25858, buffId: 31769, name: "Pendant of Withering" },
  { itemId: 25859, buffId: 31768, name: "Pendant of Shadow's End" },
  { itemId: 25860, buffId: 31772, name: "Pendant of the Null Rune" },
];

/** Suboptimal things the original calls out by name (sample col L). */
export interface SuboptimalConsumable { kind: "buff" | "tempEnchant"; id: number; name: string; }
export const suboptimalConsumables: SuboptimalConsumable[] = [
  { kind: "buff", id: 28519, name: "Flask of Mighty Restoration" },
  { kind: "buff", id: 33268, name: "Well Fed" },             // generic stat food
  { kind: "buff", id: 43730, name: "Well Fed" },
  { kind: "buff", id: 2367, name: "Increased Intellect" },    // VERIFY: low-level int elixir buff
  { kind: "tempEnchant", id: 2628, name: "Superior Wizard Oil" },  // VERIFY enchant ids
  { kind: "tempEnchant", id: 2624, name: "Superior Mana Oil" },
];
```

- [ ] **Step 4: Verify ids.** For each block, WebFetch `https://www.wowhead.com/tbc/spell=<id>` (or search) and confirm the name matches; correct mismatches. Pay special attention to: Greater Drums (TBC-Classic additions), Shattrath flasks, JC pendant item/buff ids, suboptimal oil enchant ids, food buffs.
- [ ] **Step 5: Re-export from `packages/data/src/index.ts`:** append `export * from "./consumables";`
- [ ] **Step 6: Run tests** — `pnpm --filter @wcl/data test` — expect PASS.
- [ ] **Step 7: Commit** — `git commit -m "feat(data): curated TBC consumable & drum spell-id sets"`

---

### Task 2: Core types for buff intervals and drum events

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/fixtures/report.fixture.ts`
- Test: existing tests must stay green (fields are additive).

- [ ] **Step 1: Add to `packages/core/src/types.ts`:**

```ts
/** A buff active on a player, clamped to one fight's window (report-relative ms). */
export interface BuffInterval {
  fightId: number;
  targetId: number;
  spellId: number;
  startTime: number;
  endTime: number;
}

/** One drum cast by a player. */
export interface DrumCast { fightId: number; sourceId: number; spellId: number; timestamp: number; }

/** One drum-buff application (source = the drummer). */
export interface DrumApplication { fightId: number; sourceId: number; targetId: number; spellId: number; timestamp: number; }
```

and extend `ReportData` with three OPTIONAL fields (older cached reports won't have them — views must show a "refresh" notice when undefined):

```ts
  /** consumable/drum buff intervals on players (M3+); undefined = report cached before M3 */
  buffs?: BuffInterval[];
  drumCasts?: DrumCast[];
  drumApplications?: DrumApplication[];
```

- [ ] **Step 2: Extend the fixture** (`report.fixture.ts`). The fixture has fights 3 (boss `Morogrim Tidewalker`-like, check actual names/ids in the file first) and players 1/2. Add, using the fixture's real fight ids and durations:
  - Playerone: a flask interval covering the full boss fight, a food interval covering half of it.
  - Playertwo: a battle+guardian elixir pair covering the full fight, no food.
  - Drums: Playerone casts 2 battle drums in the boss fight: first at fight start with 3 applications (3 `DrumApplication` rows, sourceId 1, within 1500 ms of the cast), second cast 60 s later with 0 applications (= wasted/"on Tinnitus").
  Use spell ids from `@wcl/data`'s curated set BUT hard-code the numbers in the fixture (core must not import @wcl/data): flask 28520, food 33256, battle elixir 28497, guardian elixir 39627, drums 35476.
- [ ] **Step 3: Run all core tests** — `pnpm --filter @wcl/core test` — expect PASS (additive change).
- [ ] **Step 4: Commit** — `git commit -m "feat(core): buff interval and drum event types + fixture data"`

---

### Task 3: Core consumables analysis

**Files:**
- Create: `packages/core/src/consumables.ts`
- Create: `packages/core/src/consumables.test.ts`
- Modify: `packages/core/src/index.ts` (export)

**Config injection (same pattern as `GearIssueConfig` — core never imports @wcl/data):**

```ts
import type { BuffInterval, ReportData } from "./types";
import { SEVERITY_RANK, type IssueSeverity } from "./gearIssues";

export interface ConsumableConfig {
  buffs: { spellId: number; name: string; category: "battleElixir" | "guardianElixir" | "flask" | "food" | "scroll";
           scroll?: { type: string; level: number } }[];
  jcNecks: { itemId: number; buffId: number; name: string }[];
  suboptimal: { kind: "buff" | "tempEnchant"; id: number; name: string }[];
}

export interface ConsumableRow {
  playerId: number;
  playerName: string;
  /** all uptimes are 0–1 fractions of total boss-fight time */
  elixirOrFlask: number;
  battleElixir: number;
  guardianElixir: number;
  flask: number;
  food: number;
  /** e.g. "83% (Agi*,Prot)" — types used, * appended to a type used below level 5; "" if none */
  scrolls: string;
  scrollUptime: number;
  weaponEnhancement: number | null; // null = no gear snapshots at all
  jcNeck: { usedOnFights: number; inactiveOnFights: number; equipped: boolean };
  suboptimal: string[];   // distinct names
  totalAverage: number;   // mean(elixirOrFlask, food, weaponEnh) — weaponEnh skipped when 0/null
}
```

**Algorithm requirements (implement exactly):**
1. Boss fights only (`fight.isBoss`). `totalBossMs` = Σ (endTime − startTime). If `report.buffs` is undefined, return `null` (view shows refresh notice). If there are no boss fights, return `{ rows: [] }`.
2. For a set of spell ids, a player's uptime = merged-interval overlap with each boss fight window, summed, ÷ totalBossMs. Merge overlapping intervals before summing (a player can have two food buffs overlapping). Clamp intervals to fight windows.
3. `elixirOrFlask` = uptime of union(battle ∪ guardian ∪ flask ids).
4. Scrolls: uptime over all scroll ids; collect used types in alphabetical order, append `*` to a type when any scroll of that type used has level < 5. Format `"83% (Agi*,Prot)"` (rounded percent); `""`/0 when unused.
5. Weapon enhancement (from gear, NOT buffs): over boss fights that have a gear snapshot for the player: Σ duration(fights where slot-15 item has `temporaryEnchantId !== undefined`) ÷ Σ duration(those fights). `null` when the player has no snapshots.
6. JC neck: for each boss fight — equipped = neck (slot 1) item id ∈ jcNecks; used = any BuffInterval for the player in that fight whose spellId is the equipped neck's buffId. `usedOnFights` counts fights with use; `inactiveOnFights` counts fights equipped-but-not-used, **except on any fight whose name starts with "Kael'thas"** (original caveat).
7. `suboptimal`: distinct names where (a) a buff interval matches a `kind:"buff"` entry, or (b) any boss-fight gear snapshot's slot-15 `temporaryEnchantId` matches a `kind:"tempEnchant"` entry.
8. `totalAverage` = mean of elixirOrFlask, food, and weaponEnhancement, where weaponEnhancement is **excluded when it is 0 or null** (matches the original's sample data — see plan header).
9. Sort rows by playerName. Export also a severity helper used by both new tabs:

```ts
/** Uptime → severity: ≥0.9 fine (green), ≥0.5 moderate (yellow), else major (red). Our thresholds, documented. */
export function uptimeSeverity(uptime: number): IssueSeverity {
  return uptime >= 0.9 ? "minor" : uptime >= 0.5 ? "moderate" : "major";
}
```

- [ ] **Step 1: Write failing tests** (`consumables.test.ts`) using the fixture from Task 2 + a `testConsumableConfig` with the same hard-coded ids. Cover: full-fight flask → flask=1, battleElixir=0, elixirOrFlask=1; half-fight food → food≈0.5; totalAverage skipping weaponEnh when 0/null; merged overlapping intervals not double-counted (add a second overlapping food interval inline via structuredClone); `report.buffs === undefined` → null; uptimeSeverity boundaries (0.9 → minor, 0.5 → moderate, 0.49 → major).
- [ ] **Step 2: Run** — expect FAIL. **Step 3: Implement.** **Step 4: Run** — expect PASS.
- [ ] **Step 5: Export from `index.ts`**, run `pnpm --filter @wcl/core test`, commit `feat(core): consumables analysis`.

---

### Task 4: Core drums analysis

**Files:**
- Create: `packages/core/src/drums.ts`, `packages/core/src/drums.test.ts`
- Modify: `packages/core/src/index.ts`

```ts
export interface DrumConfig {
  drums: { castId: number; buffId: number; kind: "battle" | "war" | "restoration" | "speed";
           greater: boolean; name: string }[];
}
export interface DrumRow {
  playerId: number;
  playerName: string;
  battle: { casts: number; avgBuffs: number };       // avgBuffs = applications/casts for that kind
  war: { casts: number; avgBuffs: number };
  restoration: { casts: number; avgBuffs: number };
  wasted: number;        // casts with 0 applications within 1500ms ("on Tinnitus")
  total: number;         // all casts (battle+war+restoration+speed)
  avgBuffsPerDrum: number;   // total applications / total casts
  weightedScore: number;     // total applications (== round(casts × avg), verified on sample)
  lesserCasts: number;       // casts of non-greater versions
}
```

Rules: all fights (drums are used on trash too — the original drums tab has no boss-only note). Only players with ≥1 cast get a row. Applications are matched to a cast by same `sourceId` + same drum `buffId` + `timestamp` within `[cast, cast+1500ms]`; each application counts once (consume greedily in time order). Returns `null` when `report.drumCasts` is undefined. Sort by playerName.

- [ ] **Step 1: Failing tests** from the fixture: Playerone → battle.casts=2, applications=3, wasted=1, avgBuffsPerDrum=1.5, weightedScore=3, lesserCasts=2 (fixture uses non-greater 35476); player with no casts absent; undefined drumCasts → null.
- [ ] **Step 2–4: Red → implement → green.**
- [ ] **Step 5: Export, full core suite green, commit** `feat(core): drums analysis`.

---

### Task 5: API — fetch buff events and drum casts

**Files:**
- Modify: `apps/api/src/wcl.ts`
- Test: `apps/api/src/wcl.test.ts` (append)

- [ ] **Step 1: Failing tests** (same mock style as `fetchCombatantInfo` tests): `fetchBuffEvents` paginates and filters event types to `applybuff`/`removebuff`/`refreshbuff`; query contains `dataType: Buffs` and the filterExpression with the ids; `fetchCastEvents` filters to `type === "cast"` and contains `dataType: Casts`.
- [ ] **Step 2: Implement** in `wcl.ts` (reuse the existing pagination pattern INCLUDING the `nextPageTimestamp <= start` guard):

```ts
const EVENTS_QUERY = `
query Events($code: String!, $dataType: EventDataType!, $filter: String, $start: Float) {
  reportData {
    report(code: $code) {
      events(dataType: $dataType, filterExpression: $filter, startTime: $start, endTime: 100000000000) {
        data
        nextPageTimestamp
      }
    }
  }
}`;

export interface RawBuffEvent {
  timestamp: number; type: string; sourceID: number; targetID: number;
  abilityGameID: number; fight: number;
}
export interface RawCastEvent { timestamp: number; type: string; sourceID: number; abilityGameID: number; fight: number; }

async function fetchEvents(code: string, accessToken: string, dataType: string,
                           abilityIds: number[], keepTypes: Set<string>): Promise<Record<string, unknown>[]> {
  const filter = `ability.id IN (${abilityIds.join(", ")})`;
  const out: Record<string, unknown>[] = [];
  let start = 0;
  for (;;) {
    const data = await gql<{ reportData: { report: { events: { data: Record<string, unknown>[]; nextPageTimestamp: number | null } } } }>(
      EVENTS_QUERY, { code, dataType, filter, start }, accessToken);
    const page = data.reportData.report.events;
    for (const e of page.data) if (keepTypes.has(e.type as string)) out.push(e);
    if (page.nextPageTimestamp == null || page.nextPageTimestamp <= start) break;
    start = page.nextPageTimestamp;
  }
  return out;
}

export async function fetchBuffEvents(code: string, accessToken: string, abilityIds: number[]): Promise<RawBuffEvent[]> {
  if (abilityIds.length === 0) return [];
  return await fetchEvents(code, accessToken, "Buffs", abilityIds,
    new Set(["applybuff", "removebuff", "refreshbuff"])) as unknown as RawBuffEvent[];
}
export async function fetchCastEvents(code: string, accessToken: string, abilityIds: number[]): Promise<RawCastEvent[]> {
  if (abilityIds.length === 0) return [];
  return await fetchEvents(code, accessToken, "Casts", abilityIds, new Set(["cast"])) as unknown as RawCastEvent[];
}
```

Also extend `RawCombatantInfo` with pull auras (already inside the JSON blob WCL returns — just type it):

```ts
export interface RawAura { source: number; ability: number; name?: string; }
export interface RawCombatantInfo { sourceID: number; fight: number; gear: RawGearEntry[]; auras?: RawAura[]; }
```

- [ ] **Step 3: Green, commit** `feat(api): buff/cast event fetchers`.

---

### Task 6: API — normalize buffs/drums into ReportData and wire app.ts

**Files:**
- Modify: `apps/api/src/normalize.ts`, `apps/api/src/app.ts`
- Test: `apps/api/src/normalize.test.ts`, `apps/api/src/app.test.ts` (append)

**Interval building (in normalize):** events are time-ordered. Per (fight, target, spellId): `applybuff` opens an interval (ignore if already open; `refreshbuff` keeps it open); `removebuff` closes it — if none open, the buff was up since the pull → start at the fight's startTime. Any interval still open at the end closes at the fight's endTime. Additionally, **seed from combatantInfo pull-auras**: for each combatant event with `auras`, any aura whose `ability` is a tracked buff id opens an interval at that fight's start for `sourceID` (skip if the same (fight,target,spell) already gets an apply/remove pair starting at fight start — the dedupe rule: seeding only opens if no interval for that key starts at fight start). Drum applications: every `applybuff`/`refreshbuff` of a drum buff id becomes a `DrumApplication` (sourceID = drummer). Casts map 1:1 to `DrumCast`.

`normalizeReport` signature grows: `normalizeReport(reportId, raw, combatants = [], itemMeta = {}, buffEvents = [], castEvents = [], opts = { trackedBuffIds: [], drumBuffIds: [] })` — keep it backward compatible (all optional). When `buffEvents`/`castEvents` were never fetched (old behavior), set `buffs`/`drumCasts`/`drumApplications` to `[]` anyway — the route always fetches them now; `undefined` only appears in pre-M3 cached entries.

**app.ts wiring (inside the existing best-effort try/catch):** compute the id sets ONCE at module top from `@wcl/data` (`consumableBuffs`, `drumSpells`, `jcNecks`): tracked buff ids = consumable ids + drum buff ids + JC neck buff ids. Fetch `fetchBuffEvents(id, token, trackedIds)` and `fetchCastEvents(id, token, drumCastIds)` alongside combatantInfo. Add the two fetchers to `AppDeps` (DI for tests, same as existing).

- [ ] **Step 1: Failing normalize tests:** apply+remove → clamped interval; remove-without-apply → starts at fight start; never-removed → ends at fight end; combatantInfo aura seeding; drum cast/application mapping.
- [ ] **Step 2: Implement; existing normalize tests stay green.**
- [ ] **Step 3: Failing app test:** the report response carries `buffs`/`drumCasts` arrays; buff-fetch failure still returns the report (best-effort, arrays `[]`).
- [ ] **Step 4: Green, commit** `feat(api): normalize buff intervals and drum events`.

---

### Task 7: Web — consumables tab

**Files:**
- Create: `apps/web/src/components/ConsumablesView.tsx`, `apps/web/src/components/ConsumablesView.test.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx` (add tab `buff consumables`)

Columns exactly like the original (sample header row): player | total average (excl. Scrolls) | Elixir or Flask | Battle Elixir | Guardian Elixir | Flask | Food Buff | Scrolls | Weapon Enhancement | JC neck | suboptimal stuff found. Uptime cells: render 2-decimal value with `sev-*` class from `uptimeSeverity()` — but **Battle/Guardian/Flask columns are informational** (a flask user legitimately has 0 elixir uptime): only color `total average`, `Elixir or Flask`, `Food Buff`, `Weapon Enhancement` (skip when null → "-"). JC neck: `-` when never equipped; `N` when used; append ` — inactive on M fight(s)` colored `sev-moderate` when M>0. Suboptimal column: names joined with ", ", `sev-moderate` when non-empty. `<SeverityLegend />` + the original's caveat line ("Only bosses evaluated. Some T6 fights miss combatantInfo… Tip: loggers be close to the boss on fight start!"). When the analysis returns `null` (pre-M3 cache): show "This report was cached before consumable support — Refresh from WCL." When `rows` is empty: "No boss fights in this report."

Wire config from `@wcl/data` (like GearIssuesView does): `{ buffs: consumableBuffs, jcNecks, suboptimal: suboptimalConsumables }`.

- [ ] **Steps: failing component test (fixture renders Playerone flask=1.00 with sev-minor on Elixir-or-Flask cell; pre-M3 report → refresh notice), implement, green, commit** `feat(web): buff consumables tab`.

---

### Task 8: Web — drums tab

**Files:**
- Create: `apps/web/src/components/DrumsView.tsx`, `apps/web/src/components/DrumsView.test.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx` (add tab `drums`)

Columns: player | # of battle drums (rendered `N (⌀ X.YY)` when N>0) | # of war drums | # of restoration drums | # of drums on Tinnitus | # of drums total | buffs per drum (⌀) | weighted score. Severity: Tinnitus column `sev-major` when >0 (wasted casts); add a footnote when `lesserCasts > 0`: "Used the lesser version of these drums N times." with `sev-moderate`. Show "no drums used in this report" when rows empty; refresh notice when analysis is `null`. `<SeverityLegend />`.

- [ ] **Steps: failing test (fixture: Playerone row shows "2 (⌀ 1.5)", Tinnitus cell "1" with sev-major), implement, green, commit** `feat(web): drums tab`.

---

### Task 9: Docs + finish

- [ ] **Step 1:** README: add the two tabs to the features list; note the curated-spell-list caveat and that pre-M3 cached reports need a refresh.
- [ ] **Step 2:** `handoff.md`: mark M3 done, M4 next; note any spell ids that failed verification and were corrected.
- [ ] **Step 3:** Full suite `pnpm -r test` green; `pnpm --filter @wcl/web exec tsc -b` clean.
- [ ] **Step 4:** Commit docs, then final whole-branch review + `superpowers:finishing-a-development-branch`.

---

## Self-review notes

- Spec coverage: uptime columns ✓, scrolls with `*` ✓, weapon enhancement ✓, JC necks incl. Kael'thas caveat ✓, suboptimal names ✓, total average ✓, drums counts/⌀/Tinnitus/weighted/lesser ✓, severity colors per project convention ✓. NOT in M3 (per design): start–end/fight-id filter UI for these tabs (original supports it; our tabs analyze the whole report — defer to a later polish pass, the summary tab has filters).
- Type consistency: `IssueSeverity`/`SEVERITY_RANK` come from `gearIssues.ts`; `uptimeSeverity` lives in `consumables.ts` and is reused by both views.
- Known risk: curated spell ids (Task 1 Step 4 verification is mandatory); drum application→cast matching window (1500 ms) is our heuristic, documented in code.
