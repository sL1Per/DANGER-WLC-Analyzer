# M5a — Role Performance Breakdown (RPB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Role Performance Breakdown tab: auto-detect each player's role (Tank/Healer/Caster/Physical) with a per-character manual override, and show per-player universal performance metrics grouped by role.

**Architecture:** Two phases. **Phase 1** builds pure analysis in `@wcl/core` + reference data in `@wcl/data`, fully unit-tested against an extended (optional-field) `ReportData` — no I/O. **Phase 2** wires the API normalize layer to populate those fields from WCL (summary tables for cheap totals, events where needed) and adds the React tab + per-character role persistence, then verifies end-to-end against a real report. All new `ReportData` fields are optional so reports cached before M5 still load and the tab shows a refresh notice (same pattern as M3/M4).

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, React 19 + Vite, Hono, Python (data extraction), WCL v2 GraphQL.

**Spec:** `docs/superpowers/specs/2026-06-14-wcl-raid-analyzer-m5a-rpb-design.md`

---

## File structure

**`@wcl/data` (reference data):**
- Create `packages/data/scripts/extract_cast_times.py` — fetch + join wago.tools DB2s → cast-time JSON.
- Create `packages/data/json/spell-cast-times.json` — spell id → base cast time in deci-seconds.
- Create `packages/data/src/rpb.ts` — curated id sets: role signals, haste buffs, battle-shout, engineering, oil-of-immolation, absorb exclusions.
- Modify `packages/data/src/index.ts` — export the above.
- Modify `packages/data/src/data.test.ts` — smoke tests for the new data.

**`@wcl/core` (pure analysis):**
- Modify `packages/core/src/types.ts` — `Role`, new optional `ReportData` fields, event shapes.
- Create `packages/core/src/roles.ts` — `detectRole`.
- Create `packages/core/src/activity.ts` — activity metrics + spell-haste correction.
- Create `packages/core/src/rpb.ts` — universal-metric aggregation + `rpb()` orchestrator.
- Create `packages/core/src/roles.test.ts`, `activity.test.ts`, `rpb.test.ts`.
- Modify `packages/core/src/fixtures/report.fixture.ts` — add RPB sample data.
- Modify `packages/core/src/index.ts` — export `roles`, `activity`, `rpb`.

**`apps/api`:**
- Modify `apps/api/src/wcl.ts` — fetchers for interrupts, damage-taken events, player casts, player damage, and a summary-table fetch; raw types.
- Modify `apps/api/src/normalize.ts` — populate the new `ReportData` fields.
- Modify `apps/api/src/app.ts` — wire the new fetches + config ids.
- Modify `apps/api/src/normalize.test.ts`, `wcl.test.ts`, `app.test.ts`.

**`apps/web`:**
- Create `apps/web/src/components/RpbView.tsx` + `RpbView.test.tsx`.
- Modify `apps/web/src/lib/storage.ts` — per-character role persistence helpers.
- Modify `apps/web/src/pages/ReportPage.tsx` — register the `rpb` tab.

---

# Phase 1 — Reference data + pure core

## Task 1: Cast-time reference data + extraction script

**Files:**
- Create: `packages/data/scripts/extract_cast_times.py`
- Create: `packages/data/json/spell-cast-times.json`
- Modify: `packages/data/src/index.ts`
- Test: `packages/data/src/data.test.ts`

WCL cast events carry `abilityGameID`; activity needs each spell's base cast time. wago.tools exposes `SpellMisc` (`SpellID`, `CastingTimeIndex`) and `SpellCastTimes` (`ID`, `Base` ms) for build `2.5.4.44833`. Cast time (deci-seconds) = `SpellCastTimes.Base / 100` for the index a spell references. Instants (`Base = 0`) are omitted (they contribute 0 active seconds).

- [ ] **Step 1: Write the extraction script**

```python
# packages/data/scripts/extract_cast_times.py
"""Build spell-cast-times.json (spell id -> base cast time in deci-seconds) by
joining wago.tools SpellMisc.CastingTimeIndex -> SpellCastTimes.Base for TBC.

Usage: python3 packages/data/scripts/extract_cast_times.py
Writes packages/data/json/spell-cast-times.json. Re-run to refresh from wago.tools.
"""
import csv, io, json, os, urllib.request

BUILD = "2.5.4.44833"
BASE = "https://wago.tools/db2"
OUT = os.path.join(os.path.dirname(__file__), "..", "json", "spell-cast-times.json")


def fetch_csv(table):
    url = f"{BASE}/{table}/csv?build={BUILD}"
    with urllib.request.urlopen(url) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))


def main():
    cast_times = {row["ID"]: int(row["Base"]) for row in fetch_csv("SpellCastTimes")}
    out = {}
    for row in fetch_csv("SpellMisc"):
        idx = row.get("CastingTimeIndex")
        spell_id = row.get("SpellID")
        if not idx or not spell_id:
            continue
        base_ms = cast_times.get(idx)
        if not base_ms:           # index 0 / instant -> skip (0 active seconds)
            continue
        deci = round(base_ms / 100)
        if deci > 0:
            out[spell_id] = deci
    ordered = {k: out[k] for k in sorted(out, key=int)}
    with open(OUT, "w") as f:
        json.dump(ordered, f, separators=(",", ":"), sort_keys=False)
    print(f"wrote {len(ordered)} cast times to {OUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script to generate the JSON**

Run: `python3 packages/data/scripts/extract_cast_times.py`
Expected: prints `wrote NNNN cast times ...` (expect several thousand), creates `packages/data/json/spell-cast-times.json`. If wago.tools is unreachable, the task is blocked — note it and stop.

- [ ] **Step 3: Spot-verify a known value**

Run: `python3 -c "import json; d=json.load(open('packages/data/json/spell-cast-times.json')); print(len(d)); print(d.get('30451'))"`
Expected: a count > 1000, and `30451` (Arcane Blast, base 2.5s) prints `25`. If `30451` is absent or not `25`, the join is wrong — fix before continuing.

- [ ] **Step 4: Export from `@wcl/data`**

In `packages/data/src/index.ts`, add the import beside the other JSON imports and an export:

```typescript
import spellCastTimesJson from "../json/spell-cast-times.json";

/** spell id -> base cast time in deci-seconds (Base ms / 100), from wago.tools
 *  SpellMisc x SpellCastTimes for TBC 2.5.4. Used by activity() for active-time. */
export const spellCastTimes: Record<string, number> = spellCastTimesJson;
```

- [ ] **Step 5: Add a smoke test**

In `packages/data/src/data.test.ts`, append:

```typescript
import { spellCastTimes } from "./index";

describe("spellCastTimes", () => {
  it("has many rows and known cast times in deci-seconds", () => {
    expect(Object.keys(spellCastTimes).length).toBeGreaterThan(1000);
    expect(spellCastTimes["30451"]).toBe(25); // Arcane Blast = 2.5s
  });
});
```

(If `data.test.ts` already imports `describe`/`it`/`expect`, don't re-import.)

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @wcl/data test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/data/scripts/extract_cast_times.py packages/data/json/spell-cast-times.json packages/data/src/index.ts packages/data/src/data.test.ts
git commit -m "feat(data): TBC spell cast-time table for RPB activity"
```

---

## Task 2: Curated RPB id sets in `@wcl/data`

**Files:**
- Create: `packages/data/src/rpb.ts`
- Modify: `packages/data/src/index.ts`
- Test: `packages/data/src/data.test.ts`

Small hand-curated sets backing the universal metrics + role detection. Every id is TBC; comments cite the spell so reviewers can Wowhead-verify. These are starter sets — Task 13 (E2E) extends them against a real log.

- [ ] **Step 1: Write the data module**

