import { describe, expect, it } from "vitest";
import { shadowResistance, type ShadowResConfig } from "./shadowResistance";
import type { ReportData } from "./types";

const cfg: ShadowResConfig = {
  itemShadowRes: { "34204": 30 },   // Pendant of Shadow's End
  enchantShadowRes: { "2664": 15 }, // (test-local enchant id) cloak +15 SR
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
        { slot: 1, itemId: 34204, gemIds: [] },                            // neck: ~30 innate
        { slot: 14, itemId: 30000, gemIds: [], permanentEnchantId: 2664 }, // cloak: +15 enchant
      ],
    }],
    itemMeta: { "34204": { name: "Pendant of Shadow's End" } },
  };
}
const KILL = { id: 60, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: true, startTime: 400_000, endTime: 560_000 };

describe("shadowResistance", () => {
  it("sums SR from gear (items + enchants) and from buffs on the kill fight", () => {
    const r = shadowResistance(report([KILL]), cfg, { boss: "Mother Shahraz" })!;
    expect(r.boss).toBe("Mother Shahraz");
    expect(r.isKill).toBe(true);
    const p = r.players.find((x) => x.name === "Playertwo")!;
    expect(p.fromGear).toBe(45);  // 30 innate + 15 enchant
    expect(p.fromBuffs).toBe(70); // Shadow Protection
    expect(p.total).toBe(115);
    expect(p.slots[1]).toMatch(/~30 SR/);   // neck innate
    expect(p.slots[14]).toMatch(/\+15 SR/); // cloak enchant
    expect(p.severity).toBe("minor"); // 115 ≥ 100 soft target → ok/green
  });
  it("returns null when the report has none of the SR bosses", () => {
    const noBoss = report([{ id: 1, name: "Najentus", encounterId: 601, isBoss: true, kill: true, startTime: 0, endTime: 100 }]);
    expect(shadowResistance(noBoss, cfg)).toBeNull();
  });
  it("analyzes the longest wipe when there is no kill", () => {
    // two Shahraz wipes; the gear snapshot is on fight 60 (the longer wipe)
    const r = shadowResistance(report([
      { id: 59, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: false, startTime: 0, endTime: 30_000 },
      { id: 60, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: false, startTime: 100_000, endTime: 260_000 },
    ]), cfg, { boss: "Mother Shahraz" })!;
    expect(r.isKill).toBe(false);
    expect(r.fightId).toBe(60); // longer wipe (160s vs 30s)
    expect(r.players.find((x) => x.name === "Playertwo")!.total).toBe(115);
  });
});
