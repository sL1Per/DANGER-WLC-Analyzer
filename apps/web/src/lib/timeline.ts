import type { ReportData, PlayerDamageEvent } from "@wcl/core";
import type { RawBuffEvent, RawDebuffEvent } from "./wcl/wcl";

/** A cast and the hit it produced are two separate WCL events (the hit can land
 *  a beat after the cast, e.g. a travelling shot) — this is how long after a
 *  cast we'll still credit a same-player/same-ability hit to it. */
const CAST_DAMAGE_MATCH_WINDOW_MS = 5000;

export type TimelineCategory = "cast" | "death" | "interrupt" | "buff" | "debuff" | "damage-dealt" | "damage-taken";

export interface TimelineEntry {
  /** report-relative ms, matches Fight.startTime/endTime */
  timestamp: number;
  category: TimelineCategory;
  /** plain-text rendering of the row, also used for free-text search */
  text: string;
  /** the player this row is primarily about (caster/dier/interrupter/buff or
   *  debuff target; the recipient for damage-taken; the attacker for damage-dealt) */
  playerId: number;
  playerName: string;
  /** the ability involved, when there is one (always true except a death with no known killing blow) */
  spellId?: number;
  spellName?: string;
  /** the other party named in the sentence: a cast's target, an interrupt's
   *  enemy caster, or the counterpart on a damage row. `targetId` is only set
   *  when that party is a friendly player (so the UI can class-color it) —
   *  an enemy/NPC target has a name but no id. */
  targetId?: number;
  targetName?: string;
  /** damage-dealt/damage-taken only: raw hit amount */
  amount?: number;
  /** damage-dealt/damage-taken only: plain-text hit result, e.g. "crit", "miss", "dodge" */
  resultLabel?: string;
}

function abilityName(report: ReportData, spellId: number): string {
  return report.abilityMeta?.[String(spellId)]?.name ?? `Spell #${spellId}`;
}

/** WCL hit-type code -> plain-text result label (0 miss, 1 hit, 2 crit, 4/5
 *  blocked, 7 dodge, 8 parry, 10 immune); undefined (incl. plain hit) shows nothing. */
function hitResultLabel(hitType: number | undefined): string | undefined {
  switch (hitType) {
    case 0: return "miss";
    case 2: return "crit";
    case 4: case 5: return "block";
    case 7: return "dodge";
    case 8: return "parry";
    case 10: return "immune";
    default: return undefined;
  }
}

function fmtAmount(n: number): string {
  return n.toLocaleString("en-US");
}

/** Greedily attributes each cast to the nearest not-yet-claimed damage instance
 *  from the same player+ability within CAST_DAMAGE_MATCH_WINDOW_MS, so a cast
 *  can show its own result inline instead of that hit showing as a separate
 *  "damage-dealt" row. Matches on player+ability only (not target) — precise
 *  for the common single-target case; an AoE/ground spell (one cast, several
 *  hits) just picks up whichever one hit landed first, which is an accepted
 *  simplification rather than an attempt to sum every target. Casts must be
 *  processed in chronological order for the greedy claim to prefer the
 *  earliest cast when several near-simultaneous casts of the same ability compete. */
function makeDamageClaimer(damagePool: PlayerDamageEvent[]) {
  const byKey = new Map<string, PlayerDamageEvent[]>();
  for (const d of damagePool) {
    const key = `${d.sourceId}:${d.abilityId}`;
    const arr = byKey.get(key);
    if (arr) arr.push(d); else byKey.set(key, [d]);
  }
  const claimed = new Set<PlayerDamageEvent>();
  return {
    claim(playerId: number, spellId: number, castTimestamp: number): PlayerDamageEvent | undefined {
      let best: PlayerDamageEvent | undefined;
      for (const d of byKey.get(`${playerId}:${spellId}`) ?? []) {
        if (claimed.has(d)) continue;
        if (d.timestamp < castTimestamp || d.timestamp - castTimestamp > CAST_DAMAGE_MATCH_WINDOW_MS) continue;
        if (!best || d.timestamp < best.timestamp) best = d;
      }
      if (best) claimed.add(best);
      return best;
    },
    isClaimed: (d: PlayerDamageEvent) => claimed.has(d),
  };
}

/** Merges the report's already-normalized casts/deaths/interrupts/damage for one
 *  fight with freshly-fetched friendly buff/debuff events (see fetchFriendlyBuffs /
 *  fetchFriendlyDebuffs), into one chronological event log for the Timeline tab. */
