import {
  isTbcRaidZone,
  SCHEMA_VERSION,
  type BuffInterval,
  type Fight,
  type ItemMeta,
  type ReportData,
  type PlayerTotals,
  type PlayerDeath,
  type InterruptEvent,
  type DamageTakenEvent,
  type PlayerCast,
  type PlayerDamageEvent,
  type EnemyDebuffInterval,
  type AbsorbEvent,
  type ReportRanking,
  type RankingCharacter,
  type HealingEvent,
  type PlayerFightHits,
} from "@wcl/core";
import {
  WclError,
  type RawBuffEvent,
  type RawCastEvent,
  type RawCombatantInfo,
  type RawDeathEvent,
  type RawReport,
  type RawInterruptEvent,
  type RawDamageEvent,
  type RawTableEntry,
  type RawDebuffEvent,
  type RawRankingEntry,
  type RawRankingCharacter,
} from "./wcl";

export interface NormalizeEventInputs {
  buffEvents?: RawBuffEvent[];
  castEvents?: RawCastEvent[];
  /** buff ids whose pull-time presence (combatantInfo auras) should seed intervals */
  trackedBuffIds?: number[];
  /** buff ids that count as drum buffs for drumApplications */
  drumBuffIds?: number[];
  /** player death events (RPB playerDeaths + activity participation) */
  deaths?: RawDeathEvent[];
  interrupts?: RawInterruptEvent[];
  damageTaken?: RawDamageEvent[];
  damageDone?: RawDamageEvent[];
  allCasts?: RawCastEvent[];
  damageDoneTable?: RawTableEntry[];
  healingTable?: RawTableEntry[];
  damageTakenTable?: RawTableEntry[];
  /** masterData actor id -> display name, for interrupt sources (players + NPCs) */
  actorNames?: Record<number, string>;
  /** debuff events on enemies, sourced by players (M5b) */
  enemyDebuffs?: RawDebuffEvent[];
  /** absorb-bearing damage-taken events on players (M5b) */
  absorbEvents?: RawDamageEvent[];
  /** raw WCL rankings entries (per boss, grouped by role); undefined = not fetched */
  rankings?: RawRankingEntry[];
  /** effective healing-done events by players (performance breakdown) */
  healingDone?: RawDamageEvent[];
  /** abilityGameID → name, from masterData (performance breakdown) */
  abilityMeta?: Record<string, { name: string }>;
  /** pet actor id → owner player id; pet damage/healing is credited to the owner */
  petOwners?: Record<number, number>;
}

/** WCL hit-type codes (stable across game versions; see WoWAnalyzer HIT_TYPES).
 *  Crushing/glancing are Classic event FLAGS (not codes) and partial resists are
 *  amounts, so those columns aren't broken out — the affected hits still count as
 *  normal toward the totals. */
const HIT = { MISS: 0, CRIT: 2, BLOCKED_NORMAL: 4, BLOCKED_CRIT: 5, DODGE: 7, PARRY: 8, IMMUNE: 10 } as const;
/** Auto-attack ability ids — incoming stats are melee swings only (per the sheet). */
const MELEE_ABILITY_IDS = new Set([1, 6603]);

/** Build per-player, per-fight raw hit-type counts from the damage/healing EVENTS
 *  (each carries a hitType). Stored un-normalized so roleSheet can sum any fight
 *  subset and recompute percentages — exact on a single boss pull as well. */
