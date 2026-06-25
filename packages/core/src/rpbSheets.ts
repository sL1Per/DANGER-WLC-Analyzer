import type { ReportData, Role, PlayerHitStats, TrinketUse, PlayerFightHits } from "./types";
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
  /** on-use trinket/racial spell ids → name; counted from playerCasts (per-fight) */
  trinketRacials: { spellId: number; name: string }[];
}

/** Sum a player's per-fight raw hit counts into the normalized {count, pct} shape.
 *  Percentages are recomputed from the summed counts, so any fight subset is exact. */
function aggregateHits(perFight: PlayerFightHits[]): PlayerHitStats {
  const o = { hit: 0, crit: 0, dodge: 0, miss: 0, parry: 0, resist: 0 };
  const t = { hit: 0, crit: 0, crushing: 0, blocked: 0, dodge: 0, immune: 0, miss: 0, parry: 0 };
  const h = { hit: 0, crit: 0 };
  let extraWindfury = 0;
  let battleSquawk = 0;
  for (const f of perFight) {
    o.hit += f.outgoing.hit; o.crit += f.outgoing.crit; o.dodge += f.outgoing.dodge;
    o.miss += f.outgoing.miss; o.parry += f.outgoing.parry; o.resist += f.outgoing.resist;
    t.hit += f.incomingMelee.hit; t.crit += f.incomingMelee.crit; t.crushing += f.incomingMelee.crushing;
    t.blocked += f.incomingMelee.blocked; t.dodge += f.incomingMelee.dodge; t.immune += f.incomingMelee.immune;
    t.miss += f.incomingMelee.miss; t.parry += f.incomingMelee.parry;
    h.hit += f.heal.hit; h.crit += f.heal.crit;
    extraWindfury += f.extraWindfury;
    battleSquawk += f.battleSquawk;
  }
  const od = o.hit + o.crit + o.dodge + o.miss + o.parry + o.resist;
  const td = t.hit + t.crit + t.crushing + t.blocked + t.dodge + t.immune + t.miss + t.parry;
  const hd = h.hit + h.crit;
  const share = (count: number, denom: number) => ({ count, pct: denom > 0 ? count / denom : 0 });
  return {
    playerId: perFight[0]!.playerId,
    outgoing: {
      crit: share(o.crit, od), dodge: share(o.dodge, od), miss: share(o.miss, od),
      parry: share(o.parry, od), resist: share(o.resist, od),
    },
    incomingMelee: {
      crit: share(t.crit, td), crushing: share(t.crushing, td), blocked: share(t.blocked, td),
      dodge: share(t.dodge, td), immune: share(t.immune, td), miss: share(t.miss, td), parry: share(t.parry, td),
    },
    critHeals: share(h.crit, hd),
    extraWindfury,
    battleSquawk,
  };
}

export interface RoleSheetRow {
  playerId: number;
  playerName: string;
  className: string;
  /** aggregated hit-type stats over the scoped fights; undefined when no
   *  per-fight hit data exists for this player (pre-feature cache) */
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

  // Group per-fight raw hit counts by player, restricted to the scoped fights —
  // this is what makes the sheet correct on a single boss pull.
  const hitsByPlayer = new Map<number, PlayerFightHits[]>();
  for (const h of report.hitStatsByFight ?? []) {
    if (!fightIds.has(h.fightId)) continue;
    const arr = hitsByPlayer.get(h.playerId) ?? [];
    arr.push(h);
    hitsByPlayer.set(h.playerId, arr);
  }
  const trinketSpec = new Map(cfg.trinketRacials.map((t) => [t.spellId, t.name]));

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

      // On-use trinket/racial activations from this player's casts (per-fight scoped).
      const trinketCounts = new Map<string, number>();
      for (const c of report.playerCasts ?? []) {
        if (c.playerId !== r.playerId || !fightIds.has(c.fightId)) continue;
        const name = trinketSpec.get(c.spellId);
        if (name) trinketCounts.set(name, (trinketCounts.get(name) ?? 0) + 1);
      }

      const myHits = hitsByPlayer.get(r.playerId);

      return {
        playerId: r.playerId,
        playerName: r.playerName,
        className: r.className,
        hitStats: myHits && myHits.length > 0 ? aggregateHits(myHits) : undefined,
        trinketUses: [...trinketCounts].map(([name, count]) => ({ playerId: r.playerId, name, count })),
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
