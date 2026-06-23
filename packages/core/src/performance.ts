import type { ReportData } from "./types";

export interface PerfRanked {
  /** player id (source panels) or ability id (ability panel) */
  id: number;
  name: string;
  /** WoW class for class-colored source rows; undefined for ability rows */
  className?: string;
  amount: number;
  /** share of this panel's total, 0..1 */
  percent: number;
  perSecond: number;
}

export interface PerfDeathRow {
  playerId: number;
  playerName: string;
  className?: string;
  /** killing-blow ability name, or "—" when unknown */
  killingBlow: string;
  /** ms into the death's own fight */
  timeMs: number;
}

export interface PerformanceSummary {
  damageBySource: PerfRanked[];
  healingBySource: PerfRanked[];
  damageTakenByAbility: PerfRanked[];
  deaths: PerfDeathRow[];
  /** total scoped fight duration in ms (rate denominator) */
  durationMs: number;
}

/** Build the four WCL-style summary panels from an already-scoped report.
 *  The caller scopes via scopeReportToFight; this derives its fight set from
 *  report.fights only (project invariant — no internal isBoss filter).
 *  Returns null when the data needed is absent (pre-feature cache). */
export function performanceSummary(report: ReportData): PerformanceSummary | null {
  if (report.healingEvents === undefined) return null;

  const fightIds = new Set(report.fights.map((f) => f.id));
  const fightStart = new Map(report.fights.map((f) => [f.id, f.startTime]));
  const durationMs = report.fights.reduce((s, f) => s + Math.max(0, f.endTime - f.startTime), 0);
  const playerById = new Map(report.players.map((p) => [p.id, p]));
  const abilityName = (id: number) => report.abilityMeta?.[String(id)]?.name ?? `Ability #${id}`;

  const toRanked = (
    totals: Map<number, number>,
    name: (id: number) => string,
    className: (id: number) => string | undefined,
  ): PerfRanked[] => {
    const total = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .map(([id, amount]) => ({
        id,
        name: name(id),
        className: className(id),
        amount,
        percent: total > 0 ? amount / total : 0,
        perSecond: durationMs > 0 ? amount / (durationMs / 1000) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  // 1. Damage done by source (player) — exclude self/reflected damage.
  const dmgBySrc = new Map<number, number>();
  for (const d of report.playerDamage ?? []) {
    if (!fightIds.has(d.fightId) || d.selfInflicted) continue;
    dmgBySrc.set(d.sourceId, (dmgBySrc.get(d.sourceId) ?? 0) + d.amount);
  }

  // 2. Healing done by source (player).
  const healBySrc = new Map<number, number>();
  for (const h of report.healingEvents ?? []) {
    if (!fightIds.has(h.fightId)) continue;
    healBySrc.set(h.sourceId, (healBySrc.get(h.sourceId) ?? 0) + h.amount);
  }

  const playerName = (id: number) => playerById.get(id)?.name ?? `#${id}`;
  const playerClass = (id: number) => playerById.get(id)?.class;

  // 3. Damage taken by ability (raid-wide).
  const dtByAbility = new Map<number, number>();
  for (const d of report.damageTakenEvents ?? []) {
    if (!fightIds.has(d.fightId)) continue;
    dtByAbility.set(d.abilityId, (dtByAbility.get(d.abilityId) ?? 0) + d.amount);
  }

  // 4. Deaths (per player), sorted by time into their fight.
  const deaths: PerfDeathRow[] = (report.playerDeaths ?? [])
    .filter((d) => fightIds.has(d.fightId))
    .map((d) => ({
      playerId: d.playerId,
      playerName: playerName(d.playerId),
      className: playerClass(d.playerId),
      killingBlow: d.killingAbilityId !== undefined ? abilityName(d.killingAbilityId) : "—",
      timeMs: d.timestamp !== undefined ? Math.max(0, d.timestamp - (fightStart.get(d.fightId) ?? 0)) : 0,
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  return {
    damageBySource: toRanked(dmgBySrc, playerName, playerClass),
    healingBySource: toRanked(healBySrc, playerName, playerClass),
    damageTakenByAbility: toRanked(dtByAbility, abilityName, () => undefined),
    deaths,
    durationMs,
  };
}
