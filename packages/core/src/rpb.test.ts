import { describe, expect, it } from "vitest";
import { rpb, type RpbConfig } from "./rpb";
import { reportFixture } from "./fixtures/report.fixture";
import type { RpbRow } from "./rpb";

const cfg: RpbConfig = {
  roles: { signals: [{ spellId: 5487, role: "tank", name: "Bear Form" }] },
  activity: { castTimes: { "30451": 25 }, hasteBuffs: [], aoeWindowMs: 500 },
  engineeringDamageIds: [30461],
  oilOfImmolationSpellId: 11350,
  battleShoutBuffIds: [2048],
  absorbExcludedSpellIds: [],
};

const rowFor = (name: string): RpbRow => {
  const res = rpb(reportFixture, cfg);
  const row = res?.rows.find((r) => r.playerName === name);
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

describe("rpb", () => {
  it("returns null when the report predates M5a", () => {
    const r = structuredClone(reportFixture);
    delete r.playerTotals;
    expect(rpb(r, cfg)).toBeNull();
  });

  it("detects roles and groups players", () => {
    expect(rowFor("Playerone").role).toBe("caster");
    expect(rowFor("Playertwo").role).toBe("physical");
  });

  it("counts deaths, interrupts, and absorbs", () => {
    expect(rowFor("Playertwo").deaths).toBe(1);
    const p1 = rowFor("Playerone");
    expect(p1.interruptedSpells).toBe(1);
    expect(p1.interruptSources).toEqual(["Hydross the Unstable"]);
    expect(p1.totalAbsorbed).toBe(1200);
  });

  it("splits avoidable / friendly-fire damage taken", () => {
    const p1 = rowFor("Playerone");
    expect(p1.friendlyFire).toBe(300);
    expect(p1.totalAvoidableDamageTaken).toBe(1500 + 300);
  });

  it("attributes engineering and oil-of-immolation damage", () => {
    expect(rowFor("Playerone").oilOfImmolationDamage).toBe(250);
    expect(rowFor("Playertwo").engineeringDamage).toBe(700);
  });

  it("flags a death with major severity", () => {
    expect(rowFor("Playertwo").severity).toBe("major");
  });
});
