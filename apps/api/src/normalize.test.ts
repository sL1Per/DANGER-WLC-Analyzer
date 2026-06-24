import { describe, expect, it } from "vitest";
import { normalizeReport } from "./normalize";
import type { RawBuffEvent, RawCastEvent, RawReport, RawCombatantInfo } from "./wcl";

/** Minimal 1-boss-fight, 1-Paladin (id 7) raw report used by hitStats tests. */
function makeRaw(): RawReport {
  return {
    title: "SSC test",
    startTime: 0,
    endTime: 1000,
    zone: { name: "Serpentshrine Cavern" },
    fights: [{ id: 1, name: "Hydross the Unstable", encounterID: 623, kill: true, startTime: 0, endTime: 1000, friendlyPlayers: [7] }],
    masterData: { actors: [{ id: 7, name: "Xws", subType: "Paladin" }] },
  };
}

const raw: RawReport = {
  title: "T5 fun",
  startTime: 1_700_000_000_000,
  endTime: 1_700_000_400_000,
  zone: { name: "Serpentshrine Cavern" },
  fights: [
    { id: 1, name: "Underbog Colossus", encounterID: 0, kill: null, startTime: 0, endTime: 60_000 },
    { id: 2, name: "Hydross the Unstable", encounterID: 623, kill: false, startTime: 70_000, endTime: 130_000 },
  ],
  masterData: { actors: [{ id: 7, name: "Playerone", subType: "Mage" }] },
};

describe("normalizeReport", () => {
  it("maps raw WCL fields onto ReportData", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw);
    expect(data.reportId).toBe("a1B2c3D4e5F6g7H8");
    expect(data.zoneName).toBe("Serpentshrine Cavern");
    expect(data.fights[0]).toMatchObject({ id: 1, isBoss: false, kill: undefined });
    expect(data.fights[1]).toMatchObject({ id: 2, isBoss: true, kill: false, encounterId: 623 });
    expect(data.players).toEqual([{ id: 7, name: "Playerone", class: "Mage" }]);
  });
  it("throws for non-TBC zones", () => {
    expect(() => normalizeReport("a1B2c3D4e5F6g7H8", { ...raw, zone: { name: "Naxxramas" } }))
      .toThrow(/TBC/);
  });
  it("throws when zone is missing", () => {
    expect(() => normalizeReport("a1B2c3D4e5F6g7H8", { ...raw, zone: null })).toThrow(/zone/i);
  });
  it("throws 422 when masterData is null (private/restricted report)", () => {
    expect(() => normalizeReport("a1B2c3D4e5F6g7H8", { ...raw, masterData: null }))
      .toThrow(/private or restricted/i);
  });
});

describe("normalizeReport — gear", () => {
  const combatants: RawCombatantInfo[] = [
    { sourceID: 7, fight: 2, gear: [
      { id: 24266, slot: 0, permanentEnchant: 29191, gems: [{ id: 24030 }] },
      { id: 0, slot: 3 },         // empty shirt slot — dropped
    ] },
  ];
  const itemMeta = { "24266": { name: "Spellstrike Hood", quality: 4 } };

  it("maps combatant info onto GearSnapshots and itemMeta", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, combatants, itemMeta);
    expect(data.gear).toEqual([{
      fightId: 2, playerId: 7, auras: [], items: [{
        slot: 0, itemId: 24266, itemLevel: undefined,
        permanentEnchantId: 29191, temporaryEnchantId: undefined, gemIds: [24030],
      }],
    }]);
    expect(data.itemMeta["24266"]?.name).toBe("Spellstrike Hood");
  });
  it("defaults to empty gear when not provided", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw);
    expect(data.gear).toEqual([]);
    expect(data.itemMeta).toEqual({});
  });

  it("derives slot from array index when WCL omits the slot field (Classic logs)", () => {
    // Classic combatantinfo gear arrays have no per-entry slot: position = slot id,
    // and empty slots come through as id 0 placeholders that still occupy their index.
    const classicCombatants: RawCombatantInfo[] = [
      { sourceID: 7, fight: 2, gear: [
        { id: 24266, permanentEnchant: 29191, gems: [{ id: 24030 }] } as never, // index 0 = Head
        { id: 28134 } as never,  // index 1 = Neck
        { id: 0 } as never,      // index 2 = empty Shoulders — dropped, but keeps indices aligned
        { id: 0 } as never,      // index 3 = empty Shirt
        { id: 21848 } as never,  // index 4 = Chest
      ] },
    ];
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, classicCombatants);
    expect(data.gear[0]?.items.map((i) => [i.slot, i.itemId])).toEqual([
      [0, 24266], [1, 28134], [4, 21848],
    ]);
  });
});