function buildHitStatsByFight(
  events: NormalizeEventInputs, playerIds: Set<number>, bossFightIds: Set<number>,
): { hitStatsByFight?: PlayerFightHits[] } {
  if (
    events.damageDone === undefined &&
    events.damageTaken === undefined &&
    events.healingDone === undefined
  ) return {};

  const byKey = new Map<string, PlayerFightHits>();
  const ensure = (playerId: number, fightId: number): PlayerFightHits => {
    const key = `${playerId}:${fightId}`;
    let h = byKey.get(key);
    if (!h) {
      h = {
        playerId, fightId,
        outgoing: { hit: 0, crit: 0, dodge: 0, miss: 0, parry: 0, resist: 0 },
        incomingMelee: { hit: 0, crit: 0, crushing: 0, blocked: 0, dodge: 0, immune: 0, miss: 0, parry: 0 },
        heal: { hit: 0, crit: 0 },
        extraWindfury: 0,
      };
      byKey.set(key, h);
    }
    return h;
  };

  // Outgoing: the player's own damage events, bucketed by hit-type.
  for (const d of events.damageDone ?? []) {
    if (!playerIds.has(d.sourceID) || !bossFightIds.has(d.fight)) continue;
    const o = ensure(d.sourceID, d.fight).outgoing;
    switch (d.hitType) {
      case HIT.CRIT: o.crit++; break;
      case HIT.DODGE: o.dodge++; break;
      case HIT.MISS: o.miss++; break;
      case HIT.PARRY: o.parry++; break;
      default: o.hit++;
    }
  }

  // Incoming melee swings only: damage taken on the player, bucketed by hit-type.
  for (const d of events.damageTaken ?? []) {
    if (!playerIds.has(d.targetID) || !bossFightIds.has(d.fight)) continue;
    if (!MELEE_ABILITY_IDS.has(d.abilityGameID)) continue;
    const t = ensure(d.targetID, d.fight).incomingMelee;
    switch (d.hitType) {
      case HIT.CRIT: t.crit++; break;
      case HIT.BLOCKED_NORMAL:
      case HIT.BLOCKED_CRIT: t.blocked++; break;
      case HIT.DODGE: t.dodge++; break;
      case HIT.IMMUNE: t.immune++; break;
      case HIT.MISS: t.miss++; break;
      case HIT.PARRY: t.parry++; break;
      default: t.hit++;
    }
  }

  // Crit heals: the player's actual heals (not shield absorbs) with a crit hit-type.
  for (const h of events.healingDone ?? []) {
    if (h.type !== "heal") continue;
    if (!playerIds.has(h.sourceID) || !bossFightIds.has(h.fight)) continue;
    const heal = ensure(h.sourceID, h.fight).heal;
    if (h.hitType === HIT.CRIT) heal.crit++;
    else heal.hit++;
  }

  // Extra Windfury attacks (per fight): a shaman's Windfury Weapon imbue extra
  // swings log as damage events named "Windfury Attack" (and Windfury Totem
  // procs, where WCL names them, start "Windfury" too). Match on the resolved
  // ability name — the proc id varies by rank/source. NOTE: Windfury Totem
  // procs on non-shaman melee resolve as plain Melee swings and are not
  // separately identifiable, so they are not captured here.
  const isWindfury = (id: number) =>
    (events.abilityMeta?.[String(id)]?.name ?? "").toLowerCase().startsWith("windfury");
  for (const d of events.damageDone ?? []) {
    if (!isWindfury(d.abilityGameID)) continue;
    if (playerIds.has(d.sourceID) && bossFightIds.has(d.fight)) {
      ensure(d.sourceID, d.fight).extraWindfury += 1;
    }
  }

  return { hitStatsByFight: [...byKey.values()] };
}

