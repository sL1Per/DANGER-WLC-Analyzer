import type { ReportData, Role } from "./types";

export type ClassAbilityMeasure = "enemy-debuff-uptime" | "self-buff-uptime" | "cast-count";

/** Structural copy of @wcl/data's ClassAbility (core stays pure — data injected). */
export interface ClassAbilitySpec {
  className: string;
  key: string;
  name: string;
  measure: ClassAbilityMeasure;
  spellIds: number[];
  ranks?: { spellId: number; rank: number }[];
  optimalRank?: "max" | number;
  appliesToRole?: Role;
  verified?: boolean;
}

export interface ClassAbilityResult {
  key: string;
  name: string;
  measure: ClassAbilityMeasure;
  uptimePct?: number;
  castCount?: number;
  rankFlag: boolean;
  verified: boolean;
  severity: "major" | "moderate" | "minor" | "ok";
}

/** Per-player class-specific ability rows. Pure: abilities + boss context injected.
 *  bossDurationMs is the summed duration of bossFightIds (Kalecgos already excluded
 *  upstream). */
export function classMetrics(
  playerId: number,
  className: string,
  report: ReportData,
  abilities: ClassAbilitySpec[],
  bossFightIds: Set<number>,
  bossDurationMs: number,
): ClassAbilityResult[] {
  const myCasts = (report.playerCasts ?? []).filter((c) => c.playerId === playerId && bossFightIds.has(c.fightId));
  const myDebuffs = (report.enemyDebuffs ?? []).filter((d) => d.sourceId === playerId && bossFightIds.has(d.fightId));
  const myBuffs = (report.buffs ?? []).filter((b) => b.targetId === playerId && bossFightIds.has(b.fightId));

  const out: ClassAbilityResult[] = [];
  for (const a of abilities) {
    if (a.className !== className) continue;
    const idSet = new Set(a.spellIds);

    let uptimePct: number | undefined;
    let castCount: number | undefined;

    if (a.measure === "enemy-debuff-uptime") {
      uptimePct = bossDurationMs > 0 ? mergedDurationMs(myDebuffs.filter((d) => idSet.has(d.spellId))) / bossDurationMs : 0;
    } else if (a.measure === "self-buff-uptime") {
      uptimePct = bossDurationMs > 0 ? mergedDurationMs(myBuffs.filter((b) => idSet.has(b.spellId))) / bossDurationMs : 0;
    } else {
      castCount = myCasts.filter((c) => idSet.has(c.spellId)).length;
    }

    const rankFlag = computeRankFlag(a, myCasts.filter((c) => idSet.has(c.spellId)).map((c) => c.spellId));

    const row: ClassAbilityResult = {
      key: a.key, name: a.name, measure: a.measure,
      uptimePct, castCount, rankFlag, verified: a.verified ?? false, severity: "ok",
    };
    row.severity = severityFor(row);
    out.push(row);
  }
  return out;
}

/** total ms covered by a set of intervals, overlaps merged (union). */
function mergedDurationMs(intervals: { startTime: number; endTime: number }[]): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a.startTime - b.startTime);
  let total = 0, curStart = sorted[0].startTime, curEnd = sorted[0].endTime;
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.startTime > curEnd) { total += curEnd - curStart; curStart = s.startTime; curEnd = s.endTime; }
    else if (s.endTime > curEnd) curEnd = s.endTime;
  }
  total += curEnd - curStart;
  return total;
}

/** true when the ability is rank-checked, optimal is max, and the majority of
 *  observed casts used a lower-than-max rank. */
function computeRankFlag(a: ClassAbilitySpec, castSpellIds: number[]): boolean {
  if (!a.ranks || a.optimalRank !== "max" || castSpellIds.length === 0) return false;
  const rankById = new Map(a.ranks.map((r) => [r.spellId, r.rank]));
  const maxRank = Math.max(...a.ranks.map((r) => r.rank));
  let lower = 0, total = 0;
  for (const id of castSpellIds) {
    const rank = rankById.get(id);
    if (rank === undefined) continue;
    total++;
    if (rank < maxRank) lower++;
  }
  return total > 0 && lower > total / 2;
}

function severityFor(row: ClassAbilityResult): ClassAbilityResult["severity"] {
  if (row.rankFlag) return "minor";
  if (row.uptimePct !== undefined && row.uptimePct < 0.5) return "moderate";
  return "ok";
}
