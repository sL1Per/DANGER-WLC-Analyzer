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
    expect(a!.secondsActiveST).toBeCloseTo(3.0);
    expect(a!.secondsActiveAoe).toBe(0);
  });

  it("classifies a cast that hits 2 targets in the window as AoE and counts hits", () => {
    const r = base();
    r.playerCasts = [{ fightId: 1, playerId: 1, spellId: 200, timestamp: 1_000 }]; // 2.0s
    r.playerDamage = [
      { fightId: 1, sourceId: 1, abilityId: 200, targetId: 50, amount: 5, timestamp: 1_100, targetHostilePlayer: false, selfInflicted: false },
      { fightId: 1, sourceId: 1, abilityId: 200, targetId: 51, amount: 5, timestamp: 1_200, targetHostilePlayer: false, selfInflicted: false },
    ];
    const a = activity(1, r, cfg);
    expect(a!.secondsActiveAoe).toBeCloseTo(2.0);
    expect(a!.secondsActiveST).toBe(0);
    expect(a!.avgHitsPerAoeCast).toBe(2);
  });

  it("subtracts spell-haste seconds for casts under a haste buff", () => {
    const r = base();
    // cast under a 50% haste buff: 3.0s base -> 2.0s actual -> 1.0s subtracted
    r.playerCasts = [{ fightId: 1, playerId: 1, spellId: 100, timestamp: 1_000 }];
    r.playerDamage = [{ fightId: 1, sourceId: 1, abilityId: 100, targetId: 50, amount: 1, timestamp: 1_100, targetHostilePlayer: false, selfInflicted: false }];
    r.buffs = [{ fightId: 1, targetId: 1, spellId: 999, startTime: 0, endTime: 100_000 }];
    const a = activity(1, r, cfg);
    expect(a!.secondsSubtractedHaste).toBeCloseTo(1.0);
    expect(a!.relativeActiveTotal).toBeCloseTo(2.0 / 100); // corrected 2.0s over 100s
  });

  it("returns null when the report has no cast data (pre-M5)", () => {
    const r = base();
    delete r.playerCasts;
    expect(activity(1, r, cfg)).toBeNull();
  });
});