function buildRpb(
  events: NormalizeEventInputs,
  playerIds: Set<number>,
  fights: Fight[],
): Partial<Pick<ReportData,
  "playerTotals" | "playerDeaths" | "interrupts" | "damageTakenEvents" | "playerCasts" | "playerDamage" | "enemyDebuffs" | "absorbs" | "healingEvents">> {
  if (events.allCasts === undefined && events.damageDoneTable === undefined) return {};
  const fightIds = new Set(fights.map((f) => f.id));
  const names = events.actorNames ?? {};
  // Resolve a pet actor to its owner so pet damage/healing is credited to the
  // owner player (WCL merges pets into the owner's row); non-pets pass through.
  const petOwners = events.petOwners ?? {};
  const ownerOf = (id: number) => petOwners[id] ?? id;

  // per-player totals from summary tables
  const totalsById = new Map<number, PlayerTotals>();
  const ensure = (id: number) => {
    let t = totalsById.get(id);
    if (!t) { t = { playerId: id, healingDone: 0, damageDone: 0, damageTaken: 0, magicDamageDone: 0 }; totalsById.set(id, t); }
    return t;
  };
  for (const e of events.damageDoneTable ?? []) {
    if (!playerIds.has(e.id)) continue;
    const t = ensure(e.id); t.damageDone += e.total;
    if (e.type && e.type !== "Physical") t.magicDamageDone += e.total;
  }
  for (const e of events.healingTable ?? []) { if (playerIds.has(e.id)) ensure(e.id).healingDone += e.total; }
  for (const e of events.damageTakenTable ?? []) { if (playerIds.has(e.id)) ensure(e.id).damageTaken += e.total; }

  const playerDeaths: PlayerDeath[] = (events.deaths ?? [])
    .filter((d) => playerIds.has(d.targetID) && fightIds.has(d.fight))
    .map((d) => ({
      playerId: d.targetID, fightId: d.fight,
      killingAbilityId: d.killingAbilityGameID, timestamp: d.timestamp,
    }));

  // WCL interrupt events: source = the interrupter (player), target = the enemy
  // whose cast was stopped, extraAbilityGameID = the interrupted spell.
  const interrupts: InterruptEvent[] = (events.interrupts ?? [])
    .filter((i) => playerIds.has(i.sourceID) && fightIds.has(i.fight))
    .map((i) => ({
      fightId: i.fight, interrupterPlayerId: i.sourceID,
      interruptedSpellId: i.extraAbilityGameID ?? 0,
      sourceName: names[i.targetID] ?? `#${i.targetID}`,
    }));

  const damageTakenEvents: DamageTakenEvent[] = (events.damageTaken ?? [])
    .filter((d) => playerIds.has(d.targetID) && fightIds.has(d.fight))
    .map((d) => ({
      fightId: d.fight, targetPlayerId: d.targetID, abilityId: d.abilityGameID,
      amount: d.amount, fromFriendly: d.sourceIsFriendly === true,
      sourceName: names[d.sourceID] ?? "Environment",
      unmitigatedAmount: d.unmitigatedAmount,
    }));

  const playerCasts: PlayerCast[] = (events.allCasts ?? [])
    .filter((c) => playerIds.has(c.sourceID) && fightIds.has(c.fight))
    .map((c) => ({ fightId: c.fight, playerId: c.sourceID, spellId: c.abilityGameID, timestamp: c.timestamp }));

  const playerDamage: PlayerDamageEvent[] = (events.damageDone ?? [])
    .map((d) => ({ d, src: ownerOf(d.sourceID) }))
    .filter(({ d, src }) => playerIds.has(src) && fightIds.has(d.fight))
    .map(({ d, src }) => ({
      fightId: d.fight, sourceId: src, abilityId: d.abilityGameID,
      targetId: d.targetID, amount: d.amount, timestamp: d.timestamp,
      targetHostilePlayer: playerIds.has(d.targetID) && d.targetID !== src,
      selfInflicted: d.targetID === src,
    }));

  const healingEvents: HealingEvent[] = (events.healingDone ?? [])
    .map((d) => ({ d, src: ownerOf(d.sourceID) }))
    .filter(({ d, src }) => playerIds.has(src) && fightIds.has(d.fight))
    .map(({ d, src }) => ({ fightId: d.fight, sourceId: src, amount: d.amount }));

  // enemy debuffs sourced by a player → merged intervals (one open per fight:target:spell)
  const enemyDebuffs: EnemyDebuffInterval[] = [];
  {
    const fightById = new Map(fights.map((f) => [f.id, f]));
    const open = new Map<string, number>();
    const keyOf = (fid: number, tid: number, sid: number) => `${fid}:${tid}:${sid}`;
    for (const e of events.enemyDebuffs ?? []) {
      if (!playerIds.has(e.sourceID)) continue;
      if (playerIds.has(e.targetID)) continue;
      const fight = fightById.get(e.fight);
      if (!fight) continue;
      const key = keyOf(e.fight, e.targetID, e.abilityGameID);
      if (e.type === "applydebuff" || e.type === "refreshdebuff") {
        if (open.has(key)) continue;
        open.set(key, enemyDebuffs.length);
        enemyDebuffs.push({ fightId: e.fight, sourceId: e.sourceID, targetEnemyId: e.targetID, spellId: e.abilityGameID, startTime: e.timestamp, endTime: fight.endTime });
      } else if (e.type === "removedebuff") {
        const idx = open.get(key);
        if (idx !== undefined) { enemyDebuffs[idx]!.endTime = e.timestamp; open.delete(key); }
      }
    }
  }
  const absorbs: AbsorbEvent[] = (events.absorbEvents ?? [])
    .filter((d) => playerIds.has(d.targetID) && fightIds.has(d.fight))
    .map((d) => ({ fightId: d.fight, playerId: d.targetID, spellId: d.abilityGameID, amount: d.absorbed ?? 0 }));

  return {
    playerTotals: [...totalsById.values()],
    playerDeaths, interrupts, damageTakenEvents, playerCasts, playerDamage,
    enemyDebuffs, absorbs, healingEvents,
  };
}

function buildRankings(entries: RawRankingEntry[]): ReportRanking[] {
  const mapChar = (c: RawRankingCharacter): RankingCharacter => ({
    name: c.name,
    class: c.class ?? c.type ?? "Unknown",
    spec: c.spec,
    rankPercent: Math.round(c.rankPercent ?? 0),
    bracketPercent: Math.round(c.bracketPercent ?? 0),
    parse: Math.round(c.amount ?? 0),
  });
  return entries
    .filter((e) => e.fightID != null && e.encounter?.id != null)
    .map((e) => ({
      fightID: e.fightID!,
      encounterId: e.encounter!.id!,
      encounterName: e.encounter!.name ?? `Boss ${e.encounter!.id}`,
      tanks: (e.roles?.tanks?.characters ?? []).map(mapChar),
      healers: (e.roles?.healers?.characters ?? []).map(mapChar),
      dps: (e.roles?.dps?.characters ?? []).map(mapChar),
    }));
}