```typescript
// packages/data/src/rpb.ts
import type { Role } from "@wcl/core";

/** A buff/cast id that strongly implies a role, used as a detection tiebreaker. */
export interface RoleSignal { spellId: number; role: Role; name: string; }

/** Auras/casts that disambiguate specs sharing a class (e.g. feral tank vs cat). */
export const roleSignals: RoleSignal[] = [
  { spellId: 71, role: "tank", name: "Defensive Stance" },
  { spellId: 25780, role: "tank", name: "Righteous Fury" },
  { spellId: 9634, role: "tank", name: "Dire Bear Form" },
  { spellId: 5487, role: "tank", name: "Bear Form" },
];

/** Haste buffs and the cast-speed bonus they grant, used to subtract spell-haste
 *  seconds in activity(). pct = fractional haste (0.3 = 30% faster casts). */
export interface HasteBuff { spellId: number; pct: number; name: string; }
export const hasteBuffs: HasteBuff[] = [
  { spellId: 2825, pct: 0.3, name: "Bloodlust" },
  { spellId: 32182, pct: 0.3, name: "Heroism" },
  { spellId: 10060, pct: 0.2, name: "Power Infusion" },
];

/** Battle Shout buff ids (max ranks); uptime "on you" is tracked in RPB. */
export const battleShoutBuffIds = [2048, 25289, 2048]; // Rank 8 = 2048, Rank 7 = 25289

/** Oil of Immolation proc damage spell id. */
export const oilOfImmolationSpellId = 11350;

/** Engineering damage ability ids (bombs/grenades/sappers). Starter set;
 *  extend during E2E. */
export const engineeringDamageIds = [
  30461, // The Bigger One
  30217, // Adamantite Grenade
  19821, // Arcane Bomb
  13241, // Goblin Sapper Charge
  30486, // Super Sapper Charge
];

/** Absorb spell ids excluded from "total absorbed" (e.g. self/raid shields the
 *  original does not attribute). Starter set; extend during E2E. */
export const absorbExcludedSpellIds: number[] = [];
```

- [ ] **Step 2: Export from `@wcl/data`**

In `packages/data/src/index.ts`, append:

```typescript
export * from "./rpb";
```

- [ ] **Step 3: Add a smoke test**

In `packages/data/src/data.test.ts`, append:

```typescript
import { roleSignals, hasteBuffs, engineeringDamageIds } from "./rpb";

describe("rpb curated data", () => {
  it("has role signals, haste buffs, and engineering ids", () => {
    expect(roleSignals.some((s) => s.spellId === 71 && s.role === "tank")).toBe(true);
    expect(hasteBuffs.find((h) => h.spellId === 2825)?.pct).toBe(0.3);
    expect(engineeringDamageIds.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run tests** — `pnpm --filter @wcl/data test` → PASS.
      (This task imports `Role` from `@wcl/core`; that type is added in Task 3. If running this task first, Task 3's type export must already exist — order Task 3 before this in execution, or stub `type Role` locally and replace. Recommended: execute Task 3 first.)

- [ ] **Step 5: Commit**

```bash
git add packages/data/src/rpb.ts packages/data/src/index.ts packages/data/src/data.test.ts
git commit -m "feat(data): curated RPB id sets (role signals, haste, engineering)"
```

---

## Task 3: Core types — Role + RPB `ReportData` fields

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts` (no change needed — it already re-exports `./types`; verify)

Define the role union, the per-player WCL summary totals used for detection, and the optional event arrays the universal metrics consume. All optional → pre-M5 caches degrade gracefully.

- [ ] **Step 1: Add the types**

Append to `packages/core/src/types.ts`:

```typescript
export type Role = "tank" | "healer" | "caster" | "physical";

/** Per-player aggregate output from WCL summary tables (whole report, boss
 *  fights), used by detectRole. All amounts are raw effective values. */
export interface PlayerTotals {
  playerId: number;
  healingDone: number;
  damageDone: number;
  damageTaken: number;
  /** portion of damageDone dealt with a magic school (not Physical) */
  magicDamageDone: number;
}

/** A boss-fight death of a player (Kalecgos already excluded upstream). */
export interface PlayerDeath { playerId: number; fightId: number; }

/** A player's spell that was interrupted (target = the player). */
export interface InterruptEvent {
  fightId: number;
  /** the player whose cast was interrupted */
  targetPlayerId: number;
  /** the spell that got interrupted */
  interruptedSpellId: number;
  /** display name of the interrupter (player or NPC) */
  sourceName: string;
}

/** A damage-taken event on a player, with classification flags. */
export interface DamageTakenEvent {
  fightId: number;
  targetPlayerId: number;
  abilityId: number;
  amount: number;
  /** true when the damage source is friendly (friendly fire / reflected setups) */
  fromFriendly: boolean;
}

/** A player's cast (for activity). */
export interface PlayerCast { fightId: number; playerId: number; spellId: number; timestamp: number; }

/** A player's outgoing damage instance (for AoE hit-counting + engineering/oil). */
export interface PlayerDamageEvent {
  fightId: number; sourceId: number; abilityId: number; targetId: number;
  amount: number; timestamp: number;
  /** true when the target is a hostile PLAYER (PvP; counted as self-damage in RPB) */
  targetHostilePlayer: boolean;
  /** true when the source is also the target (self/reflected) */
  selfInflicted: boolean;
}

/** An absorb credited to a player. */
export interface AbsorbEvent { fightId: number; playerId: number; spellId: number; amount: number; }
```

Then add the optional fields to the `ReportData` interface (insert before the closing `}` of `ReportData`, after `firstPullNpcIds`):

```typescript
  /** RPB (M5a+) — all optional; undefined = report cached before M5a (refresh notice). */
  playerTotals?: PlayerTotals[];
  playerDeaths?: PlayerDeath[];
  interrupts?: InterruptEvent[];
  damageTakenEvents?: DamageTakenEvent[];
  playerCasts?: PlayerCast[];
  playerDamage?: PlayerDamageEvent[];
  absorbs?: AbsorbEvent[];
```

- [ ] **Step 2: Verify core still builds**

Run: `pnpm --filter @wcl/core exec tsc --noEmit`
Expected: PASS (no usages yet).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): RPB types (Role + optional ReportData event fields)"
```

---

## Task 4: `detectRole` (hybrid heuristic)

**Files:**
- Create: `packages/core/src/roles.ts`
- Test: `packages/core/src/roles.test.ts`
- Modify: `packages/core/src/index.ts`

Order: aura/cast signal → output ratios → default Physical. Manual override is applied in the web layer (Task 12), not here — `detectRole` is the auto-detect only.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/roles.test.ts
import { describe, expect, it } from "vitest";
import { detectRole, type RoleConfig } from "./roles";
import type { PlayerTotals, ReportData, GearSnapshot } from "./types";

const cfg: RoleConfig = {
  signals: [
    { spellId: 71, role: "tank", name: "Defensive Stance" },
    { spellId: 5487, role: "tank", name: "Bear Form" },
  ],
};

function report(totals: PlayerTotals, gear: GearSnapshot[] = []): ReportData {
  return {
    reportId: "x", title: "", zoneName: "Black Temple", startTime: 0, endTime: 1,
    fights: [], players: [{ id: totals.playerId, name: "P", class: "Druid" }],
    gear, itemMeta: {}, playerTotals: [totals],
  };
}

describe("detectRole", () => {
  it("classifies a clear healer by healing share", () => {
    const t = { playerId: 1, healingDone: 900, damageDone: 100, damageTaken: 50, magicDamageDone: 100 };
    expect(detectRole(1, report(t), cfg)).toBe("healer");
  });

  it("classifies a caster when damage is mostly magic", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 950 };
    expect(detectRole(1, report(t), cfg)).toBe("caster");
  });

  it("classifies physical when damage is mostly physical", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 50 };
    expect(detectRole(1, report(t), cfg)).toBe("physical");
  });

  it("uses a tank aura signal + high damage-taken to pick tank over physical", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 400, damageTaken: 5000, magicDamageDone: 20 };
    const gear: GearSnapshot[] = [{ fightId: 1, playerId: 1, items: [], auras: [5487] }];
    expect(detectRole(1, report(t, gear), cfg)).toBe("tank");
  });

  it("does NOT call a bear-form druid a tank when damage-taken is low (cat dps)", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 3000, damageTaken: 200, magicDamageDone: 50 };
    const gear: GearSnapshot[] = [{ fightId: 1, playerId: 1, items: [], auras: [5487] }];
    expect(detectRole(1, report(t, gear), cfg)).toBe("physical");
  });

  it("defaults to physical when there is no data", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 0, damageTaken: 0, magicDamageDone: 0 };
    expect(detectRole(1, report(t), cfg)).toBe("physical");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wcl/core test roles`
Expected: FAIL ("Cannot find module './roles'").

- [ ] **Step 3: Implement**

