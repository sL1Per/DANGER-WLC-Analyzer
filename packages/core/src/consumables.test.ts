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
  jcNecks: [{ itemId: 24097, buffId: 31000, name: "Pendant of Shadow's End" }],
  suboptimal: [{ kind: "buff", id: 28519, name: "Flask of Mighty Restoration" }],
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
    expect(p1.food).toBe(0.5);
    expect(p1.scrolls).toBe("");
    expect(p1.scrollUptime).toBe(0);
  });
  it("computes elixir uptimes for Playertwo", () => {
    const p2 = rowFor(baseReport(), "Playertwo");
    expect(p2.battleElixir).toBe(1);
    expect(p2.guardianElixir).toBe(1);
    expect(p2.flask).toBe(0);
    expect(p2.elixirOrFlask).toBe(1);
    expect(p2.food).toBe(0);
  });
  it("merges overlapping intervals instead of summing them", () => {
    const report = baseReport();
    // a second, different food buff overlapping the first (150–200k):
    // merged window is 150–225k = 75s of the 100s fight, NOT 50s + 50s
    report.buffs!.push({ fightId: 3, targetId: 1, spellId: 33258, startTime: 175_000, endTime: 225_000 });
    const cfg2: ConsumableConfig = {
      ...cfg,
      buffs: [...cfg.buffs, { spellId: 33258, name: "Well Fed (+20 Spi)", category: "food" }],
    };
    const p1 = consumables(report, cfg2)!.rows.find((r) => r.playerName === "Playerone")!;
    expect(p1.food).toBe(0.75);
  });
  it("ignores buff intervals on trash fights", () => {
    const report = baseReport();
    report.buffs!.push({ fightId: 1, targetId: 1, spellId: 33256, startTime: 0, endTime: 60_000 });
    expect(rowFor(report, "Playerone").food).toBe(0.5);
  });
});

describe("consumables — weapon enhancement & totalAverage", () => {
  it("weaponEnhancement is 0 when the snapshot has no slot-15 item; 0 is excluded from totalAverage", () => {
    // Playerone's fight-3 snapshot has slots 0/4/8/10/14 but NO weapon (slot 15):
    // the fight counts in the denominator but not the numerator → 0, which the
    // original's sample data excludes from the average → (1 + 0.5) / 2 = 0.75
    const p1 = rowFor(baseReport(), "Playerone");
    expect(p1.weaponEnhancement).toBe(0);
    expect(p1.totalAverage).toBe(0.75);
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
    expect(p2.totalAverage).toBe(0.5); // null excluded → (1 + 0) / 2
  });
  it("weaponEnhancement is 1 when the slot-15 item has a temporaryEnchantId", () => {
    const report = baseReport();
    report.gear[0]!.items.push({ slot: 15, itemId: 30910, temporaryEnchantId: 2678, gemIds: [] });
    const p1 = rowFor(report, "Playerone");
    expect(p1.weaponEnhancement).toBe(1);
    expect(p1.totalAverage).toBeCloseTo((1 + 0.5 + 1) / 3, 10);
  });
});

describe("consumables — scrolls", () => {
  it("formats scroll types with * for sub-level-5 scrolls", () => {
    const report = baseReport();
    report.buffs!.push(
      { fightId: 3, targetId: 1, spellId: 33077, startTime: 150_000, endTime: 250_000 },
      { fightId: 3, targetId: 1, spellId: 12174, startTime: 150_000, endTime: 200_000 },
    );
    const p1 = rowFor(report, "Playerone");
    expect(p1.scrollUptime).toBe(1);
    expect(p1.scrolls).toBe("100% (Agi*)");
  });
  it("omits the * when only max-level scrolls were used", () => {
    const report = baseReport();
    report.buffs!.push({ fightId: 3, targetId: 1, spellId: 33077, startTime: 150_000, endTime: 200_000 });
    const p1 = rowFor(report, "Playerone");
    expect(p1.scrollUptime).toBe(0.5);
    expect(p1.scrolls).toBe("50% (Agi)");
  });
});

describe("consumables — suboptimal & JC necks", () => {
  it("collects suboptimal buff names", () => {
    const report = baseReport();
    report.buffs!.push({ fightId: 3, targetId: 1, spellId: 28519, startTime: 150_000, endTime: 250_000 });
    expect(rowFor(report, "Playerone").suboptimal).toEqual(["Flask of Mighty Restoration"]);
  });
  it("counts an equipped-but-unused JC neck as inactive", () => {
    const report = baseReport();
    report.gear[0]!.items.push({ slot: 1, itemId: 24097, gemIds: [] });
    expect(rowFor(report, "Playerone").jcNeck).toEqual({ usedOnFights: 0, inactiveOnFights: 1, equipped: true });
  });
  it("counts the neck as used when its on-use buff appears in the fight", () => {
    const report = baseReport();
    report.gear[0]!.items.push({ slot: 1, itemId: 24097, gemIds: [] });
    report.buffs!.push({ fightId: 3, targetId: 1, spellId: 31000, startTime: 160_000, endTime: 175_000 });
    expect(rowFor(report, "Playerone").jcNeck).toEqual({ usedOnFights: 1, inactiveOnFights: 0, equipped: true });
  });
  it("never counts a neck inactive on Kael'thas", () => {
    const report = baseReport();
    report.gear[0]!.items.push({ slot: 1, itemId: 24097, gemIds: [] });
    report.fights.find((f) => f.id === 3)!.name = "Kael'thas Sunstrider";
    expect(rowFor(report, "Playerone").jcNeck).toEqual({ usedOnFights: 0, inactiveOnFights: 0, equipped: true });
  });
});

describe("consumables — edge cases", () => {
  it("returns null when the report has no buff data (cached pre-M3)", () => {
    const report = baseReport();
    delete report.buffs;
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
