import { describe, expect, it } from "vitest";
import { shadowResistance, type ShadowResConfig } from "./shadowResistance";
import type { ReportData } from "./types";

const cfg: ShadowResConfig = {
  itemShadowRes: { "34204": 30 },   // Pendant of Shadow's End
  enchantShadowRes: {
    "2664": 15, // (test-local enchant id) cloak +15 SR
    "3009": 20, // Glyph of Shadow Warding (head)
    "2984": 8,  // Shadow Armor Kit (chest/legs/hands/feet)
  },
  gemShadowRes: { "22459": 4 },     // Void Sphere (+4 all resist)
  buffShadowRes: { "25433": 70 },   // Shadow Protection
  softTarget: 100,
};

function report(fights: ReportData["fights"]): ReportData {
  return {
    reportId: "sr", title: "BT", zoneName: "Black Temple",
    startTime: 0, endTime: 1_000_000,
    fights,
    players: [{ id: 2, name: "Playertwo", class: "Priest" }],
    gear: [{
      fightId: 60, playerId: 2, auras: [25433],
      items: [
        { slot: 1, itemId: 34204, gemIds: [] },                             // neck: ~30 innate
        { slot: 14, itemId: 30000, gemIds: [], permanentEnchantId: 2664 },  // cloak: +15 enchant
        { slot: 0, itemId: 40000, gemIds: [], permanentEnchantId: 3009 },   // head: +20 enchant
        { slot: 9, itemId: 40001, gemIds: [22459], permanentEnchantId: 2984 }, // hands: +8 enchant + 4 gem
        { slot: 7, itemId: 40002, gemIds: [], permanentEnchantId: 2984 },   // feet: +8 enchant
      ],
    }],
    itemMeta: { "34204": { name: "Pendant of Shadow's End" } },
  };
}
const KILL = { id: 60, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: true, startTime: 400_000, endTime: 560_000 };

describe("shadowResistance", () => {
  it("sums SR from gear (items + enchants) and from buffs on the kill fight", () => {
    const r = shadowResistance(report([KILL]), cfg)!;
    expect(r.boss).toBe("Mother Shahraz");
    expect(r.isKill).toBe(true);
    const p = r.players.find((x) => x.name === "Playertwo")!;
    expect(p.fromGear).toBe(85);  // 30 innate + 15 + 20 + 8 + 8 enchants + 4 gem
    expect(p.fromBuffs).toBe(70); // Shadow Protection
    expect(p.total).toBe(155);
    expect(p.slots[1]).toBe("~30 SR");  // neck innate — no item name, just the value
    expect(p.slots[14]).toBe("+15 SR"); // cloak enchant
    expect(p.severity).toBe("minor"); // 155 ≥ 100 soft target → ok/green
  });

  it("counts SR from head/hands/feet enchants and from socketed gems", () => {
    const r = shadowResistance(report([KILL]), cfg)!;
    const p = r.players.find((x) => x.name === "Playertwo")!;
    expect(p.slots[0]).toBe("+20 SR"); // head enchant (Glyph of Shadow Warding)
    expect(p.slots[7]).toBe("+8 SR");  // feet enchant (Shadow Armor Kit)
    expect(p.slots[9]).toBe("+12 SR"); // hands: enchant (8) + socketed Void Sphere (4), combined
  });
  it("returns null when the report has none of the SR bosses", () => {
    const noBoss = report([{ id: 1, name: "Najentus", encounterId: 601, isBoss: true, kill: true, startTime: 0, endTime: 100 }]);
    expect(shadowResistance(noBoss, cfg)).toBeNull();
  });
  it("without a fightId, analyzes the longest wipe when there is no kill (the combined BOSSES card)", () => {
    // two Shahraz wipes; the gear snapshot is on fight 60 (the longer wipe)
    const r = shadowResistance(report([
      { id: 59, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: false, startTime: 0, endTime: 30_000 },
      { id: 60, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: false, startTime: 100_000, endTime: 260_000 },
    ]), cfg)!;
    expect(r.isKill).toBe(false);
    expect(r.fightId).toBe(60); // longer wipe (160s vs 30s)
    expect(r.players.find((x) => x.name === "Playertwo")!.total).toBe(155);
  });
  it("a fightId pins the analysis to that exact pull, not the kill/longest-wipe default", () => {
    // the shorter wipe (59) has no gear snapshot — requesting it explicitly
    // must NOT fall back to fight 60's snapshot.
    const r = shadowResistance(report([
      { id: 59, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: false, startTime: 0, endTime: 30_000 },
      { id: 60, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: false, startTime: 100_000, endTime: 260_000 },
    ]), cfg, { fightId: 59 })!;
    expect(r.fightId).toBe(59);
    expect(r.isKill).toBe(false);
    expect(r.players).toEqual([]);
  });
  it("returns null for a fightId that isn't an SR-relevant boss fight", () => {
    const r = report([
      KILL,
      { id: 1, name: "Trash", encounterId: 0, isBoss: false, startTime: 0, endTime: 100 },
      { id: 2, name: "Najentus", encounterId: 601, isBoss: true, kill: true, startTime: 100, endTime: 200 },
    ]);
    expect(shadowResistance(r, cfg, { fightId: 1 })).toBeNull();
    expect(shadowResistance(r, cfg, { fightId: 2 })).toBeNull();
  });
});
