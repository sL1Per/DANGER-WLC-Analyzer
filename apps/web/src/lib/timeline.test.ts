import { describe, expect, it } from "vitest";
import { reportFixture } from "@wcl/core";
import { buildTimeline } from "./timeline";
import type { RawBuffEvent, RawDebuffEvent } from "./wcl/wcl";

const FIGHT_ID = 3;

describe("buildTimeline", () => {
  it("merges casts, deaths, damage-dealt and interrupts from the report, sorted by timestamp", () => {
    const entries = buildTimeline(reportFixture, FIGHT_ID, [], []);

    // reportFixture's playerDamage has 3 hits (151_200/152_000/153_000); the first
    // (player 1, ability 30451, same as the cast) gets merged onto the cast below,
    // leaving 2 standalone damage-dealt rows — see the dedicated merge test.
    expect(entries.map((e) => e.category)).toEqual(["cast", "damage-dealt", "damage-dealt", "death"]);
    expect(entries[0]).toMatchObject({
      timestamp: 151_000, category: "cast", text: "Playerone casts Arcane Blast for 4,000",
      playerId: 1, playerName: "Playerone", spellId: 30451, spellName: "Arcane Blast", amount: 4000,
    });
    expect(entries[3]).toMatchObject({
      timestamp: 200_000, category: "death", text: "Playertwo dies to Frostbolt",
      playerId: 2, playerName: "Playertwo", spellId: 13022, spellName: "Frostbolt",
    });
  });

  it("drops interrupts with no timestamp (pre-v12 cache)", () => {
    // reportFixture's interrupt entry predates the timestamp field.
    expect(reportFixture.interrupts?.[0]?.timestamp).toBeUndefined();
    const entries = buildTimeline(reportFixture, FIGHT_ID, [], []);
    expect(entries.some((e) => e.category === "interrupt")).toBe(false);
  });

  it("includes an interrupt once it has a timestamp", () => {
    const report = {
      ...reportFixture,
      interrupts: [{ ...reportFixture.interrupts![0]!, timestamp: 151_500 }],
    };
    const entries = buildTimeline(report, FIGHT_ID, [], []);
    const interrupt = entries.find((e) => e.category === "interrupt");
    expect(interrupt).toMatchObject({
      timestamp: 151_500,
      // 12471 isn't in the fixture's abilityMeta, so it falls back to a Spell #id label.
      text: "Playerone interrupts Hydross the Unstable's Spell #12471",
      playerId: 1, playerName: "Playerone", targetName: "Hydross the Unstable",
      spellId: 12471, spellName: "Spell #12471",
    });
  });

  it("renders friendly buff gains and boss debuffs landing on players", () => {
    const buffs: RawBuffEvent[] = [
      { timestamp: 151_100, type: "applybuff", sourceID: 1, targetID: 1, abilityGameID: 30451, fight: FIGHT_ID },
      { timestamp: 999_999, type: "applybuff", sourceID: 1, targetID: 1, abilityGameID: 30451, fight: 999 },
    ];
    const debuffs: RawDebuffEvent[] = [
      { timestamp: 151_050, type: "applydebuff", sourceID: 900, targetID: 2, abilityGameID: 13022, fight: FIGHT_ID },
    ];
    const entries = buildTimeline(reportFixture, FIGHT_ID, buffs, debuffs);

    // Sorted by timestamp: cast(151000) < debuff(151050) < buff(151100) <
    // damage-dealt(152000/153000 — 151200 merged onto the cast) < death(200000).
    expect(entries.map((e) => e.category)).toEqual([
      "cast", "debuff", "buff", "damage-dealt", "damage-dealt", "death",
    ]);
    expect(entries[1]).toMatchObject({
      timestamp: 151_050, text: "Frostbolt applied to Playertwo",
      playerId: 2, playerName: "Playertwo", spellId: 13022, spellName: "Frostbolt",
    });
    expect(entries[2]).toMatchObject({
      timestamp: 151_100, text: "Playerone gains Arcane Blast",
      playerId: 1, playerName: "Playerone", spellId: 30451, spellName: "Arcane Blast",
    });
  });

  it("falls back to a Spell #id label for unknown abilities", () => {
    const buffs: RawBuffEvent[] = [
      { timestamp: 151_100, type: "applybuff", sourceID: 1, targetID: 1, abilityGameID: 777, fight: FIGHT_ID },
    ];
    const entries = buildTimeline(reportFixture, FIGHT_ID, buffs, []);
    expect(entries.find((e) => e.category === "buff")?.text).toBe("Playerone gains Spell #777");
  });

  it("shows a cast's target, but omits it for a self-cast", () => {
    const report = {
      ...reportFixture,
      playerDamage: [], // isolate target-suffix behavior from the cast/damage merge, covered separately below
      playerCasts: [
        { fightId: FIGHT_ID, playerId: 1, spellId: 30451, timestamp: 151_000, targetId: 2, targetName: "Playertwo" },
        { fightId: FIGHT_ID, playerId: 1, spellId: 30451, timestamp: 151_010, targetId: 1, targetName: "Playerone" },
      ],
    };
    const entries = buildTimeline(report, FIGHT_ID, [], []);
    expect(entries[0]).toMatchObject({
      text: "Playerone casts Arcane Blast on Playertwo", targetId: 2, targetName: "Playertwo",
    });
    expect(entries[1]).toMatchObject({ text: "Playerone casts Arcane Blast", targetId: undefined });
  });

  it("merges a cast with the nearest matching damage instance instead of showing it separately", () => {
    // reportFixture's cast (player 1, ability 30451, t=151_000) and its first playerDamage
    // entry (player 1, ability 30451, t=151_200, amount 4000) share player+ability within
    // the match window, so the hit is credited to the cast, not shown as its own row.
    const entries = buildTimeline(reportFixture, FIGHT_ID, [], []);
    const cast = entries.find((e) => e.category === "cast");
    expect(cast).toMatchObject({ text: "Playerone casts Arcane Blast for 4,000", amount: 4000 });
    expect(entries.some((e) => e.category === "damage-dealt" && e.timestamp === 151_200)).toBe(false);
  });

  it("does not merge a hit that lands outside the match window, or one from a different ability", () => {
    const report = {
      ...reportFixture,
      playerCasts: [{ fightId: FIGHT_ID, playerId: 1, spellId: 30451, timestamp: 100_000 }],
      playerDamage: [
        // too late: 100_000 + 5000ms window < 106_000
        { fightId: FIGHT_ID, sourceId: 1, abilityId: 30451, targetId: 900, amount: 999, timestamp: 106_000,
          targetHostilePlayer: false, selfInflicted: false },
      ],
    };
    const entries = buildTimeline(report, FIGHT_ID, [], []);
    expect(entries.find((e) => e.category === "cast")).toMatchObject({ text: "Playerone casts Arcane Blast", amount: undefined });
    expect(entries.some((e) => e.category === "damage-dealt")).toBe(true);
  });

  it("greedily matches each of several same-ability casts to its own nearest hit", () => {
    const report = {
      ...reportFixture,
      playerCasts: [
        { fightId: FIGHT_ID, playerId: 1, spellId: 30451, timestamp: 100_000 },
        { fightId: FIGHT_ID, playerId: 1, spellId: 30451, timestamp: 101_000 },
      ],
      playerDamage: [
        { fightId: FIGHT_ID, sourceId: 1, abilityId: 30451, targetId: 900, amount: 111, timestamp: 100_200,
          targetHostilePlayer: false, selfInflicted: false },
        { fightId: FIGHT_ID, sourceId: 1, abilityId: 30451, targetId: 900, amount: 222, timestamp: 101_200,
          targetHostilePlayer: false, selfInflicted: false },
      ],
    };
    const entries = buildTimeline(report, FIGHT_ID, [], []);
    const casts = entries.filter((e) => e.category === "cast");
    expect(casts.map((c) => c.amount)).toEqual([111, 222]);
    expect(entries.some((e) => e.category === "damage-dealt")).toBe(false);
  });

  it("includes melee/spell damage dealt by players that isn't claimed by any cast, with target and hit-result label", () => {
    // reportFixture's playerDamage: player 1's Arcane Blast hit is claimed by the matching
    // cast (see the merge test above); its unmapped-ability hit (11350) and player 2's
    // (30461, no matching cast for player 2) remain as standalone damage-dealt rows.
    const entries = buildTimeline(reportFixture, FIGHT_ID, [], []);
    const dealt = entries.filter((e) => e.category === "damage-dealt");
    expect(dealt).toHaveLength(2);
    expect(dealt[0]).toMatchObject({
      timestamp: 152_000, playerId: 1, playerName: "Playerone",
      targetId: undefined, targetName: "#900", spellName: "Spell #11350", amount: 250,
      text: "Playerone hits #900 with Spell #11350 for 250",
    });
  });

  it("labels damage-dealt hit results (crit/miss/etc.) when hitType is known", () => {
    const report = {
      ...reportFixture,
      playerDamage: [
        { fightId: FIGHT_ID, sourceId: 1, abilityId: 1, targetId: 900, amount: 200, timestamp: 151_000,
          targetHostilePlayer: false, selfInflicted: false, hitType: 2 }, // melee (id 1), crit
      ],
    };
    const entries = buildTimeline(report, FIGHT_ID, [], []);
    expect(entries.find((e) => e.category === "damage-dealt")).toMatchObject({
      spellId: 1, spellName: "Spell #1", resultLabel: "crit",
      text: "Playerone hits #900 with Spell #1 for 200 (crit)",
    });
  });

  it("drops damage-taken events with no timestamp (pre-v13 cache), includes them once timestamped", () => {
    // reportFixture's damageTakenEvents predate the timestamp field.
    expect(reportFixture.damageTakenEvents?.every((d) => d.timestamp == null)).toBe(true);
    expect(buildTimeline(reportFixture, FIGHT_ID, [], []).some((e) => e.category === "damage-taken")).toBe(false);

    const report = {
      ...reportFixture,
      damageTakenEvents: [
        { ...reportFixture.damageTakenEvents![0]!, timestamp: 151_400, hitType: 7 }, // dodge
      ],
    };
    const entries = buildTimeline(report, FIGHT_ID, [], []);
    expect(entries.find((e) => e.category === "damage-taken")).toMatchObject({
      timestamp: 151_400, playerId: 1, playerName: "Playerone",
      targetName: "Environment", spellName: "Frostbolt", resultLabel: "dodge",
      text: "Environment hits Playerone with Frostbolt for 1,500 (dodge)",
    });
  });
});
