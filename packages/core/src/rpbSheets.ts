import type { ReportData, Role } from "./types";
import { detectRole, type RoleConfig } from "./roles";
import { activity, type ActivityConfig, type ActivityResult } from "./activity";

/** Structural copy of @wcl/data's CatalogAbility (core stays pure — catalog injected). */
export type CastCategory = "single" | "aoe" | "cooldown" | "heal";

export interface CatalogAbilitySpec {
  className: string;
  key: string;
  name: string;
  category: CastCategory;
  spellIds: number[];
  ranks?: { spellId: number; rank: number }[];
  uptimeAnnotated?: boolean;
}

export interface RoleCastsConfig {
  catalog: CatalogAbilitySpec[];
  activity: ActivityConfig;
  roles: RoleConfig;
  cooldownKeys: string[];
}

export interface CastCell {
  key: string;
  name: string;
  category: CastCategory;
  castCount: number;
  uptimePct?: number;
  rankFlag: boolean;
}

export interface ClassCastBlock {
  className: string;
  players: { playerId: number; playerName: string }[];
  abilities: { key: string; name: string; category: CastCategory }[];
  /** key: `${playerId}:${abilityKey}` */
  counts: Map<string, CastCell>;
  activity: Map<number, ActivityResult | null>;
}

/** Kalecgos breaks RPB numbers (portal mechanic) — excluded from all aggregation. */
const isKalecgos = (name: string) => name.toLowerCase().includes("kalecgos");

/**
 * For a given role, group its players by class and, per class, count each
 * catalog ability's casts per player, plus per-player activity.
 * Returns null when report.playerCasts is undefined (stale cache).
 */
export function roleCasts(
  report: ReportData,
  role: Role,
  cfg: RoleCastsConfig,
): ClassCastBlock[] | null {
  if (report.playerCasts === undefined) return null;

  const scopedFights = report.fights.filter((f) => !isKalecgos(f.name));
  const fightIds = new Set(scopedFights.map((f) => f.id));

  const members = report.players.filter(
    (p) => detectRole(p.id, report, cfg.roles) === role,
  );

  const byClass = new Map<string, typeof members>();
  for (const p of members) {
    const arr = byClass.get(p.class) ?? [];
    arr.push(p);
    byClass.set(p.class, arr);
  }

  const blocks: ClassCastBlock[] = [];
  for (const [className, players] of byClass) {
    const abilities = cfg.catalog.filter((a) => a.className === className);
    const counts = new Map<string, CastCell>();
    const act = new Map<number, ActivityResult | null>();

    for (const p of players) {
      const myCasts = report.playerCasts.filter(
        (c) => c.playerId === p.id && fightIds.has(c.fightId),
      );

      for (const a of abilities) {
        const ids = new Set(a.spellIds);
        const castCount = myCasts.filter((c) => ids.has(c.spellId)).length;
        counts.set(`${p.id}:${a.key}`, {
          key: a.key,
          name: a.name,
          category: a.category,
          castCount,
          rankFlag: false,
        });
      }

      act.set(p.id, activity(p.id, report, cfg.activity, fightIds));
    }

    blocks.push({
      className,
      players: players.map((p) => ({ playerId: p.id, playerName: p.name })),
      abilities: abilities.map((a) => ({ key: a.key, name: a.name, category: a.category })),
      counts,
      activity: act,
    });
  }

  return blocks;
}
