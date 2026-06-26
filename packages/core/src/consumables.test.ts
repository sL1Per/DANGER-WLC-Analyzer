import { describe, expect, it } from "vitest";
import { consumables, uptimeSeverity, type ConsumableConfig, type ConsumableRow } from "./consumables";
import { reportFixture } from "./fixtures/report.fixture";
import type { ReportData } from "./types";

const cfg: ConsumableConfig = {
  buffs: [
    { spellId: 28497, name: "Elixir of Major Agility", category: "battleElixir" },
    { spellId: 39627, name: "Elixir of Draenic Wisdom", category: "guardianElixir" },
    { spellId: 28520, name: "Flask of Relentless Assault", category: "flask" },
    { spellId: 33256, name: "Well Fed (+20 Str)", category: "food" },
    { spellId: 33077, name: "Scroll of Agility V", category: "scroll", scroll: { type: "Agi", level: 5 } },
    { spellId: 12174, name: "Scroll of Agility IV", category: "scroll", scroll: { type: "Agi", level: 4 } },
  ],
  jcNecks: [{ itemId: 24116, buffId: 31033, name: "Eye of the Night" }],
  suboptimal: [
    { kind: "buff", id: 28519, name: "Flask of Mighty Restoration" },
    { kind: "buff", id: 28490, name: "Elixir of Major Strength", stat: "strength" },
  ],
  roles: { signals: [], casterClasses: ["Mage"], physicalSpecs: [], casterSpecs: [] },
  weaponEnhancements: [2678, 2955], // Superior Wizard Oil, Adamantite Weightstone (consumables)
};

/**
 * The fixture has three boss fights (2, 3, 5) but buff intervals only on
 * fight 3 — so uptimes against the raw fixture would be diluted to
 * 100s / 240s. For readable expectations the base test report keeps fight 3
 * as the only boss fight (the trash fights stay to prove they are ignored).
 */
function baseReport(): ReportData {
  const report = structuredClone(reportFixture);
  report.fights = report.fights.filter((f) => !f.isBoss || f.id === 3);
  return report;
}

/** Two boss fights (2 and 3); the fixture's buffs are only on fight 3, so a
 * present buff yields a count-based presence fraction of 1/2. */
function twoBossReport(): ReportData {
  const report = structuredClone(reportFixture);
  report.fights = report.fights.filter((f) => !f.isBoss || f.id === 2 || f.id === 3);
  return report;
}