describe("normalizeReport — players limited to fight participants", () => {
  const rawWithBystanders: RawReport = {
    ...raw,
    fights: [
      { id: 1, name: "Underbog Colossus", encounterID: 0, kill: null,
        startTime: 0, endTime: 60_000, friendlyPlayers: [7] },
      { id: 2, name: "Hydross the Unstable", encounterID: 623, kill: false,
        startTime: 70_000, endTime: 130_000, friendlyPlayers: [7, 9] },
    ],
    masterData: { actors: [
      { id: 7, name: "Playerone", subType: "Mage" },
      { id: 9, name: "Playertwo", subType: "Druid" },
      { id: 50, name: "ShattrathBystander", subType: "Priest" },
    ] },
  };

  it("drops actors that never appear in any fight's friendlyPlayers", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", rawWithBystanders);
    expect(data.players.map((p) => p.name)).toEqual(["Playerone", "Playertwo"]);
  });

  it("keeps all actors when WCL returns no friendlyPlayers info", () => {
    const noInfo: RawReport = {
      ...rawWithBystanders,
      fights: rawWithBystanders.fights.map((f) => ({ ...f, friendlyPlayers: null })),
    };
    const data = normalizeReport("a1B2c3D4e5F6g7H8", noInfo);
    expect(data.players).toHaveLength(3);
  });

  it("drops friendlyPlayers with no combat footprint when activity data exists", () => {
    // ids 7 and 9 are both friendly-flagged, but only 7 actually did anything
    // (a DamageDone table entry). 9 is an inert flagged-but-didn't-raid player.
    const data = normalizeReport("a1B2c3D4e5F6g7H8", rawWithBystanders, [], {}, {
      damageDoneTable: [{ id: 7, total: 1000, type: "Fire" }],
    });
    expect(data.players.map((p) => p.name)).toEqual(["Playerone"]);
  });

  it("keeps a friendlyPlayer active via any signal (e.g. only damage taken)", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", rawWithBystanders, [], {}, {
      damageDoneTable: [{ id: 7, total: 1000 }],
      damageTaken: [{ timestamp: 1, type: "damage", sourceID: 800, targetID: 9, abilityGameID: 1, amount: 50, fight: 2 }],
    });
    expect(data.players.map((p) => p.name).sort()).toEqual(["Playerone", "Playertwo"]);
  });
});

