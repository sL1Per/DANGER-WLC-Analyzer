import type { ReportData, Role, PlayerHitStats, TrinketUse } from "./types";
import { detectRole, type RoleConfig } from "./roles";
import { activity, type ActivityConfig, type ActivityResult } from "./activity";
import { rpb, type RpbConfig } from "./rpb";

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

// ---------------------------------------------------------------------------
// roleSheet — per-role stat sheet (hit stats, trinkets, avoidable damage/debuffs)
// ---------------------------------------------------------------------------

export interface RoleSheetConfig {
  roles: RoleConfig;
  rpb: RpbConfig;
  /** debuff spell ids whose application count we want to surface per player */
  avoidableDebuffIds: { spellId: number; name: string }[];
}

export interface RoleSheetRow {
  playerId: number;
  playerName: string;
  className: string;
  /** undefined when report.hitStats is absent (pre-feature cache) */
  hitStats?: PlayerHitStats;
  trinketUses: TrinketUse[];
  /** per-ability breakdown of avoidable damage taken (from rpb avoidableAbilityIds) */
  avoidableByAbility: { name: string; amount: number }[];
  /** application counts of each tracked avoidable debuff sourced by this player */
  debuffsApplied: { name: string; count: number }[];
  deaths: number;
  friendlyFire: number;
  damageReflected: number;
  damageToHostilePlayers: number;
  totalAvoidableDamageTaken: number;
}

/**
 * Build per-player role sheet rows for a given role.
 * Returns null when report.playerTotals is undefined (pre-M5a cache) or when
 * rpb() itself returns null (stale cache).
 */
export function roleSheet(
  report: ReportData,
  role: Role,
  cfg: RoleSheetConfig,
): RoleSheetRow[] | null {
  if (report.playerTotals === undefined) return null;

  const result = rpb(report, cfg.rpb);
  if (!result) return null;

  // Exclude Kalecgos (portal mechanic breaks all numbers)
  const fightIds = new Set(
    report.fights.filter((f) => !isKalecgos(f.name)).map((f) => f.id),
  );

  // Index hitStats and trinketUses by playerId for O(1) lookup
  const hitById = new Map(
    (report.hitStats ?? []).map((h) => [h.playerId, h]),
  );
  const trinketsById = new Map<number, TrinketUse[]>();
  for (const t of report.trinketUses ?? []) {
    const arr = trinketsById.get(t.playerId) ?? [];
    arr.push(t);
    trinketsById.set(t.playerId, arr);
  }

  const meta = report.abilityMeta ?? {};
  const debuffSpec = new Map(
    cfg.avoidableDebuffIds.map((d) => [d.spellId, d.name]),
  );

  return result.rows
    .filter((r) => r.role === role)
    .map((r) => {
      // Avoidable damage broken out by ability (names via abilityMeta)
      const dmgByAbility = new Map<number, number>();
      for (const d of report.damageTakenEvents ?? []) {
        if (d.targetPlayerId !== r.playerId || !fightIds.has(d.fightId)) continue;
        if (!cfg.rpb.avoidableAbilityIds.has(d.abilityId)) continue;
        dmgByAbility.set(d.abilityId, (dmgByAbility.get(d.abilityId) ?? 0) + d.amount);
      }

      // Tracked avoidable debuff APPLICATIONS this player sourced.
      // enemyDebuffs are stored as merged intervals (one per application window),
      // so counting intervals = counting applications — matches the sheet's count.
      const debuffCounts = new Map<number, number>();
      for (const e of report.enemyDebuffs ?? []) {
        if (e.sourceId !== r.playerId || !fightIds.has(e.fightId)) continue;
        if (!debuffSpec.has(e.spellId)) continue;
        debuffCounts.set(e.spellId, (debuffCounts.get(e.spellId) ?? 0) + 1);
      }

      return {
        playerId: r.playerId,
        playerName: r.playerName,
        className: r.className,
        hitStats: hitById.get(r.playerId),
        trinketUses: trinketsById.get(r.playerId) ?? [],
        avoidableByAbility: [...dmgByAbility]
          .map(([id, amount]) => ({
            name: meta[String(id)]?.name ?? `#${id}`,
            amount,
          }))
          .sort((a, b) => b.amount - a.amount),
        debuffsApplied: [...debuffCounts].map(([id, count]) => ({
          name: debuffSpec.get(id)!,
          count,
        })),
        deaths: r.deaths,
        friendlyFire: r.friendlyFire,
        damageReflected: r.damageReflected,
        damageToHostilePlayers: r.damageToHostilePlayers,
        totalAvoidableDamageTaken: r.totalAvoidableDamageTaken,
      };
    });
}
