import {
  isTbcRaidZone,
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
} from "./wcl";

export interface NormalizeEventInputs {
  buffEvents?: RawBuffEvent[];
  castEvents?: RawCastEvent[];
  /** buff ids whose pull-time presence (combatantInfo auras) should seed intervals */
  trackedBuffIds?: number[];
  /** buff ids that count as drum buffs for drumApplications */
  drumBuffIds?: number[];
  /** enemy/player death events; enemy deaths become npcKills */
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
}

function buildNpcKills(
  deaths: RawDeathEvent[],
  npcs: { id: number; gameID: number }[],
  fights: Fight[],
): { npcKills: Record<string, number>; firstPullNpcIds: number[] } {
  const gameIdByActor = new Map(npcs.map((n) => [n.id, n.gameID]));
  const npcKills: Record<string, number> = {};
  const firstFightId = fights.length === 0 ? undefined
    : fights.reduce((a, b) => (b.startTime < a.startTime ? b : a)).id;
  const firstPull = new Set<number>();
  for (const d of deaths) {
    const gameId = gameIdByActor.get(d.targetID);
    if (gameId === undefined) continue; // not an NPC (e.g. a player death)
    npcKills[String(gameId)] = (npcKills[String(gameId)] ?? 0) + 1;
    if (d.fight === firstFightId) firstPull.add(gameId);
  }
  return { npcKills, firstPullNpcIds: [...firstPull] };
}

function buildRpb(
  events: NormalizeEventInputs,
  playerIds: Set<number>,
  fights: Fight[],
): Partial<Pick<ReportData,
  "playerTotals" | "playerDeaths" | "interrupts" | "damageTakenEvents" | "playerCasts" | "playerDamage">> {
  if (events.allCasts === undefined && events.damageDoneTable === undefined) return {};
  const fightIds = new Set(fights.map((f) => f.id));
  const names = events.actorNames ?? {};

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
    .map((d) => ({ playerId: d.targetID, fightId: d.fight }));

  const interrupts: InterruptEvent[] = (events.interrupts ?? [])
    .filter((i) => playerIds.has(i.targetID) && fightIds.has(i.fight))
    .map((i) => ({
      fightId: i.fight, targetPlayerId: i.targetID,
      interruptedSpellId: i.extraAbilityGameID ?? 0,
      sourceName: names[i.sourceID] ?? `#${i.sourceID}`,
    }));

  const damageTakenEvents: DamageTakenEvent[] = (events.damageTaken ?? [])
    .filter((d) => playerIds.has(d.targetID) && fightIds.has(d.fight))
    .map((d) => ({
      fightId: d.fight, targetPlayerId: d.targetID, abilityId: d.abilityGameID,
      amount: d.amount, fromFriendly: d.sourceIsFriendly === true,
    }));

  const playerCasts: PlayerCast[] = (events.allCasts ?? [])
    .filter((c) => playerIds.has(c.sourceID) && fightIds.has(c.fight))
    .map((c) => ({ fightId: c.fight, playerId: c.sourceID, spellId: c.abilityGameID, timestamp: c.timestamp }));

  const playerDamage: PlayerDamageEvent[] = (events.damageDone ?? [])
    .filter((d) => playerIds.has(d.sourceID) && fightIds.has(d.fight))
    .map((d) => ({
      fightId: d.fight, sourceId: d.sourceID, abilityId: d.abilityGameID,
      targetId: d.targetID, amount: d.amount, timestamp: d.timestamp,
      targetHostilePlayer: playerIds.has(d.targetID) && d.targetID !== d.sourceID,
      selfInflicted: d.targetID === d.sourceID,
    }));

  return {
    playerTotals: [...totalsById.values()],
    playerDeaths, interrupts, damageTakenEvents, playerCasts, playerDamage,
  };
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
  const players = filterToParticipants(raw);
  return {
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
    ...(events.deaths
      ? buildNpcKills(events.deaths, raw.masterData!.npcs ?? [], fights)
      : {}),
    ...buildRpb(events, new Set(players.map((p) => p.id)), fights),
    itemMeta,
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
