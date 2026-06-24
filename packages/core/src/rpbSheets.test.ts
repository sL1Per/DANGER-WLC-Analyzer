import { describe, it, expect } from "vitest";
import { roleCasts } from "./rpbSheets";
import type { ReportData } from "./types";
import type { ActivityConfig } from "./activity";
import type { RoleConfig } from "./roles";

/** Minimal but real ReportData for a single tank Paladin in one boss fight. */
function makeReport(): ReportData {
  return {
    reportId: "test001",
    title: "Test Report",
    zoneName: "Black Temple",
    startTime: 0,
    endTime: 2000,
    fights: [
      {
        id: 1,
        name: "Supremus",
        encounterId: 601,
        isBoss: true,
        kill: true,
        startTime: 0,
        endTime: 1000,
      },
    ],
    players: [
      { id: 7, name: "TankPala", class: "Paladin" },
    ],
    gear: [
      {
        fightId: 1,
        playerId: 7,
        // aura 25780 = Righteous Fury — tank signal
        auras: [25780],
        items: [],
      },
    ],
    playerTotals: [
      {
        playerId: 7,
        healingDone: 0,
        damageDone: 100000,
        // high damageTaken → tank
        damageTaken: 200000,
        magicDamageDone: 0,
      },
    ],
    playerCasts: [
      // 3x Holy Shield (guid 20925)
      { fightId: 1, playerId: 7, spellId: 20925, timestamp: 100 },
      { fightId: 1, playerId: 7, spellId: 20925, timestamp: 200 },
      { fightId: 1, playerId: 7, spellId: 20925, timestamp: 300 },
      // 1x Consecration (guid 26573)
      { fightId: 1, playerId: 7, spellId: 26573, timestamp: 400 },
    ],
    itemMeta: {},
  };
}

const activityCfg: ActivityConfig = {
  castTimes: {},
  hasteBuffs: [],
  aoeWindowMs: 500,
};

const roleCfg: RoleConfig = {
  signals: [
    // Righteous Fury spell id — marks as tank signal
    { spellId: 25780, role: "tank", name: "Righteous Fury" },
  ],
  casterClasses: ["Mage", "Warlock", "Shadow Priest", "Balance Druid"],
  physicalSpecs: [],
  casterSpecs: [],
};

describe("roleCasts", () => {
  it("groups abilities by class with per-player cast counts", () => {
    const report = makeReport();
    const blocks = roleCasts(report, "tank", {
      catalog: [
        {
          className: "Paladin",
          key: "holy-shield",
          name: "Holy Shield",
          category: "cooldown",
          spellIds: [20925],
        },
        {
          className: "Paladin",
          key: "consecration",
          name: "Consecration",
          category: "aoe",
          spellIds: [26573],
        },
      ],
      activity: activityCfg,
      roles: roleCfg,
      cooldownKeys: ["holy-shield"],
    });

    expect(blocks).not.toBeNull();
    const pala = blocks!.find((b) => b.className === "Paladin");
    expect(pala).toBeDefined();
    expect(pala!.counts.get("7:holy-shield")!.castCount).toBe(3);
    expect(pala!.counts.get("7:consecration")!.castCount).toBe(1);
  });

  it("only emits blocks for classes with role members", () => {
    const report = makeReport();
    const blocks = roleCasts(report, "tank", {
      catalog: [
        { className: "Paladin", key: "holy-shield", name: "Holy Shield", category: "cooldown", spellIds: [20925] },
        // Mage ability — should not produce a block (no mage is a tank here)
        { className: "Mage", key: "arcane-blast", name: "Arcane Blast", category: "single", spellIds: [30451] },
      ],
      activity: activityCfg,
      roles: roleCfg,
      cooldownKeys: ["holy-shield"],
    })!;

    const classNames = blocks.map((b) => b.className);
    expect(classNames).toContain("Paladin");
    expect(classNames).not.toContain("Mage");
  });

  it("populates the players list in the block", () => {
    const report = makeReport();
    const blocks = roleCasts(report, "tank", {
      catalog: [
        { className: "Paladin", key: "holy-shield", name: "Holy Shield", category: "cooldown", spellIds: [20925] },
      ],
      activity: activityCfg,
      roles: roleCfg,
      cooldownKeys: [],
    })!;

    const pala = blocks.find((b) => b.className === "Paladin")!;
    expect(pala.players).toHaveLength(1);
    expect(pala.players[0]!.playerId).toBe(7);
    expect(pala.players[0]!.playerName).toBe("TankPala");
  });

  it("returns null on a stale cache (no playerCasts)", () => {
    const report: ReportData = { ...makeReport(), playerCasts: undefined };
    expect(
      roleCasts(report, "tank", { catalog: [], activity: activityCfg, roles: roleCfg, cooldownKeys: [] }),
    ).toBeNull();
  });

  it("excludes Kalecgos fights", () => {
    const report: ReportData = {
      ...makeReport(),
      fights: [
        { id: 1, name: "Supremus", encounterId: 601, isBoss: true, kill: true, startTime: 0, endTime: 1000 },
        { id: 2, name: "Kalecgos", encounterId: 623, isBoss: true, kill: true, startTime: 1001, endTime: 2000 },
      ],
      playerCasts: [
        // casts on fight 1 (valid)
        { fightId: 1, playerId: 7, spellId: 20925, timestamp: 100 },
        // casts on fight 2 (Kalecgos — should be excluded)
        { fightId: 2, playerId: 7, spellId: 20925, timestamp: 1100 },
        { fightId: 2, playerId: 7, spellId: 20925, timestamp: 1200 },
      ],
    };

    const blocks = roleCasts(report, "tank", {
      catalog: [
        { className: "Paladin", key: "holy-shield", name: "Holy Shield", category: "cooldown", spellIds: [20925] },
      ],
      activity: activityCfg,
      roles: roleCfg,
      cooldownKeys: [],
    })!;

    const pala = blocks.find((b) => b.className === "Paladin")!;
    // Only the 1 cast on fight 1 should be counted (Kalecgos fight excluded)
    expect(pala.counts.get("7:holy-shield")!.castCount).toBe(1);
  });
});
