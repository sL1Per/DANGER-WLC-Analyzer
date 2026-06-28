import { describe, expect, it } from "vitest";
import { reportFixture } from "./fixtures/report.fixture";
import { performanceSummary } from "./performance";
import type { ReportData } from "./types";

/** scope helper: keep only the named fights (mirrors scopeReportToFight). */
function onlyFights(report: ReportData, ids: number[]): ReportData {
  return { ...report, fights: report.fights.filter((f) => ids.includes(f.id)) };
}

describe("performanceSummary", () => {
  it("returns null when healingEvents is missing (pre-feature cache)", () => {
    const bare: ReportData = { ...reportFixture, healingEvents: undefined };
    expect(performanceSummary(bare)).toBeNull();
  });

  it("aggregates the four panels scoped to one fight", () => {
    const scoped = onlyFights(reportFixture, [3]); // Hydross kill, 150_000..250_000 = 100s
    const s = performanceSummary(scoped)!;
    expect(s).not.toBeNull();
    expect(s.durationMs).toBe(100_000);

    // Damage done by source: Playerone 4000+250=4250, Playertwo 700; sorted desc
    expect(s.damageBySource.map((r) => [r.name, r.amount])).toEqual([
      ["Playerone", 4250],
      ["Playertwo", 700],
    ]);
    expect(s.damageBySource[0]!.perSecond).toBeCloseTo(42.5, 3);
    expect(s.damageBySource[0]!.percent).toBeCloseTo(4250 / 4950, 5);
    expect(s.damageBySource[0]!.className).toBe("Mage");

    // Healing done by source: Playertwo 5000, Playerone 1000
    expect(s.healingBySource.map((r) => [r.name, r.amount])).toEqual([
      ["Playertwo", 5000],
      ["Playerone", 1000],
    ]);

    // Damage taken by ability: Frostbolt(13022) 1500, Friendly Fire(99999) 300
    expect(s.damageTakenByAbility.map((r) => [r.name, r.amount])).toEqual([
      ["Frostbolt", 1500],
      ["Friendly Fire", 300],
    ]);

    // Deaths: Playertwo, killed by Frostbolt, 50s into the fight (200_000-150_000)
    expect(s.deaths).toEqual([
      { playerId: 2, playerName: "Playertwo", className: "Warrior", killingBlow: "Frostbolt", timeMs: 50_000 },
    ]);
  });

  it("falls back to placeholder names for unknown ability ids", () => {
    const scoped = onlyFights(
      { ...reportFixture, abilityMeta: {} },
      [3],
    );
    const s = performanceSummary(scoped)!;
    expect(s.damageTakenByAbility[0]!.name).toBe("Ability #13022");
  });

  it("excludes self-inflicted and PvP damage from the source panel", () => {
    const base = onlyFights(reportFixture, [3]);
    const report: ReportData = {
      ...base,
      playerDamage: [
        { fightId: 3, sourceId: 1, abilityId: 1, targetId: 900, amount: 1000, timestamp: 151_000, targetHostilePlayer: false, selfInflicted: false },
        { fightId: 3, sourceId: 1, abilityId: 1, targetId: 1, amount: 500, timestamp: 151_500, targetHostilePlayer: false, selfInflicted: true },   // reflected → excluded
        { fightId: 3, sourceId: 1, abilityId: 1, targetId: 2, amount: 700, timestamp: 152_000, targetHostilePlayer: true, selfInflicted: false },   // PvP → excluded
      ],
    };
    const s = performanceSummary(report)!;
    expect(s.damageBySource).toHaveLength(1);
    expect(s.damageBySource[0]).toMatchObject({ name: "Playerone", amount: 1000 });
  });

  it("yields zero per-second rates for a zero-duration fight (no divide-by-zero)", () => {
    const base = reportFixture;
    const zeroFight = { ...base.fights.find((f) => f.id === 3)!, startTime: 200_000, endTime: 200_000 };
    const report: ReportData = { ...base, fights: [zeroFight] };
    const s = performanceSummary(report)!;
    expect(s.durationMs).toBe(0);
    for (const r of s.damageBySource) expect(r.perSecond).toBe(0);
    for (const r of s.healingBySource) expect(r.perSecond).toBe(0);
    for (const r of s.damageTakenByAbility) expect(r.perSecond).toBe(0);
  });
});
