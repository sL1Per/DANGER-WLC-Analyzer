import type { RpbSeverity } from "@wcl/core";

/** Heatmap buckets. `neutral` = no value judgment (magnitude metrics, empties). */
export type Heat = "good" | "watch" | "bad" | "neutral";

// Reuse the shared severity color classes (green / yellow / red); `sev-neutral`
// is a transparent, non-alarming cell (defined in index.css).
const HEAT_CLASS: Record<Heat, string> = {
  good: "sev-minor",
  watch: "sev-moderate",
  bad: "sev-major",
  neutral: "sev-neutral",
};

export function heatClass(h: Heat): string {
  return HEAT_CLASS[h];
}

export function deathsHeat(n: number): Heat {
  return n > 0 ? "bad" : "good";
}

export function friendlyFireHeat(n: number): Heat {
  return n > 0 ? "watch" : "good";
}

export function uptimeHeat(pct: number): Heat {
  if (pct >= 0.9) return "good";
  if (pct >= 0.5) return "watch";
  return "bad";
}

export function activeHeat(pct: number): Heat {
  if (pct >= 0.85) return "good";
  if (pct >= 0.6) return "watch";
  return "bad";
}

/** Reuse a class-ability row's already-computed core severity. */
export function severityHeat(s: RpbSeverity): Heat {
  switch (s) {
    case "major":
      return "bad";
    case "moderate":
      return "watch";
    default:
      return "good"; // "minor" | "ok"
  }
}