describe("normalizeReport — buff intervals and drum events", () => {
  // Fight 2 ("Hydross") in `raw` runs [70_000, 130_000].
  const buff = (type: string, timestamp: number, overrides: Partial<RawBuffEvent> = {}): RawBuffEvent => ({
    timestamp, type, sourceID: 7, targetID: 7, abilityGameID: 28520, fight: 2, ...overrides,
  });

  it("builds one interval from an apply/remove pair", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, [], {}, {
      buffEvents: [buff("applybuff", 80_000), buff("removebuff", 90_000)],
    });
    expect(data.buffs).toEqual([
      { fightId: 2, targetId: 7, spellId: 28520, startTime: 80_000, endTime: 90_000 },
    ]);
  });

  it("treats a remove without a prior apply as up since the pull", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, [], {}, {
      buffEvents: [buff("removebuff", 90_000)],
    });
    expect(data.buffs).toEqual([
      { fightId: 2, targetId: 7, spellId: 28520, startTime: 70_000, endTime: 90_000 },
    ]);
  });

  it("closes never-removed buffs at the fight end", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, [], {}, {
      buffEvents: [buff("applybuff", 80_000)],
    });
    expect(data.buffs).toEqual([
      { fightId: 2, targetId: 7, spellId: 28520, startTime: 80_000, endTime: 130_000 },
    ]);
  });

  it("seeds full-fight intervals from combatantInfo pull auras", () => {
    const combatants: RawCombatantInfo[] = [
      { sourceID: 7, fight: 2, gear: [], auras: [{ source: 7, ability: 28520 }] },
    ];
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, combatants, {}, {
      trackedBuffIds: [28520],
    });
    expect(data.buffs).toEqual([
      { fightId: 2, targetId: 7, spellId: 28520, startTime: 70_000, endTime: 130_000 },
    ]);
  });

  it("seeded interval + later remove produces exactly one interval (no remove-fallback duplicate)", () => {
    const combatants: RawCombatantInfo[] = [
      { sourceID: 7, fight: 2, gear: [], auras: [{ source: 7, ability: 28520 }] },
    ];
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, combatants, {}, {
      buffEvents: [buff("removebuff", 90_000)],
      trackedBuffIds: [28520],
    });
    expect(data.buffs).toEqual([
      { fightId: 2, targetId: 7, spellId: 28520, startTime: 70_000, endTime: 90_000 },
    ]);
  });

  it("drops events whose fight id is unknown", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, [], {}, {
      buffEvents: [buff("applybuff", 80_000, { fight: 99 }), buff("removebuff", 90_000, { fight: 99 })],
    });
    expect(data.buffs).toEqual([]);
  });

  it("maps cast events to drumCasts and drum-buff applies to drumApplications", () => {
    const castEvents: RawCastEvent[] = [
      { timestamp: 75_000, type: "cast", sourceID: 7, abilityGameID: 35476, fight: 2 },
    ];
    const buffEvents = [
      buff("applybuff", 75_100, { abilityGameID: 35476, targetID: 9 }),
      buff("removebuff", 105_100, { abilityGameID: 35476, targetID: 9 }),
    ];
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, [], {}, {
      buffEvents, castEvents, drumBuffIds: [35476],
    });
    expect(data.drumCasts).toEqual([
      { fightId: 2, sourceId: 7, spellId: 35476, timestamp: 75_000 },
    ]);
    expect(data.drumApplications).toEqual([
      { fightId: 2, sourceId: 7, targetId: 9, spellId: 35476, timestamp: 75_100 },
    ]);
  });

  it("produces no drumApplications when drumBuffIds is omitted", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw, [], {}, {
      buffEvents: [buff("applybuff", 75_100, { abilityGameID: 35476, targetID: 9 })],
    });
    expect(data.drumApplications).toEqual([]);
  });

  it("defaults buffs/drumCasts/drumApplications to [] when no events are passed", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", raw);
    expect(data.buffs).toEqual([]);
    expect(data.drumCasts).toEqual([]);
    expect(data.drumApplications).toEqual([]);
  });
});

describe("normalizeReport — gear auras (shadow resi)", () => {
  const raw = {
    title: "BT", startTime: 0, endTime: 1000, zone: { name: "Black Temple" },
    fights: [{ id: 1, name: "Mother Shahraz", encounterID: 602, kill: true, startTime: 0, endTime: 100, friendlyPlayers: [10] }],
    masterData: { actors: [{ id: 10, name: "Heal", subType: "Priest" }], npcs: [] },
  };
  it("copies combatantInfo aura ids onto the gear snapshot", () => {
    const data = normalizeReport("c", raw as never, [
      { sourceID: 10, fight: 1, gear: [{ id: 34204 }], auras: [{ source: 10, ability: 25433 }] },
    ], {});
    expect(data.gear[0]!.auras).toEqual([25433]);
  });
});

