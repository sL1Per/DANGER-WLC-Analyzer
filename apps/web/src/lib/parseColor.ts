/** WarcraftLogs parse-percentile color bands. */
export type ParseBand =
  | "common" | "uncommon" | "rare" | "epic" | "legendary" | "astounding" | "artifact";

/** Map a 0–100 parse percentile to its WCL color band. */
export function parseBand(pct: number): ParseBand {
  if (pct >= 100) return "artifact";
  if (pct >= 99) return "astounding";
  if (pct >= 95) return "legendary";
  if (pct >= 75) return "epic";
  if (pct >= 50) return "rare";
  if (pct >= 25) return "uncommon";
  return "common";
}

/** CSS class for a parse cell, e.g. "parse-legendary". */
export function parseClass(pct: number): string {
  return `parse-${parseBand(pct)}`;
}
