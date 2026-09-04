import { describe, expect, it } from "vitest";
import { detectRole, type RoleConfig } from "./roles";
import type { PlayerTotals, ReportData, GearSnapshot, ReportRanking, PlayerCast } from "./types";

const cfg: RoleConfig = {
  signals: [
    { spellId: 71, role: "tank", name: "Defensive Stance" },
    { spellId: 5487, role: "tank", name: "Bear Form" },
  ],
  casterClasses: ["Mage", "Warlock", "Priest", "Shaman"],
  physicalSpecs: ["Enhancement"],
  casterSpecs: ["Balance"],
  physicalSpecCastNames: ["Stormstrike"],
};

function report(
  totals: PlayerTotals,
  className = "Druid",
  gear: GearSnapshot[] = [],
  rankings?: ReportRanking[],
  casts?: PlayerCast[],
): ReportData {
  return {
    reportId: "x", title: "", zoneName: "Black Temple", startTime: 0, endTime: 1,
    fights: [], players: [{ id: totals.playerId, name: "P", class: className }],
    gear, itemMeta: {}, playerTotals: [totals], rankings,
    playerCasts: casts,
    abilityMeta: casts ? { "17364": { name: "Stormstrike" }, "403": { name: "Lightning Bolt" } } : undefined,
  };
}

function ranking(name: string, className: string, spec: string): ReportRanking[] {
  return [{
    fightID: 1, encounterId: 1, encounterName: "Boss",
    tanks: [], healers: [],
    dps: [{ name, class: className, spec, rankPercent: 90, bracketPercent: 90, parse: 900 }],
  }];
}

describe("detectRole", () => {
  it("classifies a clear healer by healing share regardless of class", () => {
    const t = { playerId: 1, healingDone: 900, damageDone: 100, damageTaken: 50, magicDamageDone: 100 };
    expect(detectRole(1, report(t, "Priest"), cfg)).toBe("healer");
  });

  it("classifies a DPS caster class as caster", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 1000 };
    expect(detectRole(1, report(t, "Mage"), cfg)).toBe("caster");
  });

  it("classifies a DPS melee class as physical", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 1000 };
    expect(detectRole(1, report(t, "Warrior"), cfg)).toBe("physical");
  });

  it("uses a tank aura signal + high damage-taken to pick tank over the class default", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 400, damageTaken: 5000, magicDamageDone: 20 };
    const gear: GearSnapshot[] = [{ fightId: 1, playerId: 1, items: [], auras: [5487] }];
    expect(detectRole(1, report(t, "Druid", gear), cfg)).toBe("tank");
  });

  it("does NOT call a bear-form druid a tank when damage-taken is low (cat dps → physical)", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 3000, damageTaken: 200, magicDamageDone: 50 };
    const gear: GearSnapshot[] = [{ fightId: 1, playerId: 1, items: [], auras: [5487] }];
    expect(detectRole(1, report(t, "Druid", gear), cfg)).toBe("physical");
  });

  it("classifies an Enhancement shaman as physical despite the caster class default", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 200 };
    const r = report(t, "Shaman", [], ranking("P", "Shaman", "Enhancement"));
    expect(detectRole(1, r, cfg)).toBe("physical");
  });

  it("keeps an Elemental shaman a caster (spec does not override)", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 1000 };
    const r = report(t, "Shaman", [], ranking("P", "Shaman", "Elemental"));
    expect(detectRole(1, r, cfg)).toBe("caster");
  });

  it("classifies a Shaman with a Stormstrike cast as physical when there is no ranking spec (unranked/wiped report)", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 200 };
    const casts: PlayerCast[] = [{ fightId: 1, playerId: 1, spellId: 17364, timestamp: 0 }];
    const r = report(t, "Shaman", [], undefined, casts);
    expect(detectRole(1, r, cfg)).toBe("physical");
  });

  it("keeps a Shaman with no rankings and no Stormstrike cast a caster (elemental/resto default)", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 900 };
    const casts: PlayerCast[] = [{ fightId: 1, playerId: 1, spellId: 403, timestamp: 0 }];
    const r = report(t, "Shaman", [], undefined, casts);
    expect(detectRole(1, r, cfg)).toBe("caster");
  });

  it("does not let a Stormstrike cast override an explicit non-physical ranking spec", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 900 };
    const casts: PlayerCast[] = [{ fightId: 1, playerId: 1, spellId: 17364, timestamp: 0 }];
    const r = report(t, "Shaman", [], ranking("P", "Shaman", "Elemental"), casts);
    expect(detectRole(1, r, cfg)).toBe("caster");
  });

  it("classifies a Balance druid as caster despite the physical class default", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 1000 };
    const r = report(t, "Druid", [], ranking("P", "Druid", "Balance"));
    expect(detectRole(1, r, cfg)).toBe("caster");
  });

  it("keeps a Feral druid physical (spec does not override)", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 1000, damageTaken: 50, magicDamageDone: 50 };
    const r = report(t, "Druid", [], ranking("P", "Druid", "Feral"));
    expect(detectRole(1, r, cfg)).toBe("physical");
  });

  it("falls back to the class default when there are no totals", () => {
    const t = { playerId: 1, healingDone: 0, damageDone: 0, damageTaken: 0, magicDamageDone: 0 };
    const r = report(t, "Warlock");
    delete r.playerTotals;
    expect(detectRole(1, r, cfg)).toBe("caster");
  });
});