export function normalizeReport(
  reportId: string,
  raw: RawReport,
  combatants: RawCombatantInfo[] = [],
  itemMeta: Record<string, ItemMeta> = {},
  events: NormalizeEventInputs = {},
): ReportData {
  if (!raw.zone?.name) {
    throw new WclError(422, "The zone of the report was not recognized by WCL.");
  }
  if (!isTbcRaidZone(raw.zone.name)) {
    throw new WclError(422,
      `This is the TBC analyzer; report zone "${raw.zone.name}" is not a TBC raid.`);
  }
  if (!raw.masterData?.actors) {
    throw new WclError(422, "Report has no player data (it may be private or restricted).");
  }
  const fights: Fight[] = raw.fights.map((f) => ({
    id: f.id,
    name: f.name,
    encounterId: f.encounterID,
    isBoss: f.encounterID !== 0,
    kill: f.encounterID !== 0 ? (f.kill ?? false) : undefined,
    startTime: f.startTime,
    endTime: f.endTime,
  }));
  const buffEvents = events.buffEvents ?? [];
  const drumBuffIds = new Set(events.drumBuffIds ?? []);
  // Two-stage roster: friendlyPlayers ∩ actors, then keep only those who actually
  // did something. When no activity signal exists (trash-only / minimal cache), keep all.
  const allParticipants = filterToParticipants(raw);
  const activeIds = collectActiveIds(combatants, events);
  const players = activeIds.size > 0
    ? allParticipants.filter((p) => activeIds.has(p.id))
    : allParticipants;
  return {
    schemaVersion: SCHEMA_VERSION,
    reportId,
    title: raw.title,
    zoneName: raw.zone.name,
    startTime: raw.startTime,
    endTime: raw.endTime,
    fights,
    players,
    gear: combatants.map((c) => ({
      fightId: c.fight,
      playerId: c.sourceID,
      // map before dropping id-0 placeholders: Classic logs omit `slot`, so the
      // array index IS the slot id, and empty slots must still consume their index
      items: (c.gear ?? [])
        .map((g, index) => ({
          slot: g.slot ?? index,
          itemId: g.id,
          itemLevel: g.itemLevel,
          permanentEnchantId: g.permanentEnchant,
          temporaryEnchantId: g.temporaryEnchant,
          gemIds: (g.gems ?? []).map((gem) => gem.id),
        }))
        .filter((i) => i.itemId !== 0),
      auras: (c.auras ?? []).map((a) => a.ability),
    })),
    buffs: buildBuffIntervals(buffEvents, combatants, fights, events.trackedBuffIds ?? []),
    drumCasts: (events.castEvents ?? []).map((e) => ({
      fightId: e.fight, sourceId: e.sourceID, spellId: e.abilityGameID, timestamp: e.timestamp,
    })),
    drumApplications: buffEvents
      .filter((e) => (e.type === "applybuff" || e.type === "refreshbuff")
        && drumBuffIds.has(e.abilityGameID))
      .map((e) => ({
        fightId: e.fight, sourceId: e.sourceID, targetId: e.targetID,
        spellId: e.abilityGameID, timestamp: e.timestamp,
      })),
    ...buildRpb(events, new Set(players.map((p) => p.id)), fights),
    ...buildHitStatsByFight(events, new Set(players.map((p) => p.id)), new Set(fights.filter((f) => f.isBoss).map((f) => f.id))),
    rankings: events.rankings ? buildRankings(events.rankings) : undefined,
    itemMeta,
    abilityMeta: events.abilityMeta ?? {},
  };
}

/**
 * Turn WCL apply/refresh/remove buff events into per-fight BuffIntervals.
 *
 * Ordering decision: pull-aura seeds (combatantInfo) are processed BEFORE the
 * event sweep. A seed opens an interval at the fight start; a later removebuff
 * then closes it naturally, and a later applybuff for the same key is ignored
 * while the seeded interval is open. Crucially, this also prevents
 * double-creation: without seeding-first, a remove-without-apply would ALSO
 * fall back to "open since pull" and we'd emit the same interval twice.
 */
