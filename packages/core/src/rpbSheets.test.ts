import { describe, it, expect } from "vitest";
import { roleCasts, roleSheet } from "./rpbSheets";
import type { ReportData } from "./types";
import type { ActivityConfig } from "./activity";
import type { RoleConfig } from "./roles";
import type { RpbConfig } from "./rpb";

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
    // WCL resolves every cast's name; roleCasts matches abilities by name.
    abilityMeta: {
      "20925": { name: "Holy Shield" },
      "26573": { name: "Consecration" },
    },
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
    expect(pala!.counts.get("7:holy shield")!.castCount).toBe(3);
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
    expect(pala.counts.get("7:holy shield")!.castCount).toBe(1);
  });

  it("matches casts by WCL name, not by catalog spell ids", () => {
    // The cast's spell id (99999) is NOT in the catalog's spellIds, but its WCL
    // name resolves to "Holy Shield" — so it must still be counted. This proves
    // wrong/missing catalog ids no longer affect the numbers.
    const report: ReportData = {
      ...makeReport(),
      playerCasts: [
        { fightId: 1, playerId: 7, spellId: 99999, timestamp: 100 },
        { fightId: 1, playerId: 7, spellId: 99999, timestamp: 200 },
      ],
      abilityMeta: { "99999": { name: "Holy Shield" } },
    };
    const blocks = roleCasts(report, "tank", {
      catalog: [
        // deliberately wrong spell id (20925); matching is by name
        { className: "Paladin", key: "holy-shield", name: "Holy Shield", category: "cooldown", spellIds: [20925] },
      ],
      activity: activityCfg,
      roles: roleCfg,
      cooldownKeys: [],
    })!;
    const pala = blocks.find((b) => b.className === "Paladin")!;
    expect(pala.counts.get("7:holy shield")!.castCount).toBe(2);
  });

  it("matches a bare WCL name against a catalog name carrying an annotation", () => {
    const report: ReportData = {
      ...makeReport(),
      players: [{ id: 5, name: "Huntard", class: "Hunter" }],
      gear: [{ fightId: 1, playerId: 5, auras: [], items: [] }],
      playerTotals: [{ playerId: 5, healingDone: 0, damageDone: 9, damageTaken: 0, magicDamageDone: 0 }],
      playerCasts: [{ fightId: 1, playerId: 5, spellId: 75, timestamp: 100 }],
      abilityMeta: { "75": { name: "Auto Shot" } }, // WCL has no "(Expose Weakness)"
    };
    const blocks = roleCasts(report, "physical", {
      catalog: [
        { className: "Hunter", key: "auto-shot", name: "Auto Shot (Expose Weakness)", category: "single", spellIds: [] },
      ],
      activity: activityCfg,
      roles: { ...roleCfg, casterClasses: [] },
      cooldownKeys: [],
    })!;
    const hunter = blocks.find((b) => b.className === "Hunter")!;
    expect(hunter.counts.get("5:auto shot (expose weakness)")!.castCount).toBe(1);
  });

  it("collapses rank variants of an ability into a single row", () => {
    const report: ReportData = {
      ...makeReport(),
      players: [{ id: 9, name: "Eleshammy", class: "Shaman" }],
      gear: [{ fightId: 1, playerId: 9, auras: [], items: [] }],
      playerTotals: [{ playerId: 9, healingDone: 0, damageDone: 9, damageTaken: 0, magicDamageDone: 9 }],
      playerCasts: [
        { fightId: 1, playerId: 9, spellId: 1, timestamp: 100 },
        { fightId: 1, playerId: 9, spellId: 2, timestamp: 200 },
      ],
      // both ranks resolve to the same WCL base name
      abilityMeta: { "1": { name: "Lightning Bolt" }, "2": { name: "Lightning Bolt" } },
    };
    const blocks = roleCasts(report, "caster", {
      catalog: [
        { className: "Shaman", key: "lb-low", name: "Lightning Bolt (rank 1-4)", category: "single", spellIds: [] },
        { className: "Shaman", key: "lb-high", name: "Lightning Bolt (rank 5-12)", category: "single", spellIds: [] },
      ],
      activity: activityCfg,
      roles: { ...roleCfg, casterClasses: ["Shaman"] },
      cooldownKeys: [],
    })!;
    const sham = blocks.find((b) => b.className === "Shaman")!;
    // one collapsed "Lightning Bolt" row, with both ranks summed
    expect(sham.abilities.filter((a) => a.name === "Lightning Bolt")).toHaveLength(1);
    expect(sham.counts.get("9:lightning bolt")!.castCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// roleSheet tests
// ---------------------------------------------------------------------------

/** RpbConfig used by roleSheet tests — mirrors rpb.test.ts's cfg. */
const defaultRpbConfig = (): RpbConfig => ({
  roles: roleCfg,
  activity: activityCfg,
  engineeringDamageIds: [],
  oilOfImmolationSpellId: 11350,
  battleShoutBuffIds: [],
  absorbExcludedSpellIds: [],
  classAbilities: [],
  avoidableAbilityIds: new Set(),
});

/**
 * Minimal ReportData for roleSheet tests: one tank Paladin (id 7) with
 * hitStats, a trinketUse entry, and two EnemyDebuffInterval records for
 * Nether Vapor (spellId 35013) sourced by player 7.
 */
function makeReportWithHitStats(): ReportData {
  return {
    reportId: "test002",
    title: "Role Sheet Test",
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
    players: [{ id: 7, name: "TankPala", class: "Paladin" }],
    gear: [
      {
        fightId: 1,
        playerId: 7,
        // Righteous Fury aura → tank signal
        auras: [25780],
        items: [],
      },
    ],
    playerTotals: [
      {
        playerId: 7,
        healingDone: 0,
        damageDone: 100_000,
        damageTaken: 200_000,
        magicDamageDone: 0,
      },
    ],
    playerCasts: [
      // two on-use Bloodlust Brooch (28714) activations on the boss fight
      { fightId: 1, playerId: 7, spellId: 28714, timestamp: 100 },
      { fightId: 1, playerId: 7, spellId: 28714, timestamp: 500 },
    ],
    hitStatsByFight: [
      {
        playerId: 7,
        fightId: 1,
        // raw counts; roleSheet sums the scoped fights and derives percentages
        outgoing: { hit: 126, crit: 42, dodge: 0, miss: 2, parry: 0, resist: 0 },
        incomingMelee: { hit: 100, crit: 1, crushing: 0, blocked: 5, dodge: 10, immune: 0, miss: 3, parry: 8 },
        heal: { hit: 0, crit: 0 },
        extraWindfury: 0,
        battleSquawk: 0,
      },
    ],
    enemyDebuffs: [
      // Two applications of Nether Vapor (35013) by player 7 on fight 1
      { fightId: 1, sourceId: 7, targetEnemyId: 901, spellId: 35013, startTime: 100, endTime: 200 },
      { fightId: 1, sourceId: 7, targetEnemyId: 902, spellId: 35013, startTime: 300, endTime: 400 },
    ],
    damageTakenEvents: [
      // avoidable (Whirlwind) + non-avoidable (Melee) — only the former should count
      { fightId: 1, targetPlayerId: 7, abilityId: 100, amount: 5000, fromFriendly: false },
      { fightId: 1, targetPlayerId: 7, abilityId: 200, amount: 9999, fromFriendly: false },
    ],
    // WCL resolves every cast/debuff/damage name; roleSheet matches by name.
    abilityMeta: {
      "28714": { name: "Bloodlust Brooch" },
      "35013": { name: "Nether Vapor" },
      "100": { name: "Whirlwind" },
      "200": { name: "Melee" },
    },
    itemMeta: {},
  };
}

describe("roleSheet", () => {
  it("surfaces hit stats, trinkets and avoidable debuff counts per player", () => {
    const report = makeReportWithHitStats();
    const rows = roleSheet(report, "tank", {
      roles: roleCfg,
      rpb: defaultRpbConfig(),
      // names are matched against WCL ability names (ids in the data are ignored)
      avoidableDebuffIds: [{ spellId: 0, name: "Nether Vapor" }],
      trinketRacials: [{ spellId: 0, name: "Bloodlust Brooch" }],
      avoidableAbilityNames: ["Whirlwind"],
    })!;
    expect(rows).not.toBeNull();
    const r = rows.find((x) => x.playerId === 7)!;
    expect(r).toBeDefined();
    // hit stats aggregated from the per-fight raw counts (denom = 126+42+2 = 170)
    expect(r.hitStats?.outgoing.crit.count).toBe(42);
    expect(r.hitStats?.outgoing.crit.pct).toBeCloseTo(42 / 170, 5);
    // trinket uses matched by WCL name (two Bloodlust Brooch casts)
    expect(r.trinketUses.find((t) => t.name === "Bloodlust Brooch")?.count).toBe(2);
    // avoidable debuff applications matched by WCL name
    expect(r.debuffsApplied.find((d) => d.name === "Nether Vapor")?.count).toBe(2);
    // avoidable damage matched by name (Whirlwind only, not the Melee hit)
    expect(r.avoidableByAbility.find((a) => a.name === "Whirlwind")?.amount).toBe(5000);
    expect(r.totalAvoidableDamageTaken).toBe(5000);
  });

  it("returns null on a stale cache (no playerTotals)", () => {
    const report = { ...makeReportWithHitStats(), playerTotals: undefined } as ReportData;
    expect(
      roleSheet(report, "tank", {
        roles: roleCfg,
        rpb: defaultRpbConfig(),
        avoidableDebuffIds: [],
        trinketRacials: [],
        avoidableAbilityNames: [],
      }),
    ).toBeNull();
  });
});