export function buildTimeline(
  report: ReportData,
  fightId: number,
  friendlyBuffs: RawBuffEvent[],
  friendlyDebuffs: RawDebuffEvent[],
): TimelineEntry[] {
  const players = new Map(report.players.map((p) => [p.id, p.name]));
  const playerName = (id: number) => players.get(id) ?? `#${id}`;
  const entries: TimelineEntry[] = [];

  const damagePool = (report.playerDamage ?? []).filter((d) => d.fightId === fightId);
  const damageClaimer = makeDamageClaimer(damagePool);

  for (const c of report.playerCasts ?? []) {
    if (c.fightId !== fightId) continue;
    const spellName = abilityName(report, c.spellId);
    // Skip a self-target suffix — "casts Renew on Playerone" on Playerone's own
    // row reads as noise; a cast on someone else is the informative case.
    const hasTarget = c.targetId != null && c.targetId !== c.playerId && c.targetName != null;
    const hit = damageClaimer.claim(c.playerId, c.spellId, c.timestamp);
    const resultLabel = hit ? hitResultLabel(hit.hitType) : undefined;
    const amountText = hit && hit.amount > 0 ? ` for ${fmtAmount(hit.amount)}` : "";
    const resultText = resultLabel ? ` (${resultLabel})` : "";
    entries.push({
      timestamp: c.timestamp, category: "cast",
      playerId: c.playerId, playerName: playerName(c.playerId),
      spellId: c.spellId, spellName,
      targetId: hasTarget && players.has(c.targetId!) ? c.targetId : undefined,
      targetName: hasTarget ? c.targetName : undefined,
      amount: hit?.amount, resultLabel,
      text: `${playerName(c.playerId)} casts ${spellName}${hasTarget ? ` on ${c.targetName}` : ""}${amountText}${resultText}`,
    });
  }

  for (const d of report.playerDeaths ?? []) {
    if (d.fightId !== fightId || d.timestamp == null) continue;
    const spellName = d.killingAbilityId != null ? abilityName(report, d.killingAbilityId) : undefined;
    entries.push({
      timestamp: d.timestamp, category: "death",
      playerId: d.playerId, playerName: playerName(d.playerId),
      spellId: d.killingAbilityId, spellName,
      text: `${playerName(d.playerId)} dies${spellName ? ` to ${spellName}` : ""}`,
    });
  }

  // Pre-v12 caches have no interrupt timestamp — dropped rather than shown out of order.
  for (const i of report.interrupts ?? []) {
    if (i.fightId !== fightId || i.timestamp == null) continue;
    const spellName = abilityName(report, i.interruptedSpellId);
    entries.push({
      timestamp: i.timestamp, category: "interrupt",
      playerId: i.interrupterPlayerId, playerName: playerName(i.interrupterPlayerId),
      spellId: i.interruptedSpellId, spellName, targetName: i.sourceName,
      text: `${playerName(i.interrupterPlayerId)} interrupts ${i.sourceName}'s ${spellName}`,
    });
  }

  for (const b of friendlyBuffs) {
    if (b.fight !== fightId) continue;
    const spellName = abilityName(report, b.abilityGameID);
    entries.push({
      timestamp: b.timestamp, category: "buff",
      playerId: b.targetID, playerName: playerName(b.targetID),
      spellId: b.abilityGameID, spellName,
      text: `${playerName(b.targetID)} gains ${spellName}`,
    });
  }

  for (const d of friendlyDebuffs) {
    if (d.fight !== fightId) continue;
    const spellName = abilityName(report, d.abilityGameID);
    entries.push({
      timestamp: d.timestamp, category: "debuff",
      playerId: d.targetID, playerName: playerName(d.targetID),
      spellId: d.abilityGameID, spellName,
      text: `${spellName} applied to ${playerName(d.targetID)}`,
    });
  }

  // Damage dealt BY players — includes melee/ranged auto-attacks (WCL ability
  // id 1), not just spells, since they arrive in the same DamageDone stream.
  // Hits already merged onto their originating cast (above) are skipped here
  // so they don't also show up as a separate row.
  for (const d of damagePool) {
    if (damageClaimer.isClaimed(d)) continue;
    const spellName = abilityName(report, d.abilityId);
    const resultLabel = hitResultLabel(d.hitType);
    const targetName = d.targetName ?? `#${d.targetId}`;
    const amountText = d.amount > 0 ? ` for ${fmtAmount(d.amount)}` : "";
    entries.push({
      timestamp: d.timestamp, category: "damage-dealt",
      playerId: d.sourceId, playerName: playerName(d.sourceId),
      targetId: players.has(d.targetId) ? d.targetId : undefined, targetName,
      spellId: d.abilityId, spellName, amount: d.amount, resultLabel,
      text: `${playerName(d.sourceId)} hits ${targetName} with ${spellName}${amountText}${resultLabel ? ` (${resultLabel})` : ""}`,
    });
  }

  // Damage taken BY players from enemies — same source as the role-sheet hit
  // stats, just replayed as a timeline instead of aggregated. No timestamp on
  // pre-v13 caches, so those are dropped rather than shown out of order.
  for (const d of report.damageTakenEvents ?? []) {
    if (d.fightId !== fightId || d.timestamp == null) continue;
    const spellName = abilityName(report, d.abilityId);
    const resultLabel = hitResultLabel(d.hitType);
    const attackerName = d.sourceName ?? "Environment";
    const amountText = d.amount > 0 ? ` for ${fmtAmount(d.amount)}` : "";
    entries.push({
      timestamp: d.timestamp, category: "damage-taken",
      playerId: d.targetPlayerId, playerName: playerName(d.targetPlayerId),
      targetName: attackerName,
      spellId: d.abilityId, spellName, amount: d.amount, resultLabel,
      text: `${attackerName} hits ${playerName(d.targetPlayerId)} with ${spellName}${amountText}${resultLabel ? ` (${resultLabel})` : ""}`,
    });
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp);
}
