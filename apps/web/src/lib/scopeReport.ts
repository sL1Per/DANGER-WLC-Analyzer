import type { ReportData } from "@wcl/core";

/** Sentinel `fightId` for the "ALL" card: all boss fights combined. */
export const ALL_FIGHTS = -1;

/** Sentinel `fightId` for the "TRASH" card: all non-boss (trash) fights combined.
 *  Only event-based analyses (consumable cast counts, drums, deaths, activity,
 *  avoidable damage) have data here — combatantInfo (gear, buff-uptime, shadow
 *  resistance, rankings) is recorded only at boss pull, so those tabs are hidden. */
export const ALL_TRASH = -2;

/**
 * A report projected to a single fight. The per-pull views ("By Boss Fight")
 * pass this to the report-wide analyses (`rpb`, `consumables`, `rpbConsumables`,
 * `drums`) which derive their fight set from `report.fights` — so filtering that
 * array re-scopes them to one pull. Every other field (event arrays, playerTotals
 * used for role detection, rankings, gear, itemMeta) is preserved unchanged.
 *
 * Passing {@link ALL_FIGHTS} scopes to every boss fight at once — the combined
 * view behind the ALL card; {@link ALL_TRASH} scopes to every trash fight — the
 * TRASH card.
 */
export function scopeReportToFight(report: ReportData, fightId: number): ReportData {
  if (fightId === ALL_FIGHTS) {
    return { ...report, fights: report.fights.filter((f) => f.isBoss) };
  }
  if (fightId === ALL_TRASH) {
    return { ...report, fights: report.fights.filter((f) => !f.isBoss) };
  }
  return { ...report, fights: report.fights.filter((f) => f.id === fightId) };
}
