import type { ReportData, PlayerCast, PlayerDamageEvent } from "./types";

export interface ActivityHasteBuff { spellId: number; pct: number; name: string; }
export interface ActivityConfig {
  /** spell id -> base cast time in deci-seconds */
  castTimes: Record<string, number>;
  hasteBuffs: ActivityHasteBuff[];
  /** damage within this many ms after a cast is attributed to that cast */
  aoeWindowMs: number;
}

export interface ActivityResult {
  secondsActiveST: number;
  secondsActiveAoe: number;
  relativeActiveST: number;
  relativeActiveAoe: number;
  relativeActiveTotal: number;
  avgHitsPerAoeCast: number;
  /** seconds removed from raw active time because casts were haste-accelerated */
  secondsSubtractedHaste: number;
}

/**
 * Per-player activity over boss fights. Returns null when no cast data is
 * present (report cached before M5a) so the view can show a refresh notice.
 */
export function activity(
  playerId: number,
  report: ReportData,
  cfg: ActivityConfig,
  /** boss-fight ids to include; defaults to all boss fights. rpb() passes a
   *  Kalecgos-excluded set so activity matches the rest of the breakdown. */
  bossFightIds?: Set<number>,
): ActivityResult | null {
  if (report.playerCasts === undefined) return null;

  const fightIds = bossFightIds ?? new Set(report.fights.filter((f) => f.isBoss).map((f) => f.id));
  const bossDurationSec = report.fights
    .filter((f) => fightIds.has(f.id))
    .reduce((sum, f) => sum + (f.endTime - f.startTime) / 1000, 0);

  const casts = report.playerCasts.filter((c) => c.playerId === playerId && fightIds.has(c.fightId));
  const damage = (report.playerDamage ?? []).filter((d) => d.sourceId === playerId && fightIds.has(d.fightId));

  let stRawSec = 0, aoeRawSec = 0, stCorrSec = 0, aoeCorrSec = 0;
  let aoeCasts = 0, aoeHits = 0;

  for (const cast of casts) {
    const deci = cfg.castTimes[String(cast.spellId)] ?? 0;
    if (deci <= 0) continue; // instant -> no active time
    const baseSec = deci / 10;
    const hits = hitsFor(cast, damage, cfg.aoeWindowMs);
    const isAoe = hits > 1;
    const corrSec = baseSec / (1 + hastePctAt(cast, playerId, report, cfg));
    if (isAoe) { aoeRawSec += baseSec; aoeCorrSec += corrSec; aoeCasts += 1; aoeHits += hits; }
    else { stRawSec += baseSec; stCorrSec += corrSec; }
  }

  const totalCorr = stCorrSec + aoeCorrSec;
  const rel = (sec: number) => (bossDurationSec > 0 ? sec / bossDurationSec : 0);
  return {
    secondsActiveST: round2(stRawSec),
    secondsActiveAoe: round2(aoeRawSec),
    relativeActiveST: rel(stCorrSec),
    relativeActiveAoe: rel(aoeCorrSec),
    relativeActiveTotal: rel(totalCorr),
    avgHitsPerAoeCast: aoeCasts > 0 ? aoeHits / aoeCasts : 0,
    secondsSubtractedHaste: round2(stRawSec + aoeRawSec - totalCorr),
  };
}

/** distinct targets the cast's ability damaged within the window after it */
function hitsFor(cast: PlayerCast, damage: PlayerDamageEvent[], windowMs: number): number {
  const targets = new Set<number>();
  for (const d of damage) {
    if (d.fightId !== cast.fightId || d.abilityId !== cast.spellId) continue;
    if (d.timestamp < cast.timestamp || d.timestamp > cast.timestamp + windowMs) continue;
    targets.add(d.targetId);
  }
  return targets.size;
}

/** largest haste pct among buffs active on the player at the cast timestamp */
function hastePctAt(cast: PlayerCast, playerId: number, report: ReportData, cfg: ActivityConfig): number {
  let pct = 0;
  for (const buff of report.buffs ?? []) {
    if (buff.targetId !== playerId || buff.fightId !== cast.fightId) continue;
    if (cast.timestamp < buff.startTime || cast.timestamp > buff.endTime) continue;
    const h = cfg.hasteBuffs.find((b) => b.spellId === buff.spellId);
    if (h && h.pct > pct) pct = h.pct;
  }
  return pct;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