describe("normalizeReport — RPB events", () => {
  // Boss fight id 2 (Hydross the Unstable, encounterID 623), players 1 and 2.
  // friendlyPlayers is set so filterToParticipants picks up only ids 1 and 2.
  const rawRpb: RawReport = {
    title: "SSC run",
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_400_000,
    zone: { name: "Serpentshrine Cavern" },
    fights: [
      { id: 1, name: "Underbog Colossus", encounterID: 0, kill: null,
        startTime: 0, endTime: 60_000, friendlyPlayers: [1, 2] },
      { id: 2, name: "Hydross the Unstable", encounterID: 623, kill: true,
        startTime: 70_000, endTime: 130_000, friendlyPlayers: [1, 2] },
    ],
    masterData: {
      actors: [
        { id: 1, name: "Playertank", subType: "Warrior" },
        { id: 2, name: "Playermage", subType: "Mage" },
      ],
    },
  };

  it("normalizes RPB events into ReportData", () => {
    const data = normalizeReport("abc", rawRpb, [], {}, {
      allCasts: [
        { timestamp: 100, type: "cast", sourceID: 1, abilityGameID: 30451, fight: 2 },
      ],
      damageDone: [
        { timestamp: 120, type: "damage", sourceID: 1, targetID: 900, abilityGameID: 30451, amount: 50, fight: 2 },
      ],
      damageTaken: [
        { timestamp: 130, type: "damage", sourceID: 800, targetID: 1, abilityGameID: 13022, amount: 75, fight: 2 },
      ],
      interrupts: [
        // player 1 interrupts enemy 800 (Hydross): source = interrupter, target = enemy caster.
        { timestamp: 140, type: "interrupt", sourceID: 1, targetID: 800, abilityGameID: 25454, extraAbilityGameID: 12471, fight: 2 },
        // enemy 800 "interrupting" player 1 must be dropped (we only credit player interrupters).
        { timestamp: 145, type: "interrupt", sourceID: 800, targetID: 1, abilityGameID: 9999, extraAbilityGameID: 555, fight: 2 },
      ],
      deaths: [
        { timestamp: 150, type: "death", targetID: 2, fight: 2 },
      ],
      damageDoneTable: [{ id: 1, total: 1000, type: "Fire" }],
      healingTable: [],
      damageTakenTable: [{ id: 1, total: 75 }],
      actorNames: { 800: "Hydross the Unstable" },
    });

    // Magic damage: Fire entry for player 1, total 1000
    expect(data.playerTotals?.find((t) => t.playerId === 1)?.magicDamageDone).toBe(1000);
    // damageDone table total carried through
    expect(data.playerTotals?.find((t) => t.playerId === 1)?.damageDone).toBe(1000);
    // damageTaken table total
    expect(data.playerTotals?.find((t) => t.playerId === 1)?.damageTaken).toBe(75);
    // one cast event for player 1
    expect(data.playerCasts).toHaveLength(1);
    expect(data.playerCasts?.[0]).toMatchObject({ playerId: 1, spellId: 30451, fightId: 2 });
    // interrupt sourceName resolved from actorNames
    expect(data.interrupts).toHaveLength(1);
    expect(data.interrupts?.[0]?.sourceName).toBe("Hydross the Unstable");
    expect(data.interrupts?.[0]?.interruptedSpellId).toBe(12471);
    // death of player 2
    expect(data.playerDeaths).toHaveLength(1);
    expect(data.playerDeaths?.[0]?.playerId).toBe(2);
    expect(data.playerDeaths?.[0]?.fightId).toBe(2);
    // damage taken event
    expect(data.damageTakenEvents).toHaveLength(1);
    expect(data.damageTakenEvents?.[0]).toMatchObject({ targetPlayerId: 1, amount: 75, fromFriendly: false });
    // player damage event
    expect(data.playerDamage).toHaveLength(1);
    expect(data.playerDamage?.[0]).toMatchObject({ sourceId: 1, amount: 50, selfInflicted: false, targetHostilePlayer: false });
  });

  it("attributes pet damage and healing to the owner player (matches WCL)", () => {
    const data = normalizeReport("abc", rawRpb, [], {}, {
      allCasts: [], // presence flag so buildRpb does not early-return
      petOwners: { 50: 2 }, // pet actor 50 belongs to player 2 (built from masterData in app.ts)
      damageDone: [
        { timestamp: 120, type: "damage", sourceID: 2, targetID: 900, abilityGameID: 1, amount: 100, fight: 2 },  // owner's own hit
        { timestamp: 121, type: "damage", sourceID: 50, targetID: 900, abilityGameID: 2, amount: 40, fight: 2 },  // pet → owner 2
        { timestamp: 122, type: "damage", sourceID: 999, targetID: 900, abilityGameID: 3, amount: 7, fight: 2 },  // stray non-player/non-pet → dropped
      ],
      healingDone: [
        { timestamp: 123, type: "absorbed", sourceID: 50, targetID: 1, abilityGameID: 4, amount: 30, fight: 2 }, // pet shield → owner 2
      ],
    });
    // both the owner's own hit and the pet's hit are credited to player 2
    expect((data.playerDamage ?? []).filter((d) => d.sourceId === 2).map((d) => d.amount).sort((a, b) => a - b))
      .toEqual([40, 100]);
    // the raw pet/stray actor ids never appear as a source
    expect((data.playerDamage ?? []).some((d) => d.sourceId === 50 || d.sourceId === 999)).toBe(false);
    // pet healing/absorb is likewise credited to the owner
    expect(data.healingEvents).toEqual([{ fightId: 2, sourceId: 2, amount: 30 }]);
  });

  it("returns no RPB fields when neither allCasts nor damageDoneTable is provided", () => {
    const data = normalizeReport("abc", rawRpb, [], {}, {
      damageTaken: [
        { timestamp: 130, type: "damage", sourceID: 800, targetID: 1, abilityGameID: 13022, amount: 75, fight: 2 },
      ],
    });
    expect(data.playerTotals).toBeUndefined();
    expect(data.playerCasts).toBeUndefined();
    expect(data.playerDeaths).toBeUndefined();
  });

  it("excludes events for non-participant actors", () => {
    const data = normalizeReport("abc", rawRpb, [], {}, {
      allCasts: [
        // sourceID 99 is not a participant
        { timestamp: 100, type: "cast", sourceID: 99, abilityGameID: 30451, fight: 2 },
        { timestamp: 101, type: "cast", sourceID: 1, abilityGameID: 30451, fight: 2 },
      ],
      damageDoneTable: [],
    });
    expect(data.playerCasts).toHaveLength(1);
    expect(data.playerCasts?.[0]?.playerId).toBe(1);
  });
});

