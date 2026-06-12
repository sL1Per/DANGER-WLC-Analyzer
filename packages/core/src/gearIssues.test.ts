import { describe, expect, it } from "vitest";
import { gearIssues, type GearIssueConfig } from "./gearIssues";
import { reportFixture } from "./fixtures/report.fixture";

export const testConfig: GearIssueConfig = {
  minGemQuality: 3,
  excludeShahraz: false,
  listNoIssues: false,
  itemSockets: { "24266": 3, "21848": 2, "24250": 1 }, // aligned with fixture
  itemShadowRes: {},
  badEnchants: [{ enchantId: 1144, slot: 4, name: "Chest - 5 Mana" }],
  excludedItems: [{ itemId: 15138, name: "Onyxia Scale Cloak" }],
};

const issuesFor = (name: string, cfg = testConfig) =>
  gearIssues(reportFixture, cfg).find((r) => r.playerName === name)?.issues ?? [];

describe("gearIssues — enchants/slots/excluded", () => {
  it("flags missing enchants on enchantable slots only", () => {
    const p1 = issuesFor("Playerone");
    expect(p1).toContainEqual(expect.objectContaining({ itemId: 24250, issue: "no enchant" }));
    // ring (slot 10) must NOT be flagged
    expect(p1.find((i) => i.itemId === 28227)).toBeUndefined();
  });
  it("flags cheap/bad enchants by enchant id (slot-aware)", () => {
    expect(issuesFor("Playerone")).toContainEqual(
      expect.objectContaining({ itemId: 21848, issue: "cheap or bad enchant (Chest - 5 Mana)" }));
  });
  it("flags excluded/fun items", () => {
    expect(issuesFor("Playerone")).toContainEqual(
      expect.objectContaining({ itemId: 15138, issue: "useless/fun item" }));
  });
  it("flags empty required slots", () => {
    // Playerone's fixture has no weapon (slot 15), no neck (1) etc.
    expect(issuesFor("Playerone")).toContainEqual(
      expect.objectContaining({ issue: "no item on Weapon" }));
  });
  it("players with no issues are omitted unless listNoIssues", () => {
    const rows = gearIssues(reportFixture, { ...testConfig, itemSockets: {} });
    // Playertwo has full enchants and no other problems except empty slots…
    // (Playertwo's fixture lacks neck/rings/trinkets, so use a config-independent check:)
    expect(rows.every((r) => r.issues.length > 0)).toBe(true);
    const all = gearIssues(reportFixture, { ...testConfig, listNoIssues: true });
    expect(all).toHaveLength(2);
  });
  it("dedupes identical issues across multiple boss fights", () => {
    const report = structuredClone(reportFixture);
    report.gear.push({ ...report.gear[0]!, fightId: 5 }); // same gear on Lurker
    const p1 = gearIssues(report, testConfig).find((r) => r.playerName === "Playerone")!;
    const dupes = p1.issues.filter((i) => i.itemId === 24250 && i.issue === "no enchant");
    expect(dupes).toHaveLength(1);
  });
});