```typescript
// packages/core/src/roles.ts
import type { Role, ReportData } from "./types";

export interface RoleSignal { spellId: number; role: Role; name: string; }
export interface RoleConfig { signals: RoleSignal[]; }

/** Thresholds (fractions of total output), tuned during E2E (Task 13). */
const HEALER_HEALING_SHARE = 0.4;
const TANK_TAKEN_SHARE = 0.5; // damage taken / (damage taken + damage done)
const CASTER_MAGIC_SHARE = 0.5; // magic damage / damage done

/**
 * Auto-detect a player's role. Order: a tank aura/cast signal combined with a
 * high damage-taken share wins; otherwise output ratios decide healer/caster/
 * physical; ambiguous -> physical. Manual override is applied by the caller.
 */
export function detectRole(playerId: number, report: ReportData, cfg: RoleConfig): Role {
  const totals = report.playerTotals?.find((t) => t.playerId === playerId);
  if (!totals) return "physical";

  const output = totals.healingDone + totals.damageDone;
  // Healer: meaningful healing share is the strongest signal.
  if (output > 0 && totals.healingDone / output >= HEALER_HEALING_SHARE) return "healer";

  // Tank: a tank signal aura/cast AND a high damage-taken share.
  const hasTankSignal = report.gear?.some(
    (g) => g.playerId === playerId
      && (g.auras ?? []).some((a) => cfg.signals.some((s) => s.spellId === a && s.role === "tank")),
  ) ?? false;
  const takenShare = totals.damageTaken / (totals.damageTaken + totals.damageDone || 1);
  if (hasTankSignal && takenShare >= TANK_TAKEN_SHARE) return "tank";

  // Caster vs physical by magic share of damage done.
  if (totals.damageDone > 0 && totals.magicDamageDone / totals.damageDone >= CASTER_MAGIC_SHARE) {
    return "caster";
  }
  if (totals.damageDone > 0) return "physical";
  return "physical";
}
```

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @wcl/core test roles` → PASS.

- [ ] **Step 5: Export** — in `packages/core/src/index.ts` add `export * from "./roles";` (after `./timeline`).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/roles.ts packages/core/src/roles.test.ts packages/core/src/index.ts
git commit -m "feat(core): hybrid role auto-detection"
```

---

## Task 5: `activity` (active seconds, ST/AoE split, haste correction)

**Files:**
- Create: `packages/core/src/activity.ts`
- Test: `packages/core/src/activity.test.ts`
- Modify: `packages/core/src/index.ts`

Active seconds = Σ over the player's boss-fight casts of `castTime(spellId)` (deci-seconds → seconds). A cast is **AoE** if its ability hit more than one distinct target within `AOE_WINDOW_MS` after the cast; the hit count feeds "hits per aoe cast". Spell-haste subtraction: a cast made while a haste buff was active actually finished faster, so `correctedSeconds = base / (1 + pct)`; `secondsSubtracted = base − corrected`. Relative active % = corrected active seconds / total boss-fight duration.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/activity.test.ts
import { describe, expect, it } from "vitest";
import { activity, type ActivityConfig } from "./activity";
import type { ReportData } from "./types";

const castTimes = { "100": 30, "200": 20, "300": 0 }; // 3.0s, 2.0s, instant
const cfg: ActivityConfig = {
  castTimes,
  hasteBuffs: [{ spellId: 999, pct: 0.5, name: "Test Haste" }],
  aoeWindowMs: 500,
};

function base(): ReportData {
  return {
    reportId: "x", title: "", zoneName: "Black Temple", startTime: 0, endTime: 1,
    fights: [{ id: 1, name: "Boss", encounterId: 600, isBoss: true, kill: true, startTime: 0, endTime: 100_000 }],
    players: [{ id: 1, name: "P", class: "Mage" }], gear: [], itemMeta: {},
    playerCasts: [], playerDamage: [],
  };
}

