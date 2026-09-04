import { describe, expect, it } from "vitest";
import type { RpbRow, ConsumableRow, PlayerGearIssues } from "@wcl/core";
import { buildFlags } from "./flags";

// Defaults describe a fully "clean" player — no test needs to override a
// field to avoid an unrelated flag firing, and each test isolates exactly
// the one condition it names by overriding exactly that field.
function makeRpbRow(over: Partial<RpbRow> = {}): RpbRow {
  return {
    playerId: 1, playerName: "Madnap", className: "Rogue", role: "physical",
    deaths: 0, interruptedSpells: 1, interruptSources: ["Kick"],
    totalAbsorbed: 0, friendlyFire: 0, damageReflected: 0, damageToHostilePlayers: 0,
    totalAvoidableDamageTaken: 0, totalPartlyAvoidable: 0, classRows: [],
    engineeringDamage: 0, oilOfImmolationDamage: 0, battleShoutUptime: 1,
    activity: null, severity: "ok",
    ...over,
  };
}

function makeConsRow(over: Partial<ConsumableRow> = {}): ConsumableRow {
  return {
    playerId: 1, playerName: "Madnap",
    elixirOrFlask: 1, battleElixir: 0, battleElixirNames: [],
    guardianElixir: 0, guardianElixirNames: [], flask: 1, flaskNames: [],
    food: 1, scrolls: "", scrollUptime: 0, weaponEnhancement: 1,
    jcNeck: { usedOnFights: 0, inactiveOnFights: 0, equipped: false },
    suboptimal: [], totalAverage: 1,
    ...over,
  };
}

function makeGearRow(over: Partial<PlayerGearIssues> = {}): PlayerGearIssues {
  return { playerId: 1, playerName: "Madnap", issues: [], ...over };
}

