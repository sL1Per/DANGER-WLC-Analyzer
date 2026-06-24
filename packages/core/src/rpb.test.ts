import { describe, expect, it } from "vitest";
import { rpb, type RpbConfig } from "./rpb";
import { reportFixture } from "./fixtures/report.fixture";
import type { RpbRow } from "./rpb";

const cfg: RpbConfig = {
  roles: { signals: [{ spellId: 5487, role: "tank", name: "Bear Form" }], casterClasses: ["Mage", "Warlock", "Priest", "Shaman"], physicalSpecs: ["Enhancement"], casterSpecs: ["Balance"] },
  activity: { castTimes: { "30451": 25 }, hasteBuffs: [], aoeWindowMs: 500 },
  engineeringDamageIds: [30461],
  oilOfImmolationSpellId: 11350,
  battleShoutBuffIds: [2048],
  absorbExcludedSpellIds: [],
  classAbilities: [],
  avoidableAbilityIds: new Set(),
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
    expect(p1.totalAvoidableDamageTaken).toBe(0);
    expect(p1.totalPartlyAvoidable).toBe(1500 + 300);
  });

  it("attaches class rows for the player's class", () => {
    const r = structuredClone(reportFixture);
    const cfg2: RpbConfig = { ...cfg, classAbilities: [
      { className: r.players.find((p) => p.name === "Playerone")!.class, key: "test-debuff", name: "Test Debuff",
        measure: "cast-count", spellIds: [30451] },
    ]};
    const row = rpb(r, cfg2)!.rows.find((x) => x.playerName === "Playerone")!;
    expect(row.classRows.map((c) => c.key)).toContain("test-debuff");
  });

  it("partitions reflected and hostile-player damage", () => {
    const r = structuredClone(reportFixture);
    const pid = r.players.find((p) => p.name === "Playerone")!.id;
    r.playerDamage = [
      ...(r.playerDamage ?? []),
      { fightId: r.fights.find((f) => f.isBoss)!.id, sourceId: pid, abilityId: 9, targetId: pid, amount: 40, timestamp: 1, targetHostilePlayer: false, selfInflicted: true },
      { fightId: r.fights.find((f) => f.isBoss)!.id, sourceId: pid, abilityId: 9, targetId: 99999, amount: 60, timestamp: 2, targetHostilePlayer: true, selfInflicted: false },
    ];
    const row = rpb(r, cfg)!.rows.find((x) => x.playerId === pid)!;
    expect(row.damageReflected).toBe(40);
    expect(row.damageToHostilePlayers).toBe(60);
  });

  it("avoidable filtering: totalAvoidableDamageTaken counts only avoidable ability ids", () => {
    const r = structuredClone(reportFixture);
    const sample = r.damageTakenEvents!.find((d) => !d.fromFriendly)!;
    const cfg2: RpbConfig = { ...cfg, avoidableAbilityIds: new Set([sample.abilityId]) };
    const row = rpb(r, cfg2)!.rows.find((x) => x.playerId === sample.targetPlayerId)!;
    const expected = r.damageTakenEvents!
      .filter((d) => d.targetPlayerId === sample.targetPlayerId && d.abilityId === sample.abilityId)
      .reduce((s, d) => s + d.amount, 0);
    expect(row.totalAvoidableDamageTaken).toBe(expected);
    expect(row.totalPartlyAvoidable).toBeGreaterThanOrEqual(expected);
  });

  it("attributes engineering and oil-of-immolation damage", () => {
    expect(rowFor("Playerone").oilOfImmolationDamage).toBe(250);
    expect(rowFor("Playertwo").engineeringDamage).toBe(700);
  });

  it("flags a death with major severity", () => {
    expect(rowFor("Playertwo").severity).toBe("major");
  });

  it("counts events on the fights present in report.fights (scoping to trash)", () => {
    const r = structuredClone(reportFixture);
    // a death on the trash fight (id 1, isBoss:false) — counted only when the
    // report is scoped to trash (the ALL-trash card)
    r.playerDeaths!.push({ playerId: 1, fightId: 1 });
    const trash = { ...r, fights: r.fights.filter((f) => !f.isBoss) };
    const p1 = rpb(trash, cfg)!.rows.find((x) => x.playerName === "Playerone")!;
    expect(p1.deaths).toBe(1);
    // and the boss-scoped view does NOT see the trash death
    const boss = { ...r, fights: r.fights.filter((f) => f.isBoss) };
    expect(rpb(boss, cfg)!.rows.find((x) => x.playerName === "Playerone")!.deaths).toBe(0);
  });

  it("excludes Kalecgos fights from all numbers (deaths, damage, activity)", () => {
    const r = structuredClone(reportFixture);
    r.fights.push({ id: 9, name: "Kalecgos", encounterId: 724, isBoss: true, kill: true, startTime: 400_000, endTime: 500_000 });
    r.playerDeaths!.push({ playerId: 1, fightId: 9 });
    r.playerDamage!.push({ fightId: 9, sourceId: 1, abilityId: 11350, targetId: 900, amount: 5000, timestamp: 401_000, targetHostilePlayer: false, selfInflicted: false });
    r.playerCasts!.push({ fightId: 9, playerId: 1, spellId: 30451, timestamp: 401_000 });
    const p1 = rpb(r, cfg)!.rows.find((x) => x.playerName === "Playerone")!;
    expect(p1.deaths).toBe(0);                  // the Kalecgos death is excluded
    expect(p1.oilOfImmolationDamage).toBe(250); // only fight-3 oil dmg, not the 5000 on Kalecgos
    // activity should not have counted the Kalecgos cast: only the single fight-3 cast (2.5s) remains
    expect(p1.activity!.secondsActiveST).toBeCloseTo(2.5);
  });
});