describe("normalizeReport — enemy debuffs + absorbs (M5b)", () => {
  // Boss fight id 2 (Hydross the Unstable, encounterID 623) runs [70_000, 130_000].
  // Players 1 and 2; enemy target 99 is NOT a player id.
  const baseRaw: RawReport = {
    title: "SSC run",
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_400_000,
    zone: { name: "Serpentshrine Cavern" },
    fights: [
      { id: 1, name: "Underbog Colossus", encounterID: 0, kill: null,
        startTime: 0, endTime: 60_000, friendlyPlayers: [1, 2] },
      { id: 2, name: "Hydross the Unstable", encounterID: 623, kill: true,
        startTime: 70_000, endTime: 130_000, friendlyPlayers: [1, 2] },
    ],
    masterData: {
      actors: [
        { id: 1, name: "Playertank", subType: "Warrior" },
        { id: 2, name: "Playermage", subType: "Mage" },
      ],
    },
  };
  const F = 2; // boss fight id

  it("normalizes enemy debuffs (player source, enemy target) into intervals", () => {
    const data = normalizeReport("RPT", baseRaw, [], {}, {
      allCasts: [],
      enemyDebuffs: [
        { type: "applydebuff", sourceID: 1, targetID: 99, abilityGameID: 27228, timestamp: 1000, fight: F },
        { type: "removedebuff", sourceID: 1, targetID: 99, abilityGameID: 27228, timestamp: 4000, fight: F },
      ],
    } as any);
    expect(data.enemyDebuffs).toEqual([
      { fightId: F, sourceId: 1, targetEnemyId: 99, spellId: 27228, startTime: 1000, endTime: 4000 },
    ]);
  });

  it("normalizes absorbs to AbsorbEvent per player", () => {
    const data = normalizeReport("RPT", baseRaw, [], {}, {
      allCasts: [],
      absorbEvents: [
        { type: "damage", sourceID: 50, targetID: 1, abilityGameID: 29166, amount: 0, absorbed: 1200, fight: F },
      ],
    } as any);
    expect(data.absorbs).toEqual([{ fightId: F, playerId: 1, spellId: 29166, amount: 1200 }]);
  });
});