export function buildBuffIntervals(
  buffEvents: RawBuffEvent[],
  combatants: RawCombatantInfo[],
  fights: Fight[],
  trackedBuffIds: number[],
): BuffInterval[] {
  const fightById = new Map(fights.map((f) => [f.id, f]));
  const tracked = new Set(trackedBuffIds);
  const intervals: BuffInterval[] = [];
  /** key "fightId:targetId:spellId" → index into `intervals` of the open one */
  const open = new Map<string, number>();
  const keyOf = (fightId: number, targetId: number, spellId: number) =>
    `${fightId}:${targetId}:${spellId}`;

  const openAt = (fightId: number, targetId: number, spellId: number, startTime: number) => {
    const fight = fightById.get(fightId);
    if (!fight) return;
    const key = keyOf(fightId, targetId, spellId);
    if (open.has(key)) return;
    open.set(key, intervals.length);
    intervals.push({ fightId, targetId, spellId, startTime, endTime: fight.endTime });
  };

  // 1. seed from pull auras (must precede the event sweep — see doc comment)
  for (const c of combatants) {
    const fight = fightById.get(c.fight);
    if (!fight) continue;
    for (const aura of c.auras ?? []) {
      if (tracked.has(aura.ability)) openAt(c.fight, c.sourceID, aura.ability, fight.startTime);
    }
  }

  // 2. sweep the (time-ordered) events
  for (const e of buffEvents) {
    const fight = fightById.get(e.fight);
    if (!fight) continue;
    if (e.type === "applybuff" || e.type === "refreshbuff") {
      openAt(e.fight, e.targetID, e.abilityGameID, e.timestamp);
    } else if (e.type === "removebuff") {
      const key = keyOf(e.fight, e.targetID, e.abilityGameID);
      const idx = open.get(key);
      if (idx !== undefined) {
        intervals[idx]!.endTime = e.timestamp;
        open.delete(key);
      } else {
        // remove without a prior apply: the buff was up since the pull
        intervals.push({
          fightId: e.fight, targetId: e.targetID, spellId: e.abilityGameID,
          startTime: fight.startTime, endTime: e.timestamp,
        });
      }
    }
  }
  // still-open intervals already end at fight.endTime (set in openAt)

  // 3. clamp to the fight window; drop empty/negative intervals
  return intervals.flatMap((iv) => {
    const fight = fightById.get(iv.fightId)!;
    const startTime = Math.max(iv.startTime, fight.startTime);
    const endTime = Math.min(iv.endTime, fight.endTime);
    return endTime > startTime ? [{ ...iv, startTime, endTime }] : [];
  });
}

/**
 * Classic combat logs record every player the logger walks past (e.g. in
 * Shattrath), so masterData lists far more "players" than the raid had.
 * Keep only actors that appear in some fight's friendlyPlayers; if WCL gave
 * us no participation info at all, fall back to the full actor list.
 */
function filterToParticipants(raw: RawReport) {
  const participants = new Set<number>();
  let hasInfo = false;
  for (const f of raw.fights) {
    if (f.friendlyPlayers == null) continue;
    hasInfo = true;
    for (const id of f.friendlyPlayers) participants.add(id);
  }
  const actors = raw.masterData!.actors;
  const kept = hasInfo ? actors.filter((a) => participants.has(a.id)) : actors;
  return kept.map((a) => ({ id: a.id, name: a.name, class: a.subType }));
}

/**
 * WCL's friendlyPlayers can include people who were briefly grouped/flagged but
 * never actually raided (no combatantInfo, no damage/healing/casts) — they show up
 * as extra chips, often class "Unknown". Collect every actor id that left a combat
 * footprint so we can drop the inert ones. Returns an empty set when we have no
 * activity signal at all (e.g. trash-only reports), so callers fall back gracefully.
 */
function collectActiveIds(combatants: RawCombatantInfo[], events: NormalizeEventInputs): Set<number> {
  const ids = new Set<number>();
  for (const c of combatants) ids.add(c.sourceID);
  for (const e of events.damageDoneTable ?? []) ids.add(e.id);
  for (const e of events.healingTable ?? []) ids.add(e.id);
  for (const e of events.damageTakenTable ?? []) ids.add(e.id);
  for (const c of events.allCasts ?? []) ids.add(c.sourceID);
  for (const d of events.damageDone ?? []) ids.add(d.sourceID);
  for (const d of events.damageTaken ?? []) ids.add(d.targetID);
  for (const c of events.castEvents ?? []) ids.add(c.sourceID);
  for (const e of events.buffEvents ?? []) { ids.add(e.sourceID); ids.add(e.targetID); }
  for (const d of events.deaths ?? []) ids.add(d.targetID);
  return ids;
}
