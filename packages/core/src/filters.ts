import type { Fight, FightFilter } from "./types";

/** Returns an error message if the filter is invalid, else null. */
export function validateFilter(filter: FightFilter): string | null {
  if (filter.fightId !== undefined && filter.range !== undefined) {
    return "You can only specify a fight id OR a start and end timestamp.";
  }
  return null;
}

/**
 * Precondition: validateFilter(filter) === null — callers validate before calling;
 * this function applies fightId/range as given without re-checking exclusivity.
 */
export function filterFights(fights: Fight[], filter: FightFilter): Fight[] {
  let result = fights.filter((f) => {
    if (filter.mode === "bosses" && !f.isBoss) return false;
    if (filter.mode === "trash" && f.isBoss) return false;
    if (filter.excludeWipes && f.isBoss && f.kill === false) return false;
    return true;
  });
  if (filter.range) {
    const { start, end } = filter.range;
    result = result.filter((f) => f.endTime > start && f.startTime < end);
  }
  if (filter.fightId === "last") {
    result = result.length > 0 ? [result[result.length - 1]!] : [];
  } else if (typeof filter.fightId === "number") {
    result = result.filter((f) => f.id === filter.fightId);
  }
  return result;
}
