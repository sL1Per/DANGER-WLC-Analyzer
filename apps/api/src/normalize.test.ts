import { describe, expect, it } from "vitest";
import { normalizeReport } from "./normalize";
import type { RawReport } from "./wcl";

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
});
