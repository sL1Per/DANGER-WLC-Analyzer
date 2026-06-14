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
    expect(rows[0].rankFlag).toBe(true);
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
