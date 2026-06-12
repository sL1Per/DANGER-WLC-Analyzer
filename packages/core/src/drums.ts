import type { DrumApplication, DrumCast, ReportData } from "./types";

export interface DrumConfig {
  // reference data, injected so core stays dependency-free (@wcl/data wires these)
  drums: {
    castId: number;
    buffId: number;
    kind: "battle" | "war" | "restoration" | "speed";
    /** false = lesser (pre-Greater) version, flagged by the original sheet */
    greater: boolean;
    name: string;
  }[];
}

export interface DrumKindStats {
  casts: number;
  /** applications matched to those casts / casts; 0 when casts = 0 */
  avgBuffs: number;
}

/** One player's row of the CLA "drums" sheet. */
export interface DrumRow {
  playerId: number;
  playerName: string;
  battle: DrumKindStats;
  war: DrumKindStats;
  restoration: DrumKindStats;
  /** casts that applied 0 buffs within the matching window ("on Tinnitus") */
  wasted: number;
  /** ALL drum casts, incl. speed drums (which get no dedicated kind column) */
  total: number;
  /** total matched applications / total casts; raw number — rounding is the view's job */
  avgBuffsPerDrum: number;
  /** total successful applications (== round(casts × ⌀), verified on the original's sample data) */
  weightedScore: number;
  /** casts of non-greater drum versions */
  lesserCasts: number;
}

/**
 * An application belongs to a cast when it lands within this many ms after it.
 * Our heuristic: WCL logs the buff applications within a few hundred ms of the
 * cast event; 1500 ms gives slack for event-ordering jitter while staying well
 * under the Tinnitus cooldown, so consecutive casts can't share applications.
 */
const APPLICATION_WINDOW_MS = 1500;

/**
 * CLA "drums": Drums of Battle/War/Restoration effectiveness per player.
 * All fights count (drums are used on trash too). Returns null when the
 * report predates M3 (no drum data cached) so the UI can show a refresh
 * notice instead of all-zero rows.
 */
export function drums(report: ReportData, cfg: DrumConfig): { rows: DrumRow[] } | null {
  if (report.drumCasts === undefined) return null;

  const drumByCastId = new Map(cfg.drums.map((d) => [d.castId, d]));
  const applications = report.drumApplications ?? [];

  const rows: DrumRow[] = [];
  for (const player of report.players) {
    const casts = report.drumCasts
      .filter((c) => c.sourceId === player.id && drumByCastId.has(c.spellId))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (casts.length === 0) continue;

    const buffsPerCast = matchApplications(casts, applications, drumByCastId);

    const kindStats = (kind: "battle" | "war" | "restoration"): DrumKindStats => {
      let kindCasts = 0;
      let kindBuffs = 0;
      casts.forEach((cast, i) => {
        if (drumByCastId.get(cast.spellId)!.kind !== kind) return;
        kindCasts += 1;
        kindBuffs += buffsPerCast[i]!;
      });
      return { casts: kindCasts, avgBuffs: kindCasts === 0 ? 0 : kindBuffs / kindCasts };
    };

    const totalBuffs = buffsPerCast.reduce((sum, n) => sum + n, 0);
    rows.push({
      playerId: player.id,
      playerName: player.name,
      battle: kindStats("battle"),
      war: kindStats("war"),
      restoration: kindStats("restoration"),
      wasted: buffsPerCast.filter((n) => n === 0).length,
      total: casts.length,
      avgBuffsPerDrum: totalBuffs / casts.length,
      // the original sheet's "weighted score" reverse-engineers to exactly the
      // number of successful buff applications (round(casts × ⌀) on sample data)
      weightedScore: totalBuffs,
      lesserCasts: casts.filter((c) => !drumByCastId.get(c.spellId)!.greater).length,
    });
  }
  rows.sort((a, b) => a.playerName.localeCompare(b.playerName));
  return { rows };
}

/**
 * Greedily match applications to casts: processing casts in timestamp order,
 * an application counts for the EARLIEST cast with the same sourceId whose
 * buffId equals the application's spellId and whose window
 * [cast.timestamp, cast.timestamp + APPLICATION_WINDOW_MS] contains it.
 * Each application is consumed by at most one cast.
 * Returns the matched-application count per cast (parallel to `casts`).
 */
function matchApplications(
  casts: DrumCast[],
  applications: DrumApplication[],
  drumByCastId: Map<number, DrumConfig["drums"][number]>,
): number[] {
  const consumed = new Set<DrumApplication>();
  return casts.map((cast) => {
    const buffId = drumByCastId.get(cast.spellId)!.buffId;
    let count = 0;
    for (const app of applications) {
      if (consumed.has(app)) continue;
      if (app.fightId !== cast.fightId) continue; // a cast can't buff into the next pull
      if (app.sourceId !== cast.sourceId || app.spellId !== buffId) continue;
      if (app.timestamp < cast.timestamp || app.timestamp > cast.timestamp + APPLICATION_WINDOW_MS) continue;
      consumed.add(app);
      count += 1;
    }
    return count;
  });
}
