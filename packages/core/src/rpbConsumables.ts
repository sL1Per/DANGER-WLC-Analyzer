import type { ReportData } from "./types";

/** Structural copy of @wcl/data's RpbConsumable (core stays pure — data injected). */
export interface RpbConsumableSpec {
  key: string;        // stable slug
  name: string;       // display label
  spellIds: number[]; // all ids that count toward this row (grouped rows sum)
  verified?: boolean; // true once confirmed against TBC 2.5.4
}

export interface RpbConsumableRow {
  playerId: number;
  playerName: string;
  className: string;
  /** consumable key → number of casts on boss fights */
  counts: Record<string, number>;
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

  const bossFightIds = new Set(
    report.fights.filter((f) => f.isBoss && !isKalecgos(f.name)).map((f) => f.id),
  );
  const bossCasts = report.playerCasts.filter((c) => bossFightIds.has(c.fightId));

  const rows: RpbConsumableRow[] = report.players.map((player) => {
    const myCasts = bossCasts.filter((c) => c.playerId === player.id);
    const counts: Record<string, number> = {};
    for (const s of spec) {
      const idSet = new Set(s.spellIds);
      counts[s.key] = myCasts.filter((c) => idSet.has(c.spellId)).length;
    }
    return { playerId: player.id, playerName: player.name, className: player.class, counts };
  });

  return { rows };
}
