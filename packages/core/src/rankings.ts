import type { ReportRanking } from "./types";

export type RankingsRole = "dps" | "healers" | "tanks";

export interface RankingsGridPlayer {
  name: string;
  class: string;
  spec?: string;
  /** parse per ranked boss, keyed by fightID (sparse — absent boss = not played) */
  perBoss: Record<number, { rankPercent: number; bracketPercent: number }>;
  /** mean rankPercent across bosses played, used for sorting */
  overall: number;
}

export interface RankingsSection {
  role: RankingsRole;
  players: RankingsGridPlayer[];
}

export interface RankingsBoss {
  fightID: number;
  encounterId: number;
  name: string;
}

export interface RankingsGrid {
  bosses: RankingsBoss[];
  sections: RankingsSection[];
}

const ROLE_ORDER: RankingsRole[] = ["dps", "healers", "tanks"];

/** Pivot WCL per-boss rankings into a player × boss grid grouped by WCL role.
 *  Returns null when there is no usable rankings data. */
export function buildRankingsGrid(rankings: ReportRanking[] | undefined): RankingsGrid | null {
  if (!rankings || rankings.length === 0) return null;

  const bosses: RankingsBoss[] = rankings.map((r) => ({
    fightID: r.fightID,
    encounterId: r.encounterId,
    name: r.encounterName,
  }));

  const sections: RankingsSection[] = [];
  for (const role of ROLE_ORDER) {
    const byName = new Map<string, RankingsGridPlayer>();
    for (const r of rankings) {
      for (const ch of r[role]) {
        let p = byName.get(ch.name);
        if (!p) {
          p = { name: ch.name, class: ch.class, spec: ch.spec, perBoss: {}, overall: 0 };
          byName.set(ch.name, p);
        }
        p.perBoss[r.fightID] = { rankPercent: ch.rankPercent, bracketPercent: ch.bracketPercent };
      }
    }
    const players = [...byName.values()];
    for (const p of players) {
      const vals = Object.values(p.perBoss).map((v) => v.rankPercent);
      p.overall = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    players.sort((a, b) => b.overall - a.overall);
    if (players.length > 0) sections.push({ role, players });
  }

  if (sections.length === 0) return null;
  return { bosses, sections };
}
