import type { ConsumableRow, RpbRow } from "@wcl/core";
import type { Heat } from "./heatmap";

export type ConsumablesStatus = "full" | "partial" | "missing";

const HIGH = 0.9; // uptime fraction considered "kept"

/**
 * Consumable discipline rollup from the buff-consumables analysis. A discipline
 * counts as kept at >=90% boss-fight uptime. Weapon enhancement is skipped when
 * there is no gear snapshot to judge it (null). "Full" = every applicable
 * discipline kept; "missing" = none kept and nothing consumed; else "partial".
 */
export function consumablesStatus(row: ConsumableRow | undefined): ConsumablesStatus {
  if (!row) return "missing";
  const disciplines: number[] = [row.elixirOrFlask, row.food];
  if (row.weaponEnhancement !== null) disciplines.push(row.weaponEnhancement);
  const kept = disciplines.filter((d) => d >= HIGH).length;
  if (kept === disciplines.length) return "full";
  if (kept === 0 && row.totalAverage === 0) return "missing";
  return "partial";
}

export function statusHeat(s: ConsumablesStatus): Heat {
  return s === "full" ? "good" : s === "partial" ? "watch" : "bad";
}

export type Verdict = "exemplary" | "solid" | "attention" | "concern";

/** One-line player verdict from the RPB row severity plus death/gear-flag counts. */
export function verdict(
  row: RpbRow,
  gearFlags: number,
): { key: Verdict; label: string; heat: Heat; note: string } {
  if (row.deaths > 0 || row.severity === "major") {
    return { key: "concern", label: "Major concerns", heat: "bad",
      note: row.deaths > 0 ? `Died ${row.deaths}× on boss fights.` : "Tracked issues need attention." };
  }
  if (row.severity === "moderate" || gearFlags > 0) {
    return { key: "attention", label: "Needs attention", heat: "watch",
      note: gearFlags > 0 ? `${gearFlags} gear flag${gearFlags === 1 ? "" : "s"} to review.` : "Some metrics below par." };
  }
  if (row.severity === "minor") {
    return { key: "solid", label: "Solid", heat: "good", note: "Minor things only — solid night." };
  }
  return { key: "exemplary", label: "Exemplary", heat: "good", note: "No tracked issues. Clean log." };
}
