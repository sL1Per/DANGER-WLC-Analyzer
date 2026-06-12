import { describe, expect, it } from "vitest";
import { normalizeReport } from "./normalize";
import type { RawReport, RawCombatantInfo } from "./wcl";

const raw: RawReport = {
  title: "T5 fun",
  startTime: 1_700_000_000_000,
  endTime: 1_700_000_400_000,
  zone: { name: "Serpentshrine Cavern" },
  fights: [
    { id: 1, name: "Underbog Colossus", encounterID: 0, kill: null, startTime: 0, endTime: 60_000 },
    { id: 2, name: "Hydross the Unstable", encounterID: 623, kill: false, startTime: 70_000, endTime: 130_000 },
  ],
  masterData: { actors: [{ id: 7, name: "Playerone", subType: "Mage" }] },
};

describe("normalizeReport", () => {
  it("maps raw WCL fields onto ReportData", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw);
    expect(data.reportId).toBe("a1B2c3D4e5F6g7H8");
    expect(data.zoneName).toBe("Serpentshrine Cavern");
    expect(data.fights[0]).toMatchObject({ id: 1, isBoss: false, kill: undefined });
    expect(data.fights[1]).toMatchObject({ id: 2, isBoss: true, kill: false, encounterId: 623 });
    expect(data.players).toEqual([{ id: 7, name: "Playerone", class: "Mage" }]);
  });
  it("throws for non-TBC zones", () => {
    expect(() => normalizeReport("a1B2c3D4e5F6g7H8", { ...raw, zone: { name: "Naxxramas" } }))
      .toThrow(/TBC/);
  });
  it("throws when zone is missing", () => {
    expect(() => normalizeReport("a1B2c3D4e5F6g7H8", { ...raw, zone: null })).toThrow(/zone/i);
  });
  it("throws 422 when masterData is null (private/restricted report)", () => {
    expect(() => normalizeReport("a1B2c3D4e5F6g7H8", { ...raw, masterData: null }))
      .toThrow(/private or restricted/i);
  });
});

describe("normalizeReport — gear", () => {
  const combatants: RawCombatantInfo[] = [
    { sourceID: 7, fight: 2, gear: [
      { id: 24266, slot: 0, permanentEnchant: 29191, gems: [{ id: 24030 }] },
      { id: 0, slot: 3 },         // empty shirt slot — dropped
    ] },
  ];
  const itemMeta = { "24266": { name: "Spellstrike Hood", quality: 4 } };

  it("maps combatant info onto GearSnapshots and itemMeta", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, combatants, itemMeta);
    expect(data.gear).toEqual([{
      fightId: 2, playerId: 7, items: [{
        slot: 0, itemId: 24266, itemLevel: undefined,
        permanentEnchantId: 29191, temporaryEnchantId: undefined, gemIds: [24030],
      }],
    }]);
    expect(data.itemMeta["24266"]?.name).toBe("Spellstrike Hood");
  });
  it("defaults to empty gear when not provided", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw);
    expect(data.gear).toEqual([]);
    expect(data.itemMeta).toEqual({});
  });
});