describe("normalizeReport — healing events, enriched deaths, and abilityMeta", () => {
  // Reuse rawRpb: boss fight id 2 (Hydross), players 1 and 2 with friendlyPlayers set.
  // allCasts: [] keeps activeIds empty so all participants survive the roster filter.
  const rawRpb: RawReport = {
    title: "SSC run",
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_400_000,
    zone: { name: "Serpentshrine Cavern" },
    fights: [
      { id: 1, name: "Underbog Colossus", encounterID: 0, kill: null,
        startTime: 0, endTime: 60_000, friendlyPlayers: [1, 2] },
      { id: 2, name: "Hydross the Unstable", encounterID: 623, kill: true,
        startTime: 70_000, endTime: 130_000, friendlyPlayers: [1, 2] },
    ],
    masterData: {
      actors: [
        { id: 1, name: "Playertank", subType: "Warrior" },
        { id: 2, name: "Playermage", subType: "Mage" },
      ],
      abilities: [{ gameID: 25314, name: "Renew" }],
    },
  };

  it("emits healingEvents, enriched deaths, and abilityMeta", () => {
    const data = normalizeReport("rep", rawRpb, [], {}, {
      allCasts: [],
      healingDone: [
        { timestamp: 1, type: "heal", sourceID: 1, targetID: 1, abilityGameID: 25314, amount: 5000, fight: 2 },
      ] as any,
      deaths: [
        { timestamp: 200, type: "death", targetID: 1, fight: 2, killingAbilityGameID: 25314 } as any,
      ],
      abilityMeta: { "25314": { name: "Renew" } },
    });
    expect(data.healingEvents).toEqual([{ fightId: 2, sourceId: 1, amount: 5000 }]);
    expect(data.playerDeaths![0]).toMatchObject({ killingAbilityId: 25314, timestamp: 200 });
    expect(data.abilityMeta).toEqual({ "25314": { name: "Renew" } });
  });
});

describe("normalizeReport — rankings", () => {
  const rankRaw = {
    title: "T5", startTime: 0, endTime: 1000, zone: { name: "Serpentshrine Cavern" },
    fights: [{ id: 3, name: "Hydross the Unstable", encounterID: 623, kill: true, startTime: 0, endTime: 1000, friendlyPlayers: [1] }],
    masterData: { actors: [{ id: 1, name: "Dpsone", subType: "Mage" }] },
  } as unknown as RawReport;

  it("maps raw rankings into ReportData.rankings (class from class|type, rounded)", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", rankRaw, [], {}, {
      rankings: [{
        encounter: { id: 623, name: "Hydross the Unstable" },
        fightID: 3,
        roles: {
          tanks: { characters: [] },
          healers: { characters: [] },
          dps: { characters: [{ name: "Dpsone", type: "Mage", spec: "Fire", rankPercent: 95.8, bracketPercent: 88.4 }] },
        },
      }],
    });
    expect(data.rankings).toHaveLength(1);
    expect(data.rankings![0]!.encounterName).toBe("Hydross the Unstable");
    expect(data.rankings![0]!.dps[0]).toEqual({ name: "Dpsone", class: "Mage", spec: "Fire", rankPercent: 96, bracketPercent: 88 });
  });

  it("leaves rankings undefined when not provided", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", rankRaw, [], {}, {});
    expect(data.rankings).toBeUndefined();
  });

  it("keeps rankings as [] when fetched but empty (no ranked kills)", () => {
    // [] (fetched, empty) must stay [] — distinct from undefined (old cache) so
    // the UI shows "no ranked kills" rather than the refresh notice.
    const data = normalizeReport("a1B2c3D4e5F6g7H8", rankRaw, [], {}, { rankings: [] });
    expect(data.rankings).toEqual([]);
  });

  it("drops entries missing fightID or encounter id", () => {
    const data = normalizeReport("a1B2c3D4e5F6g7H8", rankRaw, [], {}, {
      rankings: [
        { encounter: { name: "No id" }, fightID: 3, roles: { dps: { characters: [] } } },
        { encounter: { id: 623, name: "Hydross the Unstable" }, roles: { dps: { characters: [] } } },
        { encounter: { id: 623, name: "Hydross the Unstable" }, fightID: 3, roles: { dps: { characters: [] } } },
      ],
    });
    expect(data.rankings).toHaveLength(1);
    expect(data.rankings![0]!.fightID).toBe(3);
  });
});

