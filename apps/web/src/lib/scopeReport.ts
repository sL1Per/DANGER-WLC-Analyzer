import type { ReportData } from "@wcl/core";

/**
 * A report projected to a single fight. The per-pull views ("By Boss Fight")
 * pass this to the report-wide analyses (`rpb`, `consumables`, `rpbConsumables`,
 * `drums`) which derive their fight set from `report.fights` — so filtering that
 * array re-scopes them to one pull. Every other field (event arrays, playerTotals
 * used for role detection, rankings, gear, itemMeta) is preserved unchanged.
 */
export function scopeReportToFight(report: ReportData, fightId: number): ReportData {
  return { ...report, fights: report.fights.filter((f) => f.id === fightId) };
}
