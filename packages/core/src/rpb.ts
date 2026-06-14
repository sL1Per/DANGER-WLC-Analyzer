import type { ReportData, Role } from "./types";
import { detectRole, type RoleConfig } from "./roles";
import { activity, type ActivityConfig, type ActivityResult } from "./activity";

export type RpbSeverity = "major" | "moderate" | "minor" | "ok";

export interface RpbConfig {
  roles: RoleConfig;
  activity: ActivityConfig;
  engineeringDamageIds: number[];
  oilOfImmolationSpellId: number;
  battleShoutBuffIds: number[];
  absorbExcludedSpellIds: number[];
}

export interface RpbRow {
  playerId: number;
  playerName: string;
  className: string;
  role: Role;
  deaths: number;
  interruptedSpells: number;
  interruptSources: string[];
  totalAbsorbed: number;
  friendlyFire: number;
  damageReflectedOrHostile: number;
  totalAvoidableDamageTaken: number;
  engineeringDamage: number;
  oilOfImmolationDamage: number;
  battleShoutUptime: number; // fraction 0..1 of boss-fight time
  activity: ActivityResult | null;
  severity: RpbSeverity;
}

/** Kalecgos breaks RPB numbers (portal mechanic) — excluded from all aggregation. */
const isKalecgos = (name: string) => name.toLowerCase().includes("kalecgos");

export function rpb(report: ReportData, cfg: RpbConfig): { rows: RpbRow[] } | null {
  if (report.playerTotals === undefined) return null;

  const bossFights = report.fights.filter((f) => f.isBoss && !isKalecgos(f.name));
  const bossFightIds = new Set(bossFights.map((f) => f.id));
  const bossDurationMs = bossFights.reduce((s, f) => s + (f.endTime - f.startTime), 0);

  const inBoss = <T extends { fightId: number }>(xs: T[] | undefined) =>
    (xs ?? []).filter((x) => bossFightIds.has(x.fightId));

  const deaths = inBoss(report.playerDeaths);
  const interrupts = inBoss(report.interrupts);
  const dmgTaken = inBoss(report.damageTakenEvents);
  const absorbs = inBoss(report.absorbs).filter((a) => !cfg.absorbExcludedSpellIds.includes(a.spellId));

  const rows: RpbRow[] = [];
  for (const player of report.players) {
    const id = player.id;
    const myDmgTaken = dmgTaken.filter((d) => d.targetPlayerId === id);
    const myDamage = (report.playerDamage ?? []).filter((d) => d.sourceId === id && bossFightIds.has(d.fightId));
    const myInterrupts = interrupts.filter((i) => i.targetPlayerId === id);

    const friendlyFire = myDmgTaken.filter((d) => d.fromFriendly).reduce((s, d) => s + d.amount, 0);
    const totalAvoidable = myDmgTaken.reduce((s, d) => s + d.amount, 0);
    const battleShoutMs = uptimeMs(report, id, cfg.battleShoutBuffIds, bossFightIds);

    const row: RpbRow = {
      playerId: id,
      playerName: player.name,
      className: player.class,
      role: detectRole(id, report, cfg.roles),
      deaths: deaths.filter((d) => d.playerId === id).length,
      interruptedSpells: myInterrupts.length,
      interruptSources: [...new Set(myInterrupts.map((i) => i.sourceName))],
      totalAbsorbed: absorbs.filter((a) => a.playerId === id).reduce((s, a) => s + a.amount, 0),
      friendlyFire,
      damageReflectedOrHostile: myDamage
        .filter((d) => d.selfInflicted || d.targetHostilePlayer)
        .reduce((s, d) => s + d.amount, 0),
      totalAvoidableDamageTaken: totalAvoidable,
      engineeringDamage: myDamage
        .filter((d) => cfg.engineeringDamageIds.includes(d.abilityId))
        .reduce((s, d) => s + d.amount, 0),
      oilOfImmolationDamage: myDamage
        .filter((d) => d.abilityId === cfg.oilOfImmolationSpellId)
        .reduce((s, d) => s + d.amount, 0),
      battleShoutUptime: bossDurationMs > 0 ? battleShoutMs / bossDurationMs : 0,
      activity: activity(id, report, cfg.activity, bossFightIds),
      severity: "ok",
    };
    row.severity = severityFor(row);
    rows.push(row);
  }
  rows.sort((a, b) => a.role.localeCompare(b.role) || a.playerName.localeCompare(b.playerName));
  return { rows };
}

/** total ms (within boss fights) the player had any of the given buffs active */
function uptimeMs(report: ReportData, playerId: number, buffIds: number[], bossFightIds: Set<number>): number {
  const set = new Set(buffIds);
  return (report.buffs ?? [])
    .filter((b) => b.targetId === playerId && set.has(b.spellId) && bossFightIds.has(b.fightId))
    .reduce((s, b) => s + (b.endTime - b.startTime), 0);
}

function severityFor(row: RpbRow): RpbSeverity {
  if (row.deaths > 0) return "major";
  // friendly fire is a player-controllable mistake worth flagging; generic
  // avoidable-damage magnitude coloring is deferred to a later tuning pass.
  if (row.friendlyFire > 0) return "moderate";
  return "ok";
}