describe("activity", () => {
  it("sums cast time for single-target casts and ignores instants", () => {
    const r = base();
    r.playerCasts = [
      { fightId: 1, playerId: 1, spellId: 100, timestamp: 1_000 }, // 3.0s
      { fightId: 1, playerId: 1, spellId: 300, timestamp: 5_000 }, // instant -> 0
    ];
    r.playerDamage = [
      { fightId: 1, sourceId: 1, abilityId: 100, targetId: 50, amount: 10, timestamp: 1_200, targetHostilePlayer: false, selfInflicted: false },
    ];
    const a = activity(1, r, cfg);
    expect(a.secondsActiveST).toBeCloseTo(3.0);
    expect(a.secondsActiveAoe).toBe(0);
  });

  it("classifies a cast that hits 2 targets in the window as AoE and counts hits", () => {
    const r = base();
    r.playerCasts = [{ fightId: 1, playerId: 1, spellId: 200, timestamp: 1_000 }]; // 2.0s
    r.playerDamage = [
      { fightId: 1, sourceId: 1, abilityId: 200, targetId: 50, amount: 5, timestamp: 1_100, targetHostilePlayer: false, selfInflicted: false },
      { fightId: 1, sourceId: 1, abilityId: 200, targetId: 51, amount: 5, timestamp: 1_200, targetHostilePlayer: false, selfInflicted: false },
    ];
    const a = activity(1, r, cfg);
    expect(a.secondsActiveAoe).toBeCloseTo(2.0);
    expect(a.secondsActiveST).toBe(0);
    expect(a.avgHitsPerAoeCast).toBe(2);
  });

  it("subtracts spell-haste seconds for casts under a haste buff", () => {
    const r = base();
    // cast under a 50% haste buff: 3.0s base -> 2.0s actual -> 1.0s subtracted
    r.playerCasts = [{ fightId: 1, playerId: 1, spellId: 100, timestamp: 1_000 }];
    r.playerDamage = [{ fightId: 1, sourceId: 1, abilityId: 100, targetId: 50, amount: 1, timestamp: 1_100, targetHostilePlayer: false, selfInflicted: false }];
    r.buffs = [{ fightId: 1, targetId: 1, spellId: 999, startTime: 0, endTime: 100_000 }];
    const a = activity(1, r, cfg);
    expect(a.secondsSubtractedHaste).toBeCloseTo(1.0);
    expect(a.relativeActiveTotal).toBeCloseTo(2.0 / 100); // corrected 2.0s over 100s
  });

  it("returns null when the report has no cast data (pre-M5)", () => {
    const r = base();
    delete r.playerCasts;
    expect(activity(1, r, cfg)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @wcl/core test activity` → FAIL ("Cannot find module './activity'").

- [ ] **Step 3: Implement**

```typescript
// packages/core/src/activity.ts
import type { ReportData, PlayerCast, PlayerDamageEvent } from "./types";

export interface ActivityHasteBuff { spellId: number; pct: number; name: string; }
export interface ActivityConfig {
  /** spell id -> base cast time in deci-seconds */
  castTimes: Record<string, number>;
  hasteBuffs: ActivityHasteBuff[];
  /** damage within this many ms after a cast is attributed to that cast */
  aoeWindowMs: number;
}

export interface ActivityResult {
  secondsActiveST: number;
  secondsActiveAoe: number;
  relativeActiveST: number;
  relativeActiveAoe: number;
  relativeActiveTotal: number;
  avgHitsPerAoeCast: number;
  /** seconds removed from raw active time because casts were haste-accelerated */
  secondsSubtractedHaste: number;
}

/**
 * Per-player activity over boss fights. Returns null when no cast data is
 * present (report cached before M5a) so the view can show a refresh notice.
 */
export function activity(playerId: number, report: ReportData, cfg: ActivityConfig): ActivityResult | null {
  if (report.playerCasts === undefined) return null;

  const bossFightIds = new Set(report.fights.filter((f) => f.isBoss).map((f) => f.id));
  const bossDurationSec = report.fights
    .filter((f) => f.isBoss)
    .reduce((sum, f) => sum + (f.endTime - f.startTime) / 1000, 0);

  const casts = report.playerCasts.filter((c) => c.playerId === playerId && bossFightIds.has(c.fightId));
  const damage = (report.playerDamage ?? []).filter((d) => d.sourceId === playerId && bossFightIds.has(d.fightId));

  let stRawSec = 0, aoeRawSec = 0, stCorrSec = 0, aoeCorrSec = 0;
  let aoeCasts = 0, aoeHits = 0;

  for (const cast of casts) {
    const deci = cfg.castTimes[String(cast.spellId)] ?? 0;
    if (deci <= 0) continue; // instant -> no active time
    const baseSec = deci / 10;
    const hits = hitsFor(cast, damage, cfg.aoeWindowMs);
    const isAoe = hits > 1;
    const corrSec = baseSec / (1 + hastePctAt(cast, playerId, report, cfg));
    if (isAoe) { aoeRawSec += baseSec; aoeCorrSec += corrSec; aoeCasts += 1; aoeHits += hits; }
    else { stRawSec += baseSec; stCorrSec += corrSec; }
  }

  const totalCorr = stCorrSec + aoeCorrSec;
  const rel = (sec: number) => (bossDurationSec > 0 ? sec / bossDurationSec : 0);
  return {
    secondsActiveST: round2(stRawSec),
    secondsActiveAoe: round2(aoeRawSec),
    relativeActiveST: rel(stCorrSec),
    relativeActiveAoe: rel(aoeCorrSec),
    relativeActiveTotal: rel(totalCorr),
    avgHitsPerAoeCast: aoeCasts > 0 ? aoeHits / aoeCasts : 0,
    secondsSubtractedHaste: round2(stRawSec + aoeRawSec - totalCorr),
  };
}

/** distinct targets the cast's ability damaged within the window after it */
function hitsFor(cast: PlayerCast, damage: PlayerDamageEvent[], windowMs: number): number {
  const targets = new Set<number>();
  for (const d of damage) {
    if (d.fightId !== cast.fightId || d.abilityId !== cast.spellId) continue;
    if (d.timestamp < cast.timestamp || d.timestamp > cast.timestamp + windowMs) continue;
    targets.add(d.targetId);
  }
  return targets.size;
}

/** largest haste pct among buffs active on the player at the cast timestamp */
function hastePctAt(cast: PlayerCast, playerId: number, report: ReportData, cfg: ActivityConfig): number {
  let pct = 0;
  for (const buff of report.buffs ?? []) {
    if (buff.targetId !== playerId || buff.fightId !== cast.fightId) continue;
    if (cast.timestamp < buff.startTime || cast.timestamp > buff.endTime) continue;
    const h = cfg.hasteBuffs.find((b) => b.spellId === buff.spellId);
    if (h && h.pct > pct) pct = h.pct;
  }
  return pct;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
```

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @wcl/core test activity` → PASS.

- [ ] **Step 5: Export** — in `packages/core/src/index.ts` add `export * from "./activity";`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/activity.ts packages/core/src/activity.test.ts packages/core/src/index.ts
git commit -m "feat(core): RPB activity metrics with spell-haste correction"
```

---

## Task 6: `rpb` orchestrator — universal metrics + role grouping

**Files:**
- Create: `packages/core/src/rpb.ts`
- Test: `packages/core/src/rpb.test.ts`
- Modify: `packages/core/src/fixtures/report.fixture.ts`
- Modify: `packages/core/src/index.ts`

`rpb()` returns one row per player, grouped by detected role, each carrying the universal metrics + activity + a `severity`. Computes deaths, interrupts (count + sources), absorbs, damage reflected / friendly fire / damage-to-hostile, engineering & oil-of-immolation damage, Battle Shout uptime, trinkets, and total avoidable damage taken. **Kalecgos fights are excluded** from every aggregation.

- [ ] **Step 1: Add RPB sample data to the fixture**

In `packages/core/src/fixtures/report.fixture.ts`, add these fields to the `reportFixture` object (before the closing `}`), so `rpb()` has data on fight 3 (a boss, Hydross) and fight 5 (boss, Lurker):

```typescript
  playerTotals: [
    { playerId: 1, healingDone: 0, damageDone: 100000, damageTaken: 2000, magicDamageDone: 95000 },
    { playerId: 2, healingDone: 0, damageDone: 80000, damageTaken: 9000, magicDamageDone: 500 },
  ],
  playerDeaths: [{ playerId: 2, fightId: 3 }],
  interrupts: [
    { fightId: 3, targetPlayerId: 1, interruptedSpellId: 12471, sourceName: "Hydross the Unstable" },
  ],
  damageTakenEvents: [
    { fightId: 3, targetPlayerId: 1, abilityId: 13022, amount: 1500, fromFriendly: false },
    { fightId: 3, targetPlayerId: 1, abilityId: 99999, amount: 300, fromFriendly: true }, // friendly fire
  ],
  playerCasts: [
    { fightId: 3, playerId: 1, spellId: 30451, timestamp: 151_000 },
  ],
  playerDamage: [
    { fightId: 3, sourceId: 1, abilityId: 30451, targetId: 900, amount: 4000, timestamp: 151_200, targetHostilePlayer: false, selfInflicted: false },
    { fightId: 3, sourceId: 1, abilityId: 11350, targetId: 900, amount: 250, timestamp: 152_000, targetHostilePlayer: false, selfInflicted: false }, // oil of immolation
    { fightId: 3, sourceId: 2, abilityId: 30461, targetId: 900, amount: 700, timestamp: 153_000, targetHostilePlayer: false, selfInflicted: false }, // engineering bomb
  ],
  absorbs: [
    { fightId: 3, playerId: 1, spellId: 17252, amount: 1200 },
  ],
```

(Add `30451` to `itemMeta`? No — `itemMeta` is items only; spells aren't looked up there.)

- [ ] **Step 2: Write the failing test**

```typescript
// packages/core/src/rpb.test.ts
import { describe, expect, it } from "vitest";
import { rpb, type RpbConfig } from "./rpb";
import { reportFixture } from "./fixtures/report.fixture";
import type { RpbRow } from "./rpb";

const cfg: RpbConfig = {
  roles: { signals: [{ spellId: 5487, role: "tank", name: "Bear Form" }] },
  activity: {
    castTimes: { "30451": 25 },
    hasteBuffs: [],
    aoeWindowMs: 500,
  },
  engineeringDamageIds: [30461],
  oilOfImmolationSpellId: 11350,
  battleShoutBuffIds: [2048],
  absorbExcludedSpellIds: [],
};

const rowFor = (name: string): RpbRow => {
  const res = rpb(reportFixture, cfg);
  const row = res?.rows.find((r) => r.playerName === name);
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

describe("rpb", () => {
  it("returns null when the report predates M5a", () => {
    const r = structuredClone(reportFixture);
    delete r.playerTotals;
    expect(rpb(r, cfg)).toBeNull();
  });

  it("detects roles and groups players", () => {
    expect(rowFor("Playerone").role).toBe("caster");
    expect(rowFor("Playertwo").role).toBe("physical");
  });

  it("counts deaths, interrupts, and absorbs", () => {
    expect(rowFor("Playertwo").deaths).toBe(1);
    const p1 = rowFor("Playerone");
    expect(p1.interruptedSpells).toBe(1);
    expect(p1.interruptSources).toEqual(["Hydross the Unstable"]);
    expect(p1.totalAbsorbed).toBe(1200);
  });

  it("splits avoidable / friendly-fire damage taken", () => {
    const p1 = rowFor("Playerone");
    expect(p1.friendlyFire).toBe(300);
    expect(p1.totalAvoidableDamageTaken).toBe(1500 + 300);
  });

  it("attributes engineering and oil-of-immolation damage", () => {
    expect(rowFor("Playerone").oilOfImmolationDamage).toBe(250);
    expect(rowFor("Playertwo").engineeringDamage).toBe(700);
  });

  it("flags a death with major severity", () => {
    expect(rowFor("Playertwo").severity).toBe("major");
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `pnpm --filter @wcl/core test rpb` → FAIL.

- [ ] **Step 4: Implement**

```typescript
// packages/core/src/rpb.ts
import type { ReportData, Role } from "./types";
import { detectRole, type RoleConfig } from "./roles";
import { activity, type ActivityConfig, type ActivityResult } from "./activity";

export type RpbSeverity = "major" | "moderate" | "minor" | "ok";

export interface RpbConfig {
  roles: RoleConfig;
  activity: ActivityConfig;
  engineeringDamageIds: number[];
  oilOfImmolationSpellId: number;
  battleShoutBuffIds: number[];
  absorbExcludedSpellIds: number[];
}

export interface RpbRow {
  playerId: number;
  playerName: string;
  className: string;
  role: Role;
  deaths: number;
  interruptedSpells: number;
  interruptSources: string[];
  totalAbsorbed: number;
  friendlyFire: number;
  damageReflectedOrHostile: number;
  totalAvoidableDamageTaken: number;
  engineeringDamage: number;
  oilOfImmolationDamage: number;
  battleShoutUptime: number; // fraction 0..1 of boss-fight time
  activity: ActivityResult | null;
  severity: RpbSeverity;
}

/** Kalecgos breaks RPB numbers (portal mechanic) — excluded from all aggregation. */
const isKalecgos = (name: string) => name.toLowerCase().includes("kalecgos");

export function rpb(report: ReportData, cfg: RpbConfig): { rows: RpbRow[] } | null {
  if (report.playerTotals === undefined) return null;

  const bossFights = report.fights.filter((f) => f.isBoss && !isKalecgos(f.name));
  const bossFightIds = new Set(bossFights.map((f) => f.id));
  const bossDurationMs = bossFights.reduce((s, f) => s + (f.endTime - f.startTime), 0);

  const inBoss = <T extends { fightId: number }>(xs: T[] | undefined) =>
    (xs ?? []).filter((x) => bossFightIds.has(x.fightId));

  const deaths = inBoss(report.playerDeaths);
  const interrupts = inBoss(report.interrupts);
  const dmgTaken = inBoss(report.damageTakenEvents);
  const absorbs = inBoss(report.absorbs).filter((a) => !cfg.absorbExcludedSpellIds.includes(a.spellId));

  const rows: RpbRow[] = [];
  for (const player of report.players) {
    const id = player.id;
    const myDmgTaken = dmgTaken.filter((d) => d.targetPlayerId === id);
    const myDamage = (report.playerDamage ?? []).filter((d) => d.sourceId === id && bossFightIds.has(d.fightId));
    const myInterrupts = interrupts.filter((i) => i.targetPlayerId === id);

    const friendlyFire = myDmgTaken.filter((d) => d.fromFriendly).reduce((s, d) => s + d.amount, 0);
    const totalAvoidable = myDmgTaken.reduce((s, d) => s + d.amount, 0); // generic "total (partly) avoidable"
    const battleShoutMs = uptimeMs(report, id, cfg.battleShoutBuffIds, bossFightIds);

    const row: RpbRow = {
      playerId: id,
      playerName: player.name,
      className: player.class,
      role: detectRole(id, report, cfg.roles),
      deaths: deaths.filter((d) => d.playerId === id).length,
      interruptedSpells: myInterrupts.length,
      interruptSources: [...new Set(myInterrupts.map((i) => i.sourceName))],
      totalAbsorbed: absorbs.filter((a) => a.playerId === id).reduce((s, a) => s + a.amount, 0),
      friendlyFire,
      damageReflectedOrHostile: myDamage
        .filter((d) => d.selfInflicted || d.targetHostilePlayer)
        .reduce((s, d) => s + d.amount, 0),
      totalAvoidableDamageTaken: totalAvoidable,
      engineeringDamage: myDamage
        .filter((d) => cfg.engineeringDamageIds.includes(d.abilityId))
        .reduce((s, d) => s + d.amount, 0),
      oilOfImmolationDamage: myDamage
        .filter((d) => d.abilityId === cfg.oilOfImmolationSpellId)
        .reduce((s, d) => s + d.amount, 0),
      battleShoutUptime: bossDurationMs > 0 ? battleShoutMs / bossDurationMs : 0,
      activity: activity(id, report, cfg.activity),
      severity: "ok",
    };
    row.severity = severityFor(row);
    rows.push(row);
  }
  rows.sort((a, b) => a.role.localeCompare(b.role) || a.playerName.localeCompare(b.playerName));
  return { rows };
}

/** total ms (within boss fights) the player had any of the given buffs active */
function uptimeMs(report: ReportData, playerId: number, buffIds: number[], bossFightIds: Set<number>): number {
  const set = new Set(buffIds);
  return (report.buffs ?? [])
    .filter((b) => b.targetId === playerId && set.has(b.spellId) && bossFightIds.has(b.fightId))
    .reduce((s, b) => s + (b.endTime - b.startTime), 0);
}

function severityFor(row: RpbRow): RpbSeverity {
  if (row.deaths > 0) return "major";
  if (row.friendlyFire > 0 || row.totalAvoidableDamageTaken > 0) return "moderate";
  return "ok";
}
```

- [ ] **Step 5: Run to verify it passes** — `pnpm --filter @wcl/core test rpb` → PASS.

- [ ] **Step 6: Typecheck** — `pnpm --filter @wcl/core exec tsc --noEmit` → PASS (remove any unused locals flagged).

- [ ] **Step 7: Export** — in `packages/core/src/index.ts` add `export * from "./rpb";`.

- [ ] **Step 8: Run the whole core suite** — `pnpm --filter @wcl/core test` → all PASS (the fixture additions must not break existing gear/consumable/drum tests — they only add optional fields).

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/rpb.ts packages/core/src/rpb.test.ts packages/core/src/fixtures/report.fixture.ts packages/core/src/index.ts
git commit -m "feat(core): RPB orchestrator — universal metrics + role grouping"
```

---

# Phase 2 — API wiring + web tab + E2E

> ⚠️ **WCL event/table shapes below are written from the existing code's patterns but were NOT live-probed (no creds in the build env).** Task 13 runs `pnpm --filter @wcl/api probe <code>` against a real report to confirm shapes and fix any mismatch. Treat field names in Tasks 9–10 as the current best assumption.

## Task 9: WCL fetchers for RPB events + summary tables

**Files:**
- Modify: `apps/api/src/wcl.ts`
- Test: `apps/api/src/wcl.test.ts`

Add: a summary-table fetch (one query, cheap) for per-player totals; interrupt events; damage-taken events; player casts (all abilities); player damage events. Reuse the existing `EVENTS_QUERY` + paging helper where the shape fits.

- [ ] **Step 1: Add raw types + fetchers**

Append to `apps/api/src/wcl.ts`:

```typescript
export interface RawInterruptEvent {
  timestamp: number; type: string; sourceID: number; targetID: number;
  abilityGameID: number; extraAbilityGameID?: number; fight: number;
}
export interface RawDamageEvent {
  timestamp: number; type: string; sourceID: number; targetID: number;
  abilityGameID: number; amount: number; absorbed?: number; fight: number;
  sourceIsFriendly?: boolean; targetIsFriendly?: boolean;
}

/** All player casts (no ability filter) — paged. Used for activity cast-time sums. */
export async function fetchAllCasts(code: string, accessToken: string): Promise<RawCastEvent[]> {
  return await fetchAllEvents(code, accessToken, "Casts", new Set(["cast"])) as unknown as RawCastEvent[];
}

/** Interrupt events (whole report). */
export async function fetchInterrupts(code: string, accessToken: string): Promise<RawInterruptEvent[]> {
  return await fetchAllEvents(code, accessToken, "Interrupts", new Set(["interrupt"])) as unknown as RawInterruptEvent[];
}

/** Damage-taken events on players (DamageTaken dataType). */
export async function fetchDamageTaken(code: string, accessToken: string): Promise<RawDamageEvent[]> {
  return await fetchAllEvents(code, accessToken, "DamageTaken", new Set(["damage"])) as unknown as RawDamageEvent[];
}

/** Damage-done events by players (DamageDone dataType). */
export async function fetchDamageDone(code: string, accessToken: string): Promise<RawDamageEvent[]> {
  return await fetchAllEvents(code, accessToken, "DamageDone", new Set(["damage"])) as unknown as RawDamageEvent[];
}

/** Like fetchEvents but with no ability filter (filterExpression: null). */
async function fetchAllEvents(
  code: string, accessToken: string, dataType: string, keepTypes: Set<string>,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let start = 0;
  for (;;) {
    const data = await gql<{ reportData: { report: { events: { data: Record<string, unknown>[]; nextPageTimestamp: number | null } } } }>(
      EVENTS_QUERY, { code, dataType, filter: null, start }, accessToken);
    const page = data.reportData.report.events;
    for (const e of page.data) if (keepTypes.has(e.type as string)) out.push(e);
    if (page.nextPageTimestamp == null || page.nextPageTimestamp <= start) break;
    start = page.nextPageTimestamp;
  }
  return out;
}

export interface RawTableEntry {
  id: number;        // actor id
  total: number;     // effective total
  type?: string;     // damage school for DamageDone ("Physical", "Fire", ...)
}

/** Fetch a WCL summary table (DamageDone / Healing / DamageTaken) for boss fights.
 *  Returns per-actor totals. One query per call — far cheaper than raw events. */
export async function fetchTable(
  code: string, accessToken: string, dataType: "DamageDone" | "Healing" | "DamageTaken",
  fightIds: number[],
): Promise<RawTableEntry[]> {
  const query = `
  query Table($code: String!, $dataType: TableDataType!, $fightIds: [Int]) {
    reportData { report(code: $code) {
      table(dataType: $dataType, fightIDs: $fightIds, hostilityType: Friendlies)
    } }
  }`;
  const data = await gql<{ reportData: { report: { table: { data?: { entries?: RawTableEntry[] } } } } }>(
    query, { code, dataType, fightIds }, accessToken);
  return data.reportData.report.table?.data?.entries ?? [];
}
```

- [ ] **Step 2: Add a unit test for the no-filter pager**

In `apps/api/src/wcl.test.ts`, add a test that mocks `fetch` to return one page of mixed event types and asserts `fetchInterrupts` keeps only `interrupt` events. Mirror the existing fetch tests in that file (use the same `globalThis.fetch` mock pattern already present there):

```typescript
import { fetchInterrupts } from "./wcl";

it("fetchInterrupts keeps only interrupt events and stops paging", async () => {
  const page = {
    data: { reportData: { report: { events: {
      data: [
        { type: "interrupt", sourceID: 5, targetID: 1, abilityGameID: 1, extraAbilityGameID: 12471, fight: 3, timestamp: 1 },
        { type: "cast", sourceID: 1, abilityGameID: 2, fight: 3, timestamp: 2 },
      ],
      nextPageTimestamp: null,
    } } } },
  };
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => page }) as unknown as typeof fetch;
  const out = await fetchInterrupts("abc", "tok");
  expect(out).toHaveLength(1);
  expect(out[0]!.extraAbilityGameID).toBe(12471);
});
```

(If `vi` is not imported in this file, add `import { vi } from "vitest";` — match the file's existing imports.)

- [ ] **Step 3: Run tests** — `pnpm --filter @wcl/api test wcl` → PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/wcl.ts apps/api/src/wcl.test.ts
git commit -m "feat(api): WCL fetchers for RPB events + summary tables"
```

---

## Task 10: Normalize RPB events into `ReportData`

**Files:**
- Modify: `apps/api/src/normalize.ts`
- Test: `apps/api/src/normalize.test.ts`

Map raw events/tables → the optional `ReportData` fields. Player-id membership comes from the already-computed participant set. School split: a DamageDone table entry with `type !== "Physical"` counts as magic.

- [ ] **Step 1: Extend `NormalizeEventInputs` and the return**

In `apps/api/src/normalize.ts`, add to `NormalizeEventInputs`:

```typescript
  interrupts?: RawInterruptEvent[];
  damageTaken?: RawDamageEvent[];
  damageDone?: RawDamageEvent[];
  allCasts?: RawCastEvent[];
  damageDoneTable?: RawTableEntry[];
  healingTable?: RawTableEntry[];
  damageTakenTable?: RawTableEntry[];
  /** masterData actor id -> display name, for interrupt sources (players + NPCs) */
  actorNames?: Record<number, string>;
```

Import the new raw types at the top:

```typescript
import {
  WclError, type RawBuffEvent, type RawCastEvent, type RawCombatantInfo,
  type RawDeathEvent, type RawReport, type RawInterruptEvent, type RawDamageEvent,
  type RawTableEntry,
} from "./wcl";
```

Add the core types to the `@wcl/core` import:

```typescript
import {
  isTbcRaidZone, type BuffInterval, type Fight, type ItemMeta, type ReportData,
  type PlayerTotals, type PlayerDeath, type InterruptEvent, type DamageTakenEvent,
  type PlayerCast, type PlayerDamageEvent,
} from "@wcl/core";
```

- [ ] **Step 2: Build the RPB fields**

Add this helper to `normalize.ts`:

```typescript
function buildRpb(
  events: NormalizeEventInputs,
  playerIds: Set<number>,
  fights: Fight[],
): Pick<ReportData,
  "playerTotals" | "playerDeaths" | "interrupts" | "damageTakenEvents" | "playerCasts" | "playerDamage"> | {} {
  if (events.allCasts === undefined && events.damageDoneTable === undefined) return {};
  const fightIds = new Set(fights.map((f) => f.id));
  const names = events.actorNames ?? {};

  // per-player totals from summary tables
  const totalsById = new Map<number, PlayerTotals>();
  const ensure = (id: number) => {
    let t = totalsById.get(id);
    if (!t) { t = { playerId: id, healingDone: 0, damageDone: 0, damageTaken: 0, magicDamageDone: 0 }; totalsById.set(id, t); }
    return t;
  };
  for (const e of events.damageDoneTable ?? []) {
    if (!playerIds.has(e.id)) continue;
    const t = ensure(e.id); t.damageDone += e.total;
    if (e.type && e.type !== "Physical") t.magicDamageDone += e.total;
  }
  for (const e of events.healingTable ?? []) { if (playerIds.has(e.id)) ensure(e.id).healingDone += e.total; }
  for (const e of events.damageTakenTable ?? []) { if (playerIds.has(e.id)) ensure(e.id).damageTaken += e.total; }

  const playerDeaths: PlayerDeath[] = (events.deaths ?? [])
    .filter((d) => playerIds.has(d.targetID) && fightIds.has(d.fight))
    .map((d) => ({ playerId: d.targetID, fightId: d.fight }));

  const interrupts: InterruptEvent[] = (events.interrupts ?? [])
    .filter((i) => playerIds.has(i.targetID) && fightIds.has(i.fight))
    .map((i) => ({
      fightId: i.fight, targetPlayerId: i.targetID,
      interruptedSpellId: i.extraAbilityGameID ?? 0,
      sourceName: names[i.sourceID] ?? `#${i.sourceID}`,
    }));

  const damageTakenEvents: DamageTakenEvent[] = (events.damageTaken ?? [])
    .filter((d) => playerIds.has(d.targetID) && fightIds.has(d.fight))
    .map((d) => ({
      fightId: d.fight, targetPlayerId: d.targetID, abilityId: d.abilityGameID,
      amount: d.amount, fromFriendly: d.sourceIsFriendly === true,
    }));

  const playerCasts: PlayerCast[] = (events.allCasts ?? [])
    .filter((c) => playerIds.has(c.sourceID) && fightIds.has(c.fight))
    .map((c) => ({ fightId: c.fight, playerId: c.sourceID, spellId: c.abilityGameID, timestamp: c.timestamp }));

  const playerDamage: PlayerDamageEvent[] = (events.damageDone ?? [])
    .filter((d) => playerIds.has(d.sourceID) && fightIds.has(d.fight))
    .map((d) => ({
      fightId: d.fight, sourceId: d.sourceID, abilityId: d.abilityGameID,
      targetId: d.targetID, amount: d.amount, timestamp: d.timestamp,
      targetHostilePlayer: playerIds.has(d.targetID) && d.targetID !== d.sourceID,
      selfInflicted: d.targetID === d.sourceID,
    }));

  return {
    playerTotals: [...totalsById.values()],
    playerDeaths, interrupts, damageTakenEvents, playerCasts, playerDamage,
  };
}
```

Then, in the `return { ... }` object of `normalizeReport`, add `buildRpb(...)` spread after the `buildNpcKills` spread:

```typescript
    ...(events.deaths ? buildNpcKills(events.deaths, raw.masterData!.npcs ?? [], fights) : {}),
    ...buildRpb(events, new Set(players.map((p) => p.id)), fights),
    itemMeta,
```

Note: `players` is computed by `filterToParticipants(raw)` — assign it to a local `const players = filterToParticipants(raw);` before the return and use it both in the `players:` field and the `buildRpb` call (it currently inlines the call in the `players:` field — refactor to the local).

- [ ] **Step 3: Write the test**

In `apps/api/src/normalize.test.ts`, add a test that passes the new inputs and asserts the fields. Mirror the existing normalize tests' raw-report builder:

```typescript
it("normalizes RPB events into ReportData", () => {
  const raw = makeRawReport(); // existing helper with a boss fight id 3 + players 1,2
  const data = normalizeReport("abc", raw, [], {}, {
    allCasts: [{ timestamp: 100, type: "cast", sourceID: 1, abilityGameID: 30451, fight: 3 }],
    damageDone: [{ timestamp: 120, type: "damage", sourceID: 1, targetID: 900, abilityGameID: 30451, amount: 50, fight: 3 }],
    damageTaken: [{ timestamp: 130, type: "damage", sourceID: 800, targetID: 1, abilityGameID: 13022, amount: 75, fight: 3 }],
    interrupts: [{ timestamp: 140, type: "interrupt", sourceID: 800, targetID: 1, abilityGameID: 1, extraAbilityGameID: 12471, fight: 3 }],
    deaths: [{ timestamp: 150, type: "death", targetID: 2, fight: 3 }],
    damageDoneTable: [{ id: 1, total: 1000, type: "Fire" }],
    healingTable: [], damageTakenTable: [{ id: 1, total: 75 }],
    actorNames: { 800: "Hydross the Unstable" },
  });
  expect(data.playerTotals?.find((t) => t.playerId === 1)?.magicDamageDone).toBe(1000);
  expect(data.playerCasts).toHaveLength(1);
  expect(data.interrupts?.[0]?.sourceName).toBe("Hydross the Unstable");
  expect(data.playerDeaths?.[0]?.playerId).toBe(2);
});
```

(Adapt `makeRawReport`/field names to whatever the file's existing helper provides; ensure fight id 3 is a boss and players 1 & 2 are participants.)

- [ ] **Step 4: Run tests** — `pnpm --filter @wcl/api test normalize` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/normalize.ts apps/api/src/normalize.test.ts
git commit -m "feat(api): normalize RPB events + table totals into ReportData"
```

---

## Task 11: Wire RPB fetches into the report endpoint

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/app.test.ts`

Add the new fetchers to `AppDeps`, fetch them in parallel (best-effort, like the existing block), build `actorNames` from masterData, and pass everything to `normalizeReport`.

- [ ] **Step 1: Extend `AppDeps` + defaults**

Add to the imports from `./wcl`: `fetchInterrupts`, `fetchDamageTaken`, `fetchDamageDone`, `fetchAllCasts`, `fetchTable` (aliased `real*`) and their raw types. Add to `AppDeps`:

```typescript
  fetchInterrupts: typeof realFetchInterrupts;
  fetchDamageTaken: typeof realFetchDamageTaken;
  fetchDamageDone: typeof realFetchDamageDone;
  fetchAllCasts: typeof realFetchAllCasts;
  fetchTable: typeof realFetchTable;
```

and to the default `createApp(deps = { ... })` object. Update `app.test.ts`'s fake deps to add no-op versions returning `[]` (match the existing fakes).

- [ ] **Step 2: Fetch in parallel + normalize**

In the report handler, after the existing `Promise.allSettled` block, add a second best-effort block (so a failure can't drop the gear/consumable data already fetched):

```typescript
      let interrupts: RawInterruptEvent[] = [];
      let damageTaken: RawDamageEvent[] = [];
      let damageDone: RawDamageEvent[] = [];
      let allCasts: RawCastEvent[] = [];
      let damageDoneTable: RawTableEntry[] = [];
      let healingTable: RawTableEntry[] = [];
      let damageTakenTable: RawTableEntry[] = [];
      if (bossFightIds.length > 0) {
        const none = Promise.resolve([] as never[]);
        const [intR, dtR, ddR, castR, ddtR, htR, dttR] = await Promise.allSettled([
          deps.fetchInterrupts(id, token),
          deps.fetchDamageTaken(id, token),
          deps.fetchDamageDone(id, token),
          deps.fetchAllCasts(id, token),
          deps.fetchTable(id, token, "DamageDone", bossFightIds),
          deps.fetchTable(id, token, "Healing", bossFightIds),
          deps.fetchTable(id, token, "DamageTaken", bossFightIds),
        ]);
        if (intR.status === "fulfilled") interrupts = intR.value as RawInterruptEvent[];
        if (dtR.status === "fulfilled") damageTaken = dtR.value as RawDamageEvent[];
        if (ddR.status === "fulfilled") damageDone = ddR.value as RawDamageEvent[];
        if (castR.status === "fulfilled") allCasts = castR.value as RawCastEvent[];
        if (ddtR.status === "fulfilled") damageDoneTable = ddtR.value as RawTableEntry[];
        if (htR.status === "fulfilled") healingTable = htR.value as RawTableEntry[];
        if (dttR.status === "fulfilled") damageTakenTable = dttR.value as RawTableEntry[];
      }
      const actorNames: Record<number, string> = {};
      for (const a of rawReport.masterData?.actors ?? []) actorNames[a.id] = a.name;
      for (const n of rawReport.masterData?.npcs ?? []) actorNames[n.id] = actorNames[n.id] ?? `NPC ${n.gameID}`;
```

Then extend the `normalizeReport(...)` call's event object:

```typescript
      const data = normalizeReport(id, rawReport, combatants, itemMeta, {
        buffEvents, castEvents, deaths,
        trackedBuffIds: TRACKED_BUFF_IDS, drumBuffIds: DRUM_BUFF_IDS,
        interrupts, damageTaken, damageDone, allCasts,
        damageDoneTable, healingTable, damageTakenTable, actorNames,
      });
```

Note: NPC names aren't in masterData (`npcs` is id+gameID only). Interrupt sources from NPCs therefore show `NPC <gameID>`; Task 13 confirms whether WCL's masterData NPC actors expose `name` (if so, add it to the `npcs` query + `RawReport` type and use it here).

- [ ] **Step 3: Run API tests** — `pnpm --filter @wcl/api test` → PASS (the report-handler test must still build a `ReportData`; the new fetchers default to `[]`).

- [ ] **Step 4: Typecheck** — `cd apps/api && pnpm exec tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/app.test.ts
git commit -m "feat(api): fetch + wire RPB events and tables into report endpoint"
```

---

## Task 12: RPB web tab + per-character role override

**Files:**
- Modify: `apps/web/src/lib/storage.ts`
- Create: `apps/web/src/components/RpbView.tsx`
- Create: `apps/web/src/components/RpbView.test.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx`

- [ ] **Step 1: Add role-override storage helpers**

In `apps/web/src/lib/storage.ts`, add (matching the file's existing localStorage style):

```typescript
import type { Role } from "@wcl/core";

const ROLE_KEY = "wcl.roles";

export function loadRoleOverrides(): Record<string, Role> {
  try { return JSON.parse(localStorage.getItem(ROLE_KEY) ?? "{}"); } catch { return {}; }
}

export function saveRoleOverride(characterName: string, role: Role): void {
  const all = loadRoleOverrides();
  all[characterName] = role;
  localStorage.setItem(ROLE_KEY, JSON.stringify(all));
}
```

- [ ] **Step 2: Write the component test**

```tsx
// apps/web/src/components/RpbView.test.tsx
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RpbView } from "./RpbView";
import { reportFixture } from "@wcl/core";

describe("RpbView", () => {
  beforeEach(() => localStorage.clear());

  it("renders role groups and player rows", () => {
    render(<RpbView report={reportFixture} />);
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    expect(screen.getByText("Playertwo")).toBeInTheDocument();
  });

  it("shows a refresh notice for a pre-M5 report", () => {
    const r = structuredClone(reportFixture);
    delete (r as { playerTotals?: unknown }).playerTotals;
    render(<RpbView report={r} />);
    expect(screen.getByText(/cached before/i)).toBeInTheDocument();
  });

  it("persists a manual role override", () => {
    render(<RpbView report={reportFixture} />);
    const select = screen.getAllByLabelText(/role for/i)[0]!;
    fireEvent.change(select, { target: { value: "tank" } });
    expect(JSON.parse(localStorage.getItem("wcl.roles")!)).toMatchObject({ Playerone: "tank" });
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `pnpm --filter @wcl/web test RpbView` → FAIL (no component).

- [ ] **Step 4: Implement the component**

```tsx
// apps/web/src/components/RpbView.tsx
import { useMemo, useState } from "react";
import { rpb, type Role, type ReportData, type RpbRow } from "@wcl/core";
import {
  spellCastTimes, roleSignals, hasteBuffs, engineeringDamageIds,
  oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
} from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";
import { loadRoleOverrides, saveRoleOverride } from "../lib/storage";

const ROLES: Role[] = ["tank", "healer", "caster", "physical"];
const sevClass = (s: RpbRow["severity"]) => (s === "ok" ? "sev-ok" : `sev-${s}`);
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function RpbView({ report }: { report: ReportData }) {
  const [, force] = useState(0);
  const overrides = loadRoleOverrides();
  const result = useMemo(() => rpb(report, {
    roles: { signals: roleSignals },
    activity: { castTimes: spellCastTimes, hasteBuffs, aoeWindowMs: 500 },
    engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  }), [report]);

  if (result === null) {
    return <p>This report was cached before RPB support — refresh it from WCL (requires credentials).</p>;
  }

  // apply per-character overrides on top of auto-detected roles
  const rows = result.rows.map((r) => ({ ...r, role: overrides[r.playerName] ?? r.role }));

  return (
    <div>
      <p><small>Roles are auto-detected and adjustable per character (saved in your browser). Kalecgos is excluded. Activity is spell-haste corrected; melee activity is approximate.</small></p>
      <SeverityLegend />
      {ROLES.map((role) => {
        const group = rows.filter((r) => r.role === role);
        if (group.length === 0) return null;
        return (
          <section key={role}>
            <h3 style={{ textTransform: "capitalize" }}>{role}</h3>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>player</th><th>role</th><th>deaths</th><th>interrupted</th>
                    <th>avoidable taken</th><th>friendly fire</th><th>absorbed</th>
                    <th>engi dmg</th><th>oil dmg</th><th>shout uptime</th>
                    <th>active % (ST/AoE)</th><th>haste s saved</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((r) => (
                    <tr key={r.playerId} className={sevClass(r.severity)}>
                      <td>{r.playerName}</td>
                      <td>
                        <label className="sr-only" htmlFor={`role-${r.playerId}`}>role for {r.playerName}</label>
                        <select
                          id={`role-${r.playerId}`}
                          aria-label={`role for ${r.playerName}`}
                          value={r.role}
                          onChange={(e) => { saveRoleOverride(r.playerName, e.target.value as Role); force((n) => n + 1); }}
                        >
                          {ROLES.map((ro) => <option key={ro} value={ro}>{ro}</option>)}
                        </select>
                      </td>
                      <td className={r.deaths > 0 ? "sev-major" : ""}>{r.deaths}</td>
                      <td>{r.interruptedSpells > 0 ? `${r.interruptedSpells} (${r.interruptSources.join(", ")})` : 0}</td>
                      <td>{r.totalAvoidableDamageTaken.toLocaleString()}</td>
                      <td>{r.friendlyFire.toLocaleString()}</td>
                      <td>{r.totalAbsorbed.toLocaleString()}</td>
                      <td>{r.engineeringDamage.toLocaleString()}</td>
                      <td>{r.oilOfImmolationDamage.toLocaleString()}</td>
                      <td>{pct(r.battleShoutUptime)}</td>
                      <td>{r.activity ? `${pct(r.activity.relativeActiveST)} / ${pct(r.activity.relativeActiveAoe)}` : "—"}</td>
                      <td>{r.activity ? r.activity.secondsSubtractedHaste.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <p><small>"Raw avoidable damage by tracked abilities" (per-boss curated list) is not yet tracked — shown as total avoidable for now.</small></p>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes** — `pnpm --filter @wcl/web test RpbView` → PASS.

- [ ] **Step 6: Register the tab in `ReportPage.tsx`**

Add the import `import { RpbView } from "../components/RpbView";`. Add `"rpb"` to the `tab` union type, to the `useState` segmented array literal, and add the render line:

```tsx
{tab === "rpb" && <RpbView key={result.data.reportId} report={result.data} />}
```

(Add `"rpb"` to BOTH the `useState<...>` union and the `(["summary", ..., "fight timeline"] as const)` array.)

- [ ] **Step 7: Build the web app** — `pnpm --filter @wcl/web build` → succeeds (tsc + vite).

- [ ] **Step 8: Run the full web test suite** — `pnpm --filter @wcl/web test` → PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/storage.ts apps/web/src/components/RpbView.tsx apps/web/src/components/RpbView.test.tsx apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): RPB tab with per-character role override"
```

---

## Task 13: End-to-end verification + data tuning

**Files:**
- Modify (as needed): `packages/data/src/rpb.ts`, `apps/api/src/wcl.ts`, `apps/api/src/normalize.ts`, `apps/api/src/app.ts`.

Verify against a real report (creds required). Use `Mcva2nh39kHzfjqC` (Gruul) plus, if available, a report with casters/healers and PvP/engineering usage.

- [ ] **Step 1: Probe real WCL shapes**

Run: `pnpm --filter @wcl/api probe Mcva2nh39kHzfjqC` (with `WCL_CLIENT_ID`/`WCL_CLIENT_SECRET` in env).
Confirm the assumed field names exist for: interrupt events (`extraAbilityGameID`), damage events (`sourceIsFriendly`, `amount`), Casts (`abilityGameID`), and the `table` query shape (`data.entries[].id/total/type`). Note any mismatch.

- [ ] **Step 2: Fix any shape mismatches**

For each mismatch found, adjust the raw type + the `fetch*`/`buildRpb` mapping in `wcl.ts`/`normalize.ts`. If `table` returns a different envelope (e.g. nested under `entries` differently), adjust `fetchTable`. Re-run `pnpm -r test` after each fix.

- [ ] **Step 3: Load the report end-to-end**

Run the dev servers (`pnpm dev`), seed credentials in the browser Settings page, open `/report/Mcva2nh39kHzfjqC`, refresh from WCL, open the `rpb` tab. Verify:
- every fight participant appears under exactly one role; tanks/healers look right;
- deaths match WCL's deaths view; interrupts list plausible sources;
- activity %/haste-saved are sane (casters near WCL's active %); melee shown with the approximate caveat.

- [ ] **Step 4: Tune thresholds + curated sets**

If any role is misclassified, adjust the constants in `roles.ts` (`HEALER_HEALING_SHARE`, `TANK_TAKEN_SHARE`, `CASTER_MAGIC_SHARE`) and re-verify. Extend `engineeringDamageIds` / `absorbExcludedSpellIds` / `hasteBuffs` in `packages/data/src/rpb.ts` for any obviously-missing entries seen in the log. Update the affected unit tests if a threshold change alters a fixture expectation.

- [ ] **Step 5: Full verification**

Run: `pnpm -r test` and `pnpm --filter @wcl/web build`.
Expected: all green. Confirm with the actual output before claiming success.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(rpb): tune role thresholds + curated sets against real report"
```

---

## Wrap-up (after all tasks)

- [ ] Run the whole suite once more: `pnpm -r test` (expect ~196 + the new RPB tests) and `pnpm --filter @wcl/web build`.
- [ ] Update `handoff.md`: mark **M5a done**, note Bucket B (per-class ability rows + per-boss tracked-avoidable list) is the next milestone (M5b), and record any shape corrections + threshold values found in Task 13.
- [ ] Update the memory file `wcl-raid-analyzer-project.md` state line (M5a on main; M5b next).
- [ ] Use `superpowers:finishing-a-development-branch` to integrate (user has chosen merge-to-main locally each time).

---

## Self-review notes (filled by plan author)

- **Spec coverage:** role detection (T4), manual override persisted per character (T12), per-role layout (T12), deaths/interrupts/absorbs/reflected/FF/hostile (T6), engineering+oil (T2/T6), activity ST/AoE + hits + spell-haste corrected via reconstructed table (T1/T5), battle shout uptime + trinkets-on-bosses note (T6 — trinkets surfaced via existing gear; if a dedicated column is wanted it reuses `report.gear`, not blocking), total avoidable now + raw-tracked deferred with UI note (T6/T12), Kalecgos excluded (T6), refresh-notice on pre-M5 cache (T6/T12), severity convention (T6/T12). **Deferred per spec:** Bucket B, per-boss tracked-avoidable list.
- **Trinkets-on-bosses:** the spec lists it under "small curated data" but it needs no new fetch (it's in `report.gear`). Not given its own task to avoid scope creep; add as a hover column in T12 if desired — noted, non-blocking.
- **Type consistency:** `Role`, `RoleConfig`/`RoleSignal`, `ActivityConfig`/`ActivityResult`, `RpbConfig`/`RpbRow`, and the `ReportData` optional fields are defined once (T3/T4/T5/T6) and referenced consistently in API (T9–T11) and web (T12).
- **Known risk:** Phase-2 WCL shapes are assumptions until T13's probe — flagged at the top of Phase 2 and resolved in T13.
