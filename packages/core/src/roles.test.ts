import { describe, expect, it } from "vitest";
import { detectRole, type RoleConfig } from "./roles";
import type { PlayerTotals, ReportData, GearSnapshot } from "./types";

const cfg: RoleConfig = {
  signals: [
    { spellId: 71, role: "tank", name: "Defensive Stance" },
    { spellId: 5487, role: "tank", name: "Bear Form" },
  ],
};

function report(totals: PlayerTotals, gear: GearSnapshot[] = []): ReportData {
  return {
    reportId: "x", title: "", zoneName: "Black Temple", startTime: 0, endTime: 1,
    fights: [], players: [{ id: totals.playerId, name: "P", class: "Druid" }],
    gear, itemMeta: {}, playerTotals: [totals],
  };
}

describe("detectRole", () => {
  it("classifies a clear healer by healing share", () => {
    const t = { playerId: 1, healingDone: 900, damageDone: 100, damageTaken: 50, magicDamageDone: 100 };
    expect(detectRole(1, report(t), cfg)).toBe("healer");
  });

  it("classifies a caster when damage is mostly magic", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 950 };
    expect(detectRole(1, report(t), cfg)).toBe("caster");
  });

  it("classifies physical when damage is mostly physical", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 50 };
    expect(detectRole(1, report(t), cfg)).toBe("physical");
  });

  it("uses a tank aura signal + high damage-taken to pick tank over physical", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 400, damageTaken: 5000, magicDamageDone: 20 };
    const gear: GearSnapshot[] = [{ fightId: 1, playerId: 1, items: [], auras: [5487] }];
    expect(detectRole(1, report(t, gear), cfg)).toBe("tank");
  });

  it("does NOT call a bear-form druid a tank when damage-taken is low (cat dps)", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 3000, damageTaken: 200, magicDamageDone: 50 };
    const gear: GearSnapshot[] = [{ fightId: 1, playerId: 1, items: [], auras: [5487] }];
    expect(detectRole(1, report(t, gear), cfg)).toBe("physical");
  });

  it("defaults to physical when there is no data", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 0, damageTaken: 0, magicDamageDone: 0 };
    expect(detectRole(1, report(t), cfg)).toBe("physical");
  });
});
