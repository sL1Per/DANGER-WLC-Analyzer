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
      },
    ],
    enemyDebuffs: [
      // Two applications of Nether Vapor (35013) by player 7 on fight 1
      { fightId: 1, sourceId: 7, targetEnemyId: 901, spellId: 35013, startTime: 100, endTime: 200 },
      { fightId: 1, sourceId: 7, targetEnemyId: 902, spellId: 35013, startTime: 300, endTime: 400 },
    ],
    damageTakenEvents: [
      // avoidable (Whirlwind from a boss) — uses the unmitigated (raw) amount, not amount
      { fightId: 1, targetPlayerId: 7, abilityId: 100, amount: 5000, unmitigatedAmount: 6000, fromFriendly: false, sourceName: "Leotheras the Blind" },
      // non-avoidable (Melee) — excluded
      { fightId: 1, targetPlayerId: 7, abilityId: 200, amount: 9999, fromFriendly: false, sourceName: "Leotheras the Blind" },
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
    // avoidable damage matched by name, labeled with source, using the RAW amount
    expect(r.avoidableByAbility.find((a) => a.name === "Whirlwind (Leotheras the Blind)")?.amount).toBe(6000);
    expect(r.totalAvoidableDamageTaken).toBe(6000);
  });

  it("surfaces Demoralizing Shout / Expose Armor uptime and cast counts per player", () => {
    const report: ReportData = {
      reportId: "test003",
      title: "Demo Shout Test",
      zoneName: "Black Temple",
      startTime: 0,
      endTime: 2000,
      fights: [
        { id: 1, name: "Supremus", encounterId: 601, isBoss: true, kill: true, startTime: 0, endTime: 1000 },
      ],
      players: [{ id: 7, name: "TankWar", class: "Warrior" }],
      // aura 25780 = tank signal (roleCfg)
      gear: [{ fightId: 1, playerId: 7, auras: [25780], items: [] }],
      playerTotals: [
        { playerId: 7, healingDone: 0, damageDone: 100_000, damageTaken: 200_000, magicDamageDone: 0 },
      ],
      playerCasts: [
        { fightId: 1, playerId: 7, spellId: 25202, timestamp: 100 },
        { fightId: 1, playerId: 7, spellId: 25202, timestamp: 600 },
      ],
      enemyDebuffs: [
        // debuff aura id (25203) differs from the cast id (25202); the match is
        // by resolved WCL name. 200ms on a 1000ms fight → 0.2 uptime.
        { fightId: 1, sourceId: 7, targetEnemyId: 901, spellId: 25203, startTime: 100, endTime: 300 },
      ],
      abilityMeta: {
        "25202": { name: "Demoralizing Shout" },
        "25203": { name: "Demoralizing Shout" },
      },
      itemMeta: {},
    };
    const rows = roleSheet(report, "tank", {
      roles: roleCfg,
      rpb: defaultRpbConfig(),
      avoidableDebuffIds: [],
      trinketRacials: [],
      avoidableAbilityNames: [],
    })!;
    const r = rows.find((x) => x.playerId === 7)!;
    expect(r.demoShoutCasts).toBe(2);
    expect(r.demoShoutUptime).toBeCloseTo(0.2, 5);
    // no Expose Armor activity → zeroed, not undefined
    expect(r.exposeArmorCasts).toBe(0);
    expect(r.exposeArmorUptime).toBe(0);
  });

  it("matches on-use trinkets by spell id and reports the canonical item name", () => {
    // WCL labels Bloodlust Brooch's on-use cast as its buff "Lust for Battle"
    // (spell 35166), NOT the item name — so name-only matching misses it. The
    // id match must still resolve it and surface the canonical item label.
    const report = makeReportWithHitStats();
    report.playerCasts = [
      { fightId: 1, playerId: 7, spellId: 35166, timestamp: 100 },
      { fightId: 1, playerId: 7, spellId: 35166, timestamp: 500 },
      { fightId: 1, playerId: 7, spellId: 35166, timestamp: 900 },
    ];
    report.abilityMeta = { ...report.abilityMeta, "35166": { name: "Lust for Battle" } };
    const rows = roleSheet(report, "tank", {
      roles: roleCfg,
      rpb: defaultRpbConfig(),
      avoidableDebuffIds: [],
      // canonical display name differs from the WCL cast name; match is by id
      trinketRacials: [{ spellId: 35166, name: "Bloodlust Brooch" }],
      avoidableAbilityNames: [],
    })!;
    const r = rows.find((x) => x.playerId === 7)!;
    expect(r.trinketUses.find((t) => t.name === "Bloodlust Brooch")?.count).toBe(3);
    // the raw WCL buff name is never surfaced
    expect(r.trinketUses.find((t) => t.name === "Lust for Battle")).toBeUndefined();
  });

  it("tracks totem twisting from the air-totem slot: which totem occupied the slot over time", () => {
    // fight window is report-relative [1000, 2000] (1000ms). The air-totem slot
    // holds one totem: each drop occupies it until the next air-totem drop.
    const report: ReportData = {
      reportId: "twist001",
      title: "Twist Test",
      zoneName: "Black Temple",
      startTime: 0,
      endTime: 3000,
      fights: [
        { id: 1, name: "Supremus", encounterId: 601, isBoss: true, kill: true, startTime: 1000, endTime: 2000 },
      ],
      players: [{ id: 4, name: "Blindberserk", class: "Shaman" }],
      gear: [{ fightId: 1, playerId: 4, auras: [], items: [] }],
      playerTotals: [
        { playerId: 4, healingDone: 0, damageDone: 100_000, damageTaken: 5_000, magicDamageDone: 0 },
      ],
      playerCasts: [
        // Windfury Totem (cast id 8512) @1100, Grace of Air (8835) @1400, Windfury @1700
        { fightId: 1, playerId: 4, spellId: 8512, timestamp: 1100 },
        { fightId: 1, playerId: 4, spellId: 8835, timestamp: 1400 },
        { fightId: 1, playerId: 4, spellId: 8512, timestamp: 1700 },
      ],
      abilityMeta: {
        "8512": { name: "Windfury Totem" },
        "8835": { name: "Grace of Air Totem" },
      },
      itemMeta: {},
    };
    const rows = roleSheet(report, "physical", {
      roles: roleCfg,
      rpb: defaultRpbConfig(),
      avoidableDebuffIds: [],
      trinketRacials: [],
      avoidableAbilityNames: [],
    })!;
    const r = rows.find((x) => x.playerId === 4)!;
    expect(r.twist).toBeDefined();
    // slot: WF 1100-1400 (300) + WF 1700-2000 (300) = 600 of 1000 → 0.6
    expect(r.twist!.windfuryUptime).toBeCloseTo(0.6, 5);
    // slot: Grace 1400-1700 (300) of 1000 → 0.3 (100ms before the first drop is empty)
    expect(r.twist!.graceUptime).toBeCloseTo(0.3, 5);
    expect(r.twist!.windfuryCasts).toBe(2);
    expect(r.twist!.graceCasts).toBe(1);
    // one strip for the fight, slot occupancy in fight-relative ms, time-ordered
    expect(r.twist!.segments).toHaveLength(1);
    const seg = r.twist!.segments[0]!;
    expect(seg.fightId).toBe(1);
    expect(seg.fightName).toBe("Supremus");
    expect(seg.durationMs).toBe(1000);
    expect(seg.windfuryPct).toBeCloseTo(0.6, 5);
    expect(seg.gracePct).toBeCloseTo(0.3, 5);
    expect(seg.slots).toEqual([
      { start: 100, end: 400, totem: "windfury" },
      { start: 400, end: 700, totem: "grace" },
      { start: 700, end: 1000, totem: "windfury" },
    ]);
  });

  it("counts a parked totem toward uptime but only emits a timeline strip for fights that actually twisted", () => {
    const report: ReportData = {
      reportId: "twist003",
      title: "Parked vs Twisted",
      zoneName: "Black Temple",
      startTime: 0,
      endTime: 4000,
      fights: [
        // fight 1: real twist (both totems). fight 2: Grace parked all fight.
        { id: 1, name: "Twist Fight", encounterId: 601, isBoss: true, kill: true, startTime: 0, endTime: 1000 },
        { id: 2, name: "Park Fight", encounterId: 602, isBoss: true, kill: true, startTime: 2000, endTime: 3000 },
      ],
      players: [{ id: 4, name: "Sham", class: "Shaman" }],
      gear: [{ fightId: 1, playerId: 4, auras: [], items: [] }],
      playerTotals: [
        { playerId: 4, healingDone: 0, damageDone: 100_000, damageTaken: 5_000, magicDamageDone: 0 },
      ],
      playerCasts: [
        // fight 1: WF 0-500, Grace 500-1000
        { fightId: 1, playerId: 4, spellId: 8512, timestamp: 0 },
        { fightId: 1, playerId: 4, spellId: 8835, timestamp: 500 },
        // fight 2: Grace at the pull, never swapped
        { fightId: 2, playerId: 4, spellId: 8835, timestamp: 2000 },
      ],
      abilityMeta: { "8512": { name: "Windfury Totem" }, "8835": { name: "Grace of Air Totem" } },
      itemMeta: {},
    };
    const rows = roleSheet(report, "physical", {
      roles: roleCfg,
      rpb: defaultRpbConfig(),
      avoidableDebuffIds: [],
      trinketRacials: [],
      avoidableAbilityNames: [],
    })!;
    const r = rows.find((x) => x.playerId === 4)!;
    expect(r.twist).toBeDefined();
    // denominator = both fights (1000 + 1000). WF = 500 (fight 1 only) → 0.25.
    expect(r.twist!.windfuryUptime).toBeCloseTo(0.25, 5);
    // Grace = 500 (fight 1) + 1000 (fight 2 parked) = 1500 → 0.75.
    expect(r.twist!.graceUptime).toBeCloseTo(0.75, 5);
    // only the fight where both totems were used gets a strip
    expect(r.twist!.segments.map((s) => s.fightName)).toEqual(["Twist Fight"]);
  });

  it("leaves twist undefined for a non-Shaman and for a Shaman that never dropped an air totem", () => {
    const base: ReportData = {
      reportId: "twist002",
      title: "No Twist Test",
      zoneName: "Black Temple",
      startTime: 0,
      endTime: 2000,
      fights: [
        { id: 1, name: "Supremus", encounterId: 601, isBoss: true, kill: true, startTime: 0, endTime: 1000 },
      ],
      players: [
        { id: 4, name: "IdleSham", class: "Shaman" },
        { id: 5, name: "RageWar", class: "Warrior" },
      ],
      gear: [
        { fightId: 1, playerId: 4, auras: [], items: [] },
        { fightId: 1, playerId: 5, auras: [], items: [] },
      ],
      playerTotals: [
        { playerId: 4, healingDone: 0, damageDone: 100_000, damageTaken: 5_000, magicDamageDone: 0 },
        { playerId: 5, healingDone: 0, damageDone: 100_000, damageTaken: 5_000, magicDamageDone: 0 },
      ],
      playerCasts: [
        // shaman casts something that is NOT an air totem
        { fightId: 1, playerId: 4, spellId: 25530, timestamp: 100 },
      ],
      buffs: [],
      abilityMeta: { "25530": { name: "Searing Totem" } },
      itemMeta: {},
    };
    const rows = roleSheet(base, "physical", {
      roles: roleCfg,
      rpb: defaultRpbConfig(),
      avoidableDebuffIds: [],
      trinketRacials: [],
      avoidableAbilityNames: [],
    })!;
    expect(rows.find((x) => x.playerId === 4)!.twist).toBeUndefined();
    expect(rows.find((x) => x.playerId === 5)!.twist).toBeUndefined();
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
