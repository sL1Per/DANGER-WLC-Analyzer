import { describe, expect, it } from "vitest";
import { validate, type ValidateConfig } from "./validate";
import { reportFixture } from "./fixtures/report.fixture";
import type { ReportData } from "./types";

const cfg: ValidateConfig = {
  zoneCodeByName: { "Serpentshrine Cavern": "SSC" },
  rules: [{
    zone: "SSC",
    verified: false,
    boss: { kind: "single", count: 2 },
    startingPointNpcIds: [21508], // Underbog Colossus (first fixture pull)
    trash: [
      { name: "Underbog Colossus", npcIds: [21508], minKills: 1 },
      { name: "Coilfang Shatterer", npcIds: [99999], minKills: 3 }, // not enough
    ],
  }],
};

function report(): ReportData {
  return structuredClone({
    ...reportFixture,
    npcKills: { "21508": 1, "99999": 1 },
    firstPullNpcIds: [21508],
  });
}

describe("validate", () => {
  it("counts kills per trash requirement and flags shortfalls", () => {
    const r = validate(report(), cfg)!;
    expect(r.zone).toBe("SSC");
    const colossus = r.trash.find((t) => t.name.startsWith("Underbog"))!;
    expect(colossus.killed).toBe(1);
    expect(colossus.enough).toBe(true);
    expect(colossus.severity).toBe("minor");
    const shatterer = r.trash.find((t) => t.name.startsWith("Coilfang"))!;
    expect(shatterer.killed).toBe(1);
    expect(shatterer.enough).toBe(false);
    expect(shatterer.severity).toBe("major");
  });
  it("counts boss kills and the valid starting point, then the overall verdict", () => {
    const r = validate(report(), cfg)!;
    expect(r.bosses.killed).toBe(2); // fixture has 2 boss kills (Hydross kill + Lurker)
    expect(r.bosses.enough).toBe(true);
    expect(r.validStartingPoint).toBe(true);
    expect(r.totalCharacters).toBe(2);
    expect(r.isValid).toBe(false); // shatterer requirement unmet
  });
  it("renders the split boss requirement text", () => {
    const split: ValidateConfig = { ...cfg, rules: [{ ...cfg.rules[0]!, boss: { kind: "split", count1: 5, label1: "MH", count2: 9, label2: "BT" } }] };
    expect(validate(report(), split)!.bosses.required).toBe("5 for MH and 9 for BT");
  });
  it("honours a manual zone override", () => {
    const r = validate(report(), cfg, { zoneOverride: "SSC" })!;
    expect(r.zone).toBe("SSC");
    expect(r.unsupportedZone).toBe(false);
  });
  it("reports unsupported zones gracefully", () => {
    const r = validate({ ...report(), zoneName: "Naxxramas" }, cfg)!;
    expect(r.unsupportedZone).toBe(true);
    expect(r.isValid).toBe(false);
  });
  it("returns null when the report predates M4 (no npc kill data)", () => {
    const r = structuredClone(reportFixture); // no npcKills
    expect(validate(r, cfg)).toBeNull();
  });
});
