import type { Fight, FightFilter } from "./types";

/** Returns an error message if the filter is invalid, else null. */
export function validateFilter(filter: FightFilter): string | null {
  if (filter.fightId !== undefined && filter.range !== undefined) {
    return "You can only specify a fight id OR a start and end timestamp.";
  }
  return null;
}

export function filterFights(fights: Fight[], filter: FightFilter): Fight[] {
  let result = fights.filter((f) => {
    if (filter.mode === "bosses" && !f.isBoss) return false;
    if (filter.mode === "trash" && f.isBoss) return false;
    if (filter.excludeWipes && f.isBoss && f.kill === false) return false;
    return true;
  });
  if (filter.range) {
    result = result.filter((f) => f.endTime > filter.range!.start && f.startTime < filter.range!.end);
  }
  if (filter.fightId === "last") {
    result = result.length > 0 ? [result[result.length - 1]!] : [];
  } else if (typeof filter.fightId === "number") {
    result = result.filter((f) => f.id === filter.fightId);
  }
  return result;
}