const rowFor = (report: ReportData, name: string): ConsumableRow => {
  const result = consumables(report, cfg);
  const row = result?.rows.find((r) => r.playerName === name);
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

describe("consumables — category uptimes", () => {
  it("computes flask/elixir/food uptimes for Playerone", () => {
    const p1 = rowFor(baseReport(), "Playerone");
    expect(p1.flask).toBe(1);
    expect(p1.battleElixir).toBe(0);
    expect(p1.guardianElixir).toBe(0);
    expect(p1.elixirOrFlask).toBe(1);
    expect(p1.food).toBe(1); // present on the single boss fight — count-based, NOT 50% of fight time
    expect(p1.scrolls).toBe("");
    expect(p1.scrollUptime).toBe(0);
  });
  it("lists the flask name(s) the player had at boss pulls", () => {
    const p1 = rowFor(baseReport(), "Playerone"); // Flask of Relentless Assault in pull auras
    expect(p1.flaskNames).toEqual(["Flask of Relentless Assault"]);
    const p2 = rowFor(baseReport(), "Playertwo"); // no flask
    expect(p2.flaskNames).toEqual([]);
  });
  it("lists each distinct flask once when a player re-flasks across boss fights", () => {
    const report = twoBossReport();
    report.gear.push({ fightId: 2, playerId: 1, auras: [28518], items: [] }); // Flask of Fortification on fight 2
    const cfgWithSecondFlask: ConsumableConfig = {
      ...cfg,
      buffs: [...cfg.buffs, { spellId: 28518, name: "Flask of Fortification", category: "flask" }],
    };
    const row = consumables(report, cfgWithSecondFlask)!.rows.find((r) => r.playerName === "Playerone")!;
    expect(row.flaskNames).toEqual(["Flask of Relentless Assault", "Flask of Fortification"]);
  });
  it("computes elixir uptimes for Playertwo", () => {
    const p2 = rowFor(baseReport(), "Playertwo");
    expect(p2.battleElixir).toBe(1);
    expect(p2.battleElixirNames).toEqual(["Elixir of Major Agility"]);
    expect(p2.guardianElixir).toBe(1);
    expect(p2.guardianElixirNames).toEqual(["Elixir of Draenic Wisdom"]);
    expect(p2.flask).toBe(0);
    expect(p2.elixirOrFlask).toBe(1);
    expect(p2.food).toBe(0);
  });
  it("treats a battle-elixir-only player as half-covered for Elixir or Flask (Blindberserk case)", () => {
    // A player with a Battle Elixir at pull but NO Guardian Elixir is only
    // half-covered: the original sheet's Elixir or Flask = max(flask, avg(battle,
    // guardian)) = max(0, avg(1, 0)) = 0.5 — not a union (which would be 1.0).
    const report = baseReport();
    // drop the guardian elixir (39627) from Playertwo's pull auras, keep battle (28497)
    report.gear.find((s) => s.playerId === 2)!.auras = [28497];
    const p2 = rowFor(report, "Playertwo");
    expect(p2.battleElixir).toBe(1);
    expect(p2.guardianElixir).toBe(0);
    expect(p2.flask).toBe(0);
    expect(p2.elixirOrFlask).toBe(0.5);
    expect(p2.totalAverage).toBe(0.25); // (elixirOrFlask 0.5 + food 0) / 2; weaponEnh 0 excluded
  });
  it("is count-based per boss fight, not within-fight time-weighted", () => {
    // Two boss fights (2 and 3); Playerone has consumables in its fight-3 pull
    // auras only and a bare fight-2 snapshot, so each is present on 1 of 2 boss
    // fights = 0.5 — regardless of how much of fight 3 they cover.
    const report = twoBossReport();
    report.gear.push({ fightId: 2, playerId: 1, auras: [], items: [] });
    const p1 = rowFor(report, "Playerone");
    expect(p1.flask).toBe(0.5);
    expect(p1.food).toBe(0.5);
    expect(p1.elixirOrFlask).toBe(0.5);
  });
  it("ignores pull auras on trash fights", () => {
    const report = twoBossReport();
    report.gear.push({ fightId: 2, playerId: 1, auras: [], items: [] }); // bare boss snapshot → food 1/2
    // a food aura on a TRASH fight snapshot must not be counted → food stays 0.5, not 0.67
    report.gear.push({ fightId: 1, playerId: 1, auras: [33256], items: [] });
    expect(rowFor(report, "Playerone").food).toBe(0.5);
  });
});

describe("consumables — weapon enhancement & totalAverage", () => {
  it("weaponEnhancement is 0 when the snapshot has no slot-15 item; 0 is excluded from totalAverage", () => {
    // Playerone's fight-3 snapshot has slots 0/4/8/10/14 but NO weapon (slot 15)
    // → weaponEnhancement 0, which the original excludes from the average →
    // (elixirOrFlask 1 + food 1) / 2 = 1
    const p1 = rowFor(baseReport(), "Playerone");
    expect(p1.weaponEnhancement).toBe(0);
    expect(p1.totalAverage).toBe(1);
  });
  it("weaponEnhancement is 0 when the weapon lacks a temporaryEnchantId", () => {
    // Playertwo's slot-15 Decapitator has a permanentEnchantId but no temp enchant
    const p2 = rowFor(baseReport(), "Playertwo");
    expect(p2.weaponEnhancement).toBe(0);
    expect(p2.totalAverage).toBe(0.5); // (elixirOrFlask 1 + food 0) / 2
  });
  it("weaponEnhancement is null when the player has no gear snapshots", () => {
    const report = baseReport();
    report.gear = report.gear.filter((s) => s.playerId !== 2);
    const p2 = rowFor(report, "Playertwo");
    expect(p2.weaponEnhancement).toBeNull();
    // no snapshots → no pull auras → all consumables 0; weaponEnh null is excluded → (0 + 0) / 2
    expect(p2.elixirOrFlask).toBe(0);
    expect(p2.totalAverage).toBe(0);
  });
  it("weaponEnhancement is 1 when the slot-15 item has a whitelisted consumable enchant", () => {
    const report = baseReport();
    report.gear[0]!.items.push({ slot: 15, itemId: 30910, temporaryEnchantId: 2678, gemIds: [] }); // Superior Wizard Oil
    const p1 = rowFor(report, "Playerone");
    expect(p1.weaponEnhancement).toBe(1);
    expect(p1.totalAverage).toBe(1); // (elixirOrFlask 1 + food 1 + weaponEnh 1) / 3
  });
  it("does NOT count a non-consumable temp enchant (shaman imbue / Windfury Totem / poison)", () => {
    // 2636 = "Windfury 5" (shaman self-imbue): WCL reports it in temporaryEnchant
    // just like an oil, but it is not a consumable, so the original sheet shows
    // 0% — the bug that gave Enhancement shamans a false 100%.
    const report = baseReport();
    report.gear[0]!.items.push({ slot: 15, itemId: 30910, temporaryEnchantId: 2636, gemIds: [] });
    expect(rowFor(report, "Playerone").weaponEnhancement).toBe(0);
  });
  it("is count-based per boss fight, not time-weighted", () => {
    // Two boss fights of very different length; enhanced on only one. Count-based
    // = 1/2 = 0.5 regardless of durations (time-weighting would skew it).
    const report = twoBossReport();
    const long = report.fights.find((f) => f.id === 2)!;
    long.startTime = 0;
    long.endTime = 1_000_000; // far longer than fight 3 (100s)
    // Playerone: enhanced on the short fight 3 only, plain weapon on the long fight 2
    report.gear = report.gear.filter((s) => s.playerId === 1);
    report.gear[0]!.items.push({ slot: 15, itemId: 30910, temporaryEnchantId: 2955, gemIds: [] });
    report.gear.push({ fightId: 2, playerId: 1, items: [{ slot: 15, itemId: 30910, gemIds: [] }] });
    expect(rowFor(report, "Playerone").weaponEnhancement).toBe(0.5);
  });
});

describe("consumables — scrolls", () => {
  it("formats scroll types with * for sub-level-5 scrolls", () => {
    const report = baseReport();
    report.gear[0]!.auras!.push(33077, 12174); // Agility V (lvl5) + Agility IV (lvl4) in Playerone's pull auras
    const p1 = rowFor(report, "Playerone");
    expect(p1.scrollUptime).toBe(1);
    expect(p1.scrolls).toBe("100% (Agi*)");
  });
  it("omits the * when only max-level scrolls were used, count-based across fights", () => {
    // Two boss fights; the scroll is in the fight-3 pull auras only → 1/2 = 0.5.
    const report = twoBossReport();
    report.gear[0]!.auras!.push(33077); // Agility V on fight 3
    report.gear.push({ fightId: 2, playerId: 1, auras: [], items: [] }); // bare fight-2 snapshot
    const p1 = rowFor(report, "Playerone");
    expect(p1.scrollUptime).toBe(0.5);
    expect(p1.scrolls).toBe("50% (Agi)");
  });
});

describe("consumables — suboptimal & JC necks", () => {
  it("collects suboptimal buff names from pull auras", () => {
    const report = baseReport();
    report.gear[0]!.auras!.push(28519); // Flask of Mighty Restoration in Playerone's pull auras
    expect(rowFor(report, "Playerone").suboptimal).toEqual(["Flask of Mighty Restoration"]);
  });
  it("flags a role-mismatched consumable (Strength elixir on a caster)", () => {
    const report = baseReport();
    report.gear[0]!.auras!.push(28490); // Elixir of Major Strength on Playerone (Mage → caster)
    expect(rowFor(report, "Playerone").suboptimal).toEqual(["Elixir of Major Strength"]);
  });
  it("does NOT flag the same consumable for a role that benefits (Strength on a melee)", () => {
    const report = baseReport();
    // give Playertwo (Warrior → physical/tank) the same Strength elixir at pull
    const p2 = report.gear.find((g) => g.playerId === 2 && g.fightId === 3)!;
    p2.auras!.push(28490);
    expect(rowFor(report, "Playertwo").suboptimal).toEqual([]);
  });
  it("counts a still-equipped JC neck (never swapped) as inactive", () => {
    const report = baseReport();
    report.gear[0]!.items.push({ slot: 1, itemId: 24116, gemIds: [] }); // wearing the JC neck at pull
    // wearing it means the buff is up too → used 1 AND inactive 1 (independent counts)
    report.gear[0]!.auras!.push(31033);
    expect(rowFor(report, "Playerone").jcNeck).toEqual({ usedOnFights: 1, inactiveOnFights: 1, equipped: true });
  });
  it("counts the neck as used (not inactive) when the buff is up but a main neck is equipped", () => {
    const report = baseReport();
    report.gear[0]!.items.push({ slot: 1, itemId: 30015, gemIds: [] }); // main neck, swapped to
    report.gear[0]!.auras!.push(31033); // but the 30-min on-use buff is still up
    expect(rowFor(report, "Playerone").jcNeck).toEqual({ usedOnFights: 1, inactiveOnFights: 0, equipped: true });
  });
  it("never counts a neck inactive on Kael'thas", () => {
    const report = baseReport();
    report.gear[0]!.items.push({ slot: 1, itemId: 24116, gemIds: [] });
    report.fights.find((f) => f.id === 3)!.name = "Kael'thas Sunstrider";
    expect(rowFor(report, "Playerone").jcNeck).toEqual({ usedOnFights: 0, inactiveOnFights: 0, equipped: false });
  });
});

describe("consumables — edge cases", () => {
  it("returns null when the report has no buff data (cached pre-M3)", () => {
    const report = baseReport();
    delete report.buffs;
    expect(consumables(report, cfg)).toBeNull();
  });
  it("returns null when boss-fight snapshots have no pull auras (cached pre-aura support)", () => {
    const report = baseReport();
    for (const s of report.gear) delete s.auras;
    expect(consumables(report, cfg)).toBeNull();
  });
  it("returns empty rows when the report has no boss fights", () => {
    const report = baseReport();
    report.fights = report.fights.filter((f) => !f.isBoss);
    expect(consumables(report, cfg)).toEqual({ rows: [] });
  });
  it("sorts rows by player name", () => {
    const names = consumables(baseReport(), cfg)!.rows.map((r) => r.playerName);
    expect(names).toEqual(["Playerone", "Playertwo"]);
  });
});

describe("uptimeSeverity", () => {
  it("maps uptimes to severities at the documented thresholds", () => {
    expect(uptimeSeverity(0.9)).toBe("minor");
    expect(uptimeSeverity(0.89)).toBe("moderate");
    expect(uptimeSeverity(0.5)).toBe("moderate");
    expect(uptimeSeverity(0.49)).toBe("major");
  });
});
