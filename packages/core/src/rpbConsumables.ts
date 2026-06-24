import type { ReportData } from "./types";

/** Structural copy of @wcl/data's RpbConsumable (core stays pure — data injected). */
export interface RpbConsumableSpec {
  key: string;        // stable slug
  name: string;       // display label
  spellIds: number[]; // all ids that count toward this row (grouped rows sum)
  verified?: boolean; // true once confirmed against TBC 2.5.4
  /** When set, `spellIds` are buff (aura) ids resolved against report.buffs rather
   *  than cast ids: the row reports a buff *uptime* fraction (0–1) alongside an
   *  application count. Used for elixirs that have no in-combat cast event — e.g.
   *  Gift of Arthas, which the original RPB shows as "count (uptime%)". */
  buffUptime?: boolean;
}

export interface RpbConsumableRow {
  playerId: number;
  playerName: string;
  className: string;
  /** consumable key → number of casts (or buff applications) on the scoped fights */
  counts: Record<string, number>;
  /** consumable key → buff uptime fraction 0–1; only set for buffUptime rows */
  uptimes: Record<string, number>;
}

/** Kalecgos breaks RPB numbers (portal mechanic) — excluded from all aggregation. */
const isKalecgos = (name: string) => name.toLowerCase().includes("kalecgos");

/** Per-player consumable use counts on boss fights (Kalecgos excluded). Pure: the
 *  curated consumable specs are injected. Returns null when the report was cached
 *  before player casts were fetched (UI then shows the refresh-from-WCL notice). */
export function rpbConsumables(
  report: ReportData,
  spec: RpbConsumableSpec[],
): { rows: RpbConsumableRow[] } | null {
  if (report.playerCasts === undefined) return null;

  // Fight set comes from report.fights (the caller scopes it — boss card or
  // trash card). Kalecgos is always dropped (portal mechanic breaks numbers).
  const fights = report.fights.filter((f) => !isKalecgos(f.name));
  const fightIds = new Set(fights.map((f) => f.id));
  // Denominator for buff uptime: total scoped fight time (buff intervals are
  // already clamped to fight windows upstream, so their durations sum cleanly).
  const totalDuration = fights.reduce((s, f) => s + Math.max(0, f.endTime - f.startTime), 0);
  const scopedCasts = report.playerCasts.filter((c) => fightIds.has(c.fightId));
  const scopedBuffs = (report.buffs ?? []).filter((b) => fightIds.has(b.fightId));

  const rows: RpbConsumableRow[] = report.players.map((player) => {
    const myCasts = scopedCasts.filter((c) => c.playerId === player.id);
    const myBuffs = scopedBuffs.filter((b) => b.targetId === player.id);
    const counts: Record<string, number> = {};
    const uptimes: Record<string, number> = {};
    for (const s of spec) {
      const idSet = new Set(s.spellIds);
      if (s.buffUptime) {
        const intervals = myBuffs.filter((b) => idSet.has(b.spellId));
        counts[s.key] = intervals.length;
        const active = intervals.reduce((sum, b) => sum + Math.max(0, b.endTime - b.startTime), 0);
        uptimes[s.key] = totalDuration > 0 ? Math.min(1, active / totalDuration) : 0;
      } else {
        counts[s.key] = myCasts.filter((c) => idSet.has(c.spellId)).length;
      }
    }
    return { playerId: player.id, playerName: player.name, className: player.class, counts, uptimes };
  });

  return { rows };
}