describe("normalize hitStats/trinketUses", () => {
  it("builds outgoing hit shares and trinket counts", () => {
    const raw = makeRaw(); // 1 player id=7 (Paladin), 1 boss fight id=1
    const data = normalizeReport("rep", raw, [], {}, {
      damageDoneHitTable: [{ id: 7, total: 1000, hitCount: 100, critHitCount: 35, dodgeCount: 4, parryCount: 6, missCount: 2, resistCount: 3 }],
      damageTakenHitTable: [{ id: 7, total: 500, hitCount: 50, critHitCount: 1, blockCount: 10, dodgeCount: 5, missCount: 2, parryCount: 0, crushingCount: 3, immuneCount: 0 }],
      healingHitTable: [{ id: 7, total: 0, hitCount: 80, critHitCount: 20 }],
      castsTable: [{ id: 7, guid: 28714, name: "Bloodlust Brooch", total: 2 }],
      trinketRacials: [{ spellId: 28714, name: "Bloodlust Brooch" }],
    });
    const hs = data.hitStats!.find((h) => h.playerId === 7)!;
    expect(hs.outgoing.crit.count).toBe(35);
    // share = 35 / (100+35+4+6+2+3) = 35/150
    expect(hs.outgoing.crit.pct).toBeCloseTo(35 / 150, 5);
    expect(hs.incomingMelee.crushing.count).toBe(3);
    expect(hs.critHeals.count).toBe(20);
    expect(data.trinketUses!).toContainEqual({ playerId: 7, name: "Bloodlust Brooch", count: 2 });
  });

  it("omits hitStats/trinketUses when no tables provided", () => {
    const raw = makeRaw();
    const data = normalizeReport("rep", raw, [], {}, {});
    expect(data.hitStats).toBeUndefined();
    expect(data.trinketUses).toBeUndefined();
  });

  it("counts extra Windfury attacks and Battle Squawk buffs", () => {
    const raw = makeRaw(); // player 7, boss fight 1
    const data = normalizeReport("rep", raw, [], {}, {
      damageDoneHitTable: [{ id: 7, total: 0 }],
      castsTable: [],
      extraWindfurySpellId: 33010,
      battleSquawkBuffId: 23060,
      damageDone: [
        { timestamp: 1, type: "damage", sourceID: 7, targetID: 9, abilityGameID: 33010, amount: 50, fight: 1 },
        { timestamp: 2, type: "damage", sourceID: 7, targetID: 9, abilityGameID: 33010, amount: 60, fight: 1 },
      ] as any,
      buffEvents: [
        { timestamp: 1, type: "applybuff", sourceID: 7, targetID: 7, abilityGameID: 23060, fight: 1 },
      ] as any,
    });
    const hs = data.hitStats!.find((h) => h.playerId === 7)!;
    expect(hs.extraWindfury).toBe(2);
    expect(hs.battleSquawk).toBe(1);
  });
});
