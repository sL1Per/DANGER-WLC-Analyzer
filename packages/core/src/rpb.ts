import type { ReportData, Role } from "./types";
import { detectRole, type RoleConfig } from "./roles";
import { activity, type ActivityConfig, type ActivityResult } from "./activity";
import { classMetrics, type ClassAbilitySpec, type ClassAbilityResult } from "./classMetrics";

export type RpbSeverity = "major" | "moderate" | "minor" | "ok";

export interface RpbConfig {
  roles: RoleConfig;
  activity: ActivityConfig;
  engineeringDamageIds: number[];
  oilOfImmolationSpellId: number;
  battleShoutBuffIds: number[];
  absorbExcludedSpellIds: number[];
  /** curated per-class ability table (M5b) */
  classAbilities: ClassAbilitySpec[];
  /** ability ids whose damage-taken counts as avoidable (M5b) */
  avoidableAbilityIds: Set<number>;
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
  /** player damage where target == source (reflected/self) (M5b) */
  damageReflected: number;
  /** player damage dealt to a hostile player — PvP, counts as self in RPB (M5b) */
  damageToHostilePlayers: number;
  /** boss damage taken from curated avoidable ability ids only (M5b) */
  totalAvoidableDamageTaken: number;
  /** all boss damage taken (context for avoidable) */
  totalPartlyAvoidable: number;
  /** per-class ability rows (M5b) */
  classRows: ClassAbilityResult[];
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

  // The fight set comes from report.fights (the caller scopes it — boss card,
  // single boss, or trash card — via scopeReportToFight). Kalecgos is always
  // dropped because its portal mechanic breaks the numbers.
  const scopedFights = report.fights.filter((f) => !isKalecgos(f.name));
  const fightIds = new Set(scopedFights.map((f) => f.id));
  const durationMs = scopedFights.reduce((s, f) => s + (f.endTime - f.startTime), 0);

  const inScope = <T extends { fightId: number }>(xs: T[] | undefined) =>
    (xs ?? []).filter((x) => fightIds.has(x.fightId));

  const deaths = inScope(report.playerDeaths);
  const interrupts = inScope(report.interrupts);
  const dmgTaken = inScope(report.damageTakenEvents);
  const absorbs = inScope(report.absorbs).filter((a) => !cfg.absorbExcludedSpellIds.includes(a.spellId));

  const rows: RpbRow[] = [];
  for (const player of report.players) {
    const id = player.id;
    const myDmgTaken = dmgTaken.filter((d) => d.targetPlayerId === id);
    const myDamage = (report.playerDamage ?? []).filter((d) => d.sourceId === id && fightIds.has(d.fightId));
    const myInterrupts = interrupts.filter((i) => i.interrupterPlayerId === id);

    const friendlyFire = myDmgTaken.filter((d) => d.fromFriendly).reduce((s, d) => s + d.amount, 0);
    const totalPartlyAvoidable = myDmgTaken.reduce((s, d) => s + d.amount, 0);
    const totalAvoidable = myDmgTaken
      .filter((d) => cfg.avoidableAbilityIds.has(d.abilityId))
      .reduce((s, d) => s + d.amount, 0);
    const battleShoutMs = uptimeMs(report, id, cfg.battleShoutBuffIds, fightIds);

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
      damageReflected: myDamage.filter((d) => d.selfInflicted).reduce((s, d) => s + d.amount, 0),
      damageToHostilePlayers: myDamage.filter((d) => d.targetHostilePlayer && !d.selfInflicted).reduce((s, d) => s + d.amount, 0),
      totalAvoidableDamageTaken: totalAvoidable,
      totalPartlyAvoidable,
      classRows: classMetrics(id, player.class, report, cfg.classAbilities, fightIds, durationMs),
      engineeringDamage: myDamage
        .filter((d) => cfg.engineeringDamageIds.includes(d.abilityId))
        .reduce((s, d) => s + d.amount, 0),
      oilOfImmolationDamage: myDamage
        .filter((d) => d.abilityId === cfg.oilOfImmolationSpellId)
        .reduce((s, d) => s + d.amount, 0),
      battleShoutUptime: durationMs > 0 ? battleShoutMs / durationMs : 0,
      activity: activity(id, report, cfg.activity, fightIds),
      severity: "ok",
    };
    row.severity = severityFor(row);
    rows.push(row);
  }
  rows.sort((a, b) => a.role.localeCompare(b.role) || a.playerName.localeCompare(b.playerName));
  return { rows };
}

/** total ms (within the scoped fights) the player had any of the given buffs active */
function uptimeMs(report: ReportData, playerId: number, buffIds: number[], fightIds: Set<number>): number {
  const set = new Set(buffIds);
  return (report.buffs ?? [])
    .filter((b) => b.targetId === playerId && set.has(b.spellId) && fightIds.has(b.fightId))
    .reduce((s, b) => s + (b.endTime - b.startTime), 0);
}

function severityFor(row: RpbRow): RpbSeverity {
  if (row.deaths > 0) return "major";
  // friendly fire is a player-controllable mistake worth flagging; generic
  // avoidable-damage magnitude coloring is deferred to a later tuning pass.
  if (row.friendlyFire > 0) return "moderate";
  return "ok";
}
