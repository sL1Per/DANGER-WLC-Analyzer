import { describe, expect, it } from "vitest";
import { gearListing, listGearFights } from "./gearListing";
import { reportFixture } from "./fixtures/report.fixture";

describe("listGearFights", () => {
  it("returns boss fights that have gear snapshots", () => {
    expect(listGearFights(reportFixture).map((f) => f.id)).toEqual([3]);
  });
});

describe("gearListing", () => {
  it("defaults to the last boss fight with gear", () => {
    const { fight, rows } = gearListing(reportFixture);
    expect(fight?.id).toBe(3);
    expect(rows).toHaveLength(2);
  });
  it("resolves item names per slot", () => {
    const { rows } = gearListing(reportFixture, 3);
    const p1 = rows.find((r) => r.playerName === "Playerone")!;
    expect(p1.items[0]?.name).toBe("Spellstrike Hood");
    expect(p1.items[14]?.name).toBe("Onyxia Scale Cloak");
    expect(p1.items[15]).toBeUndefined(); // no weapon recorded in fixture
  });
  it("falls back to the item id when meta is missing", () => {
    const report = structuredClone(reportFixture);
    delete (report.itemMeta as Record<string, unknown>)["24266"];
    const { rows } = gearListing(report, 3);
    expect(rows.find((r) => r.playerName === "Playerone")!.items[0]?.name).toBe("item 24266");
  });
  it("returns empty rows when the report has no gear", () => {
    const { fight, rows } = gearListing({ ...reportFixture, gear: [] });
    expect(fight).toBeNull();
    expect(rows).toEqual([]);
  });
});