describe("buildFlags", () => {
  it("returns no rows when everyone is clean", () => {
    const result = buildFlags([makeRpbRow()], [makeConsRow()], [makeGearRow()]);
    expect(result.rows).toHaveLength(0);
    expect(result.flaggedCount).toBe(0);
    expect(result.majorCount).toBe(0);
  });

  it("flags a missing flask as major", () => {
    const result = buildFlags([makeRpbRow()], [makeConsRow({ elixirOrFlask: 0.2 })], [makeGearRow()]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].severity).toBe("major");
    expect(result.rows[0].chips).toContainEqual({ text: "No flask", severity: "major" });
  });

  it("flags missing food as major", () => {
    const result = buildFlags([makeRpbRow()], [makeConsRow({ food: 0.1 })], [makeGearRow()]);
    expect(result.rows[0].chips).toContainEqual({ text: "Food ✗", severity: "major" });
  });

  it("flags low Battle Shout uptime as moderate", () => {
    const result = buildFlags([makeRpbRow({ battleShoutUptime: 0.57 })], [makeConsRow()], [makeGearRow()]);
    expect(result.rows[0].chips).toContainEqual({ text: "Battle Shout uptime 57%", severity: "moderate" });
    expect(result.rows[0].severity).toBe("moderate");
  });

  it("flags zero interrupts as moderate for a physical-role player", () => {
    const result = buildFlags([makeRpbRow({ role: "physical", interruptedSpells: 0 })], [makeConsRow()], [makeGearRow()]);
    expect(result.rows[0].chips).toContainEqual({ text: "0 interrupts", severity: "moderate" });
  });

  it("does not flag zero interrupts for a tank or healer", () => {
    const result = buildFlags(
      [makeRpbRow({ role: "tank", interruptedSpells: 0 }), makeRpbRow({ playerId: 2, playerName: "Gyzmoff", role: "healer", interruptedSpells: 0 })],
      [makeConsRow(), makeConsRow({ playerId: 2, playerName: "Gyzmoff" })],
      [makeGearRow(), makeGearRow({ playerId: 2, playerName: "Gyzmoff" })],
    );
    expect(result.rows).toHaveLength(0);
  });

  it("flags a death as moderate", () => {
    const result = buildFlags([makeRpbRow({ deaths: 1 })], [makeConsRow()], [makeGearRow()]);
    expect(result.rows[0].chips).toContainEqual({ text: "1 death", severity: "moderate" });
  });

  it("flags heavy avoidable damage as moderate", () => {
    const result = buildFlags([makeRpbRow({ totalAvoidableDamageTaken: 41120 })], [makeConsRow()], [makeGearRow()]);
    expect(result.rows[0].chips).toContainEqual({ text: "41,120 avoidable damage taken", severity: "moderate" });
  });

  it("does not flag avoidable damage under the threshold", () => {
    const result = buildFlags([makeRpbRow({ totalAvoidableDamageTaken: 5000 })], [makeConsRow()], [makeGearRow()]);
    expect(result.rows).toHaveLength(0);
  });

  it("counts gear issues as one moderate chip with a count", () => {
    const gearRow = makeGearRow({ issues: [
      { itemId: 111, itemName: "Vengeance Wrap", issue: "no enchant", severity: "moderate" },
      { itemId: 222, itemName: "Dragonstrike", issue: "no weapon oil", severity: "major" },
    ] });
    const result = buildFlags([makeRpbRow()], [makeConsRow()], [gearRow]);
    expect(result.rows[0].chips).toContainEqual({ text: "2 gear flags", severity: "moderate" });
  });

  it("excludes synthetic itemId:0 'no item' entries from the gear chip count and major escalation", () => {
    const gearRow = makeGearRow({ issues: [
      { itemId: 111, itemName: "Vengeance Wrap", issue: "no enchant", severity: "moderate" },
      { itemId: 0, itemName: "", issue: "no item on Chest", severity: "major" },
    ] });
    const result = buildFlags([makeRpbRow()], [makeConsRow()], [gearRow]);
    expect(result.rows[0].chips).toContainEqual({ text: "1 gear flag", severity: "moderate" });
    expect(result.rows[0].severity).toBe("moderate");
  });

  it("does not flag consumables for a player with no gear snapshot in scope (weaponEnhancement null)", () => {
    const result = buildFlags(
      [makeRpbRow()],
      [makeConsRow({ elixirOrFlask: 0, food: 0, weaponEnhancement: null })],
      [makeGearRow()],
    );
    expect(result.rows).toHaveLength(0);
  });

  it("escalates a player to major severity when the RPB row itself is major", () => {
    const result = buildFlags([makeRpbRow({ severity: "major", deaths: 1 })], [makeConsRow()], [makeGearRow()]);
    expect(result.rows[0].severity).toBe("major");
  });

  it("sorts rows worst-first: major before moderate, more chips before fewer", () => {
    const result = buildFlags(
      [
        makeRpbRow({ playerId: 1, playerName: "A", deaths: 1 }),
        makeRpbRow({ playerId: 2, playerName: "B", severity: "major", battleShoutUptime: 0.5 }),
      ],
      [makeConsRow({ playerId: 1, playerName: "A" }), makeConsRow({ playerId: 2, playerName: "B", elixirOrFlask: 0.1 })],
      [makeGearRow({ playerId: 1, playerName: "A" }), makeGearRow({ playerId: 2, playerName: "B" })],
    );
    expect(result.rows[0].playerName).toBe("B");
  });

  it("reports flaggedCount and majorCount across the roster", () => {
    const result = buildFlags(
      [makeRpbRow({ playerId: 1, playerName: "A", deaths: 1 }), makeRpbRow({ playerId: 2, playerName: "B", severity: "major" })],
      [makeConsRow({ playerId: 1, playerName: "A" }), makeConsRow({ playerId: 2, playerName: "B", elixirOrFlask: 0.1 })],
      [makeGearRow({ playerId: 1, playerName: "A" }), makeGearRow({ playerId: 2, playerName: "B" })],
    );
    expect(result.flaggedCount).toBe(2);
    expect(result.majorCount).toBe(1);
  });
});
