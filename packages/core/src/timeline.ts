import type { ReportData } from "./types";
import type { IssueSeverity } from "./gearIssues";

/** idle gaps above this are flagged red, half of it yellow. */
const LONG_IDLE_MS = 120_000;

export interface TimelinePull {
  name: string; isBoss: boolean;
  idle: number | null; start: number; duration: number; end: number;
  idleSeverity: IssueSeverity;
}
export interface TimelineSide { title: string; pulls: TimelinePull[]; totalIdle: number; }
export interface TimelineBossDiff { boss: string; cumulativeDiff: number; severity: IssueSeverity; }
export interface TimelineComparison { a: TimelineSide; b: TimelineSide; bossDiffs: TimelineBossDiff[]; }

function idleSeverity(idle: number | null): IssueSeverity {
  if (idle === null || idle <= LONG_IDLE_MS / 2) return "minor";
  return idle > LONG_IDLE_MS ? "major" : "moderate";
}

function buildSide(report: ReportData): TimelineSide {
  const fights = [...report.fights].sort((a, b) => a.startTime - b.startTime);
  let prevEnd: number | null = null;
  let totalIdle = 0;
  const pulls = fights.map((f) => {
    const idle = prevEnd === null ? null : f.startTime - prevEnd;
    if (idle !== null && idle > 0) totalIdle += idle;
    prevEnd = f.endTime;
    return {
      name: f.name, isBoss: f.isBoss, idle,
      start: f.startTime, duration: f.endTime - f.startTime, end: f.endTime,
      idleSeverity: idleSeverity(idle),
    };
  });
  return { title: report.title, pulls, totalIdle };
}

/** elapsed time (relative to report start) at which this boss was completed. */
function bossReachedAt(report: ReportData, boss: string): number | null {
  const fs = report.fights.filter((f) => f.isBoss && f.name === boss);
  if (fs.length === 0) return null;
  const done = fs.find((f) => f.kill === true) ?? fs[fs.length - 1]!;
  return done.endTime;
}

/**
 * CLA `fightsSW`: compare two logs pull by pull. Columns are independent (logs
 * may differ in pull order/count); only boss rows are cross-matched by identity
 * for the cumulative time difference (positive = log A reached it later/slower).
 */
export function compareTimelines(a: ReportData, b: ReportData): TimelineComparison {
  const sideA = buildSide(a);
  const sideB = buildSide(b);

  const bossNames = [...new Set(a.fights.filter((f) => f.isBoss).map((f) => f.name))]
    .filter((name) => b.fights.some((f) => f.isBoss && f.name === name));
  const bossDiffs: TimelineBossDiff[] = bossNames.map((boss) => {
    const ta = bossReachedAt(a, boss)!;
    const tb = bossReachedAt(b, boss)!;
    const diff = ta - tb;
    return { boss, cumulativeDiff: diff, severity: diff <= 0 ? "minor" : "major" };
  });

  return { a: sideA, b: sideB, bossDiffs };
}
