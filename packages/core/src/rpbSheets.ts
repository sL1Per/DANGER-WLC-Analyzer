import type { ReportData, Role, PlayerHitStats, TrinketUse, PlayerFightHits } from "./types";
import { detectRole, type RoleConfig } from "./roles";
import { activity, type ActivityConfig, type ActivityResult } from "./activity";
import { rpb, type RpbConfig } from "./rpb";
import { mergedDurationMs } from "./classMetrics";

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

/** Strip a trailing "(rank N)" / "(ranks N-M)" so rank variants collapse to one
 *  ability — WCL reports every rank of a spell under the same base name. Form
 *  parentheticals ("(Feral)", "(Bear)") are kept (they are distinct WCL names). */
function rankStrip(name: string): string {
  return name.replace(/\s*\((?:rank|ranks)\b[^)]*\)\s*$/i, "").trim();
}

/** Strip ALL parentheticals — used as a loose fallback so a catalog name carrying
 *  an annotation WCL doesn't use ("Auto Shot (Expose Weakness)", "Shoot (wand)")
 *  still matches the bare WCL name ("Auto Shot", "Shoot"). */
function fullStrip(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

/**
 * For a given role, group its players by class and, per class, count each
 * curated ability's casts per player, plus per-player activity.
 *
 * Casts are matched to abilities by WCL's own ability NAME (resolved from
 * report.abilityMeta), not by hand-curated spell ids — so unverified/incorrect
 * catalog ids don't affect the counts. The catalog supplies the curated row list
 * (which abilities to show) and their category; rank variants are collapsed to a
 * single row per base name. Returns null when report.playerCasts is undefined.
 */
export function roleCasts(
  report: ReportData,
  role: Role,
  cfg: RoleCastsConfig,
): ClassCastBlock[] | null {
  if (report.playerCasts === undefined) return null;

  const fightIds = new Set(
    report.fights.filter((f) => !isKalecgos(f.name)).map((f) => f.id),
  );
  const meta = report.abilityMeta ?? {};

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
    // Curated rows for this class, collapsed by base name and keyed by the
    // lower-cased base name (the same key casts are matched against). `looseMap`
    // maps a fully-paren-stripped name to its row key as a fallback (null when
    // two rows share one — ambiguous, so only the exact match is used there).
    const rowByKey = new Map<string, { key: string; name: string; category: CastCategory }>();
    const looseMap = new Map<string, string | null>();
    for (const a of cfg.catalog) {
      if (a.className !== className) continue;
      const name = rankStrip(a.name);
      const key = name.toLowerCase();
      if (!rowByKey.has(key)) rowByKey.set(key, { key, name, category: a.category });
      const loose = fullStrip(a.name).toLowerCase();
      if (loose && loose !== key) {
        looseMap.set(loose, looseMap.has(loose) && looseMap.get(loose) !== key ? null : key);
      }
    }

    const matchKey = (wclName: string): string | undefined => {
      const exact = rankStrip(wclName).toLowerCase();
      if (rowByKey.has(exact)) return exact;
      return looseMap.get(fullStrip(wclName).toLowerCase()) ?? undefined;
    };

    const counts = new Map<string, CastCell>();
    const act = new Map<number, ActivityResult | null>();

    for (const p of players) {
      for (const c of report.playerCasts) {
        if (c.playerId !== p.id || !fightIds.has(c.fightId)) continue;
        const resolved = meta[String(c.spellId)]?.name;
        if (!resolved) continue;
        const key = matchKey(resolved);
        if (key === undefined) continue; // not a curated ability for this class
        const row = rowByKey.get(key)!;
        const cellKey = `${p.id}:${key}`;
        const cell = counts.get(cellKey);
        if (cell) cell.castCount += 1;
        else counts.set(cellKey, { key, name: row.name, category: row.category, castCount: 1, rankFlag: false });
      }

      act.set(p.id, activity(p.id, report, cfg.activity, fightIds));
    }

    blocks.push({
      className,
      players: players.map((p) => ({ playerId: p.id, playerName: p.name })),
      abilities: [...rowByKey.values()].map((a) => ({ key: a.key, name: a.name, category: a.category })),
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
  /** on-use trinket/racial display names; matched against WCL cast names */
  trinketRacials: { spellId: number; name: string }[];
  /** avoidable ability display names; matched against WCL damage-taken names */
  avoidableAbilityNames: string[];
}

/** Normalize an ability name for matching: drop parentheticals, lower-case. */
function normName(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
}

/** Sum a player's per-fight raw hit counts into the normalized {count, pct} shape.
 *  Percentages are recomputed from the summed counts, so any fight subset is exact. */
export function aggregateHits(perFight: PlayerFightHits[]): PlayerHitStats {
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
  /** fraction 0..1 of boss-fight time with Battle Shout on the player */
  battleShoutUptime: number;
  /** fraction 0..1 of boss-fight time this player's Demoralizing Shout debuff was up */
  demoShoutUptime: number;
  /** Demoralizing Shout casts by this player (scoped fights) */
  demoShoutCasts: number;
  /** fraction 0..1 of boss-fight time this player's Expose Armor debuff was up */
  exposeArmorUptime: number;
  /** Expose Armor casts by this player (scoped fights) */
  exposeArmorCasts: number;
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
  const scopedFights = report.fights.filter((f) => !isKalecgos(f.name));
  const fightIds = new Set(scopedFights.map((f) => f.id));
  const durationMs = scopedFights.reduce((s, f) => s + (f.endTime - f.startTime), 0);

  // Group per-fight raw hit counts by player, restricted to the scoped fights —
  // this is what makes the sheet correct on a single boss pull.
  const hitsByPlayer = new Map<number, PlayerFightHits[]>();
  for (const h of report.hitStatsByFight ?? []) {
    if (!fightIds.has(h.fightId)) continue;
    const arr = hitsByPlayer.get(h.playerId) ?? [];
    arr.push(h);
    hitsByPlayer.set(h.playerId, arr);
  }
  const meta = report.abilityMeta ?? {};
  // Debuffs / avoidable damage are matched by name: WCL resolves every cast,
  // debuff and damage-taken name via masterData, so match those against the
  // curated names rather than the hand-curated spell ids.
  const debuffNames = new Set(cfg.avoidableDebuffIds.map((d) => normName(d.name)));
  const avoidableNames = new Set(cfg.avoidableAbilityNames.map((n) => normName(n)));
  // Trinkets/racials are matched by on-use SPELL id first, name second. WCL
  // labels an on-use cast inconsistently — by item name for some, by buff name
  // for others (e.g. Bloodlust Brooch logs as "Lust for Battle") — so name-only
  // matching silently drops half of them. The id map maps each on-use cast id to
  // its canonical display name; the name map is a fallback that also catches
  // racial rank variants. Both resolve to the same canonical label per effect.
  const trinketById = new Map(cfg.trinketRacials.map((t) => [t.spellId, t.name]));
  const trinketByName = new Map(cfg.trinketRacials.map((t) => [normName(t.name), t.name]));

  return result.rows
    .filter((r) => r.role === role)
    .map((r) => {
      // Avoidable damage taken, grouped by "Ability (Source)" — the source is the
      // boss/add that dealt it, or "Environment" (matches the workbook labels).
      const dmgByName = new Map<string, number>();
      for (const d of report.damageTakenEvents ?? []) {
        if (d.targetPlayerId !== r.playerId || !fightIds.has(d.fightId)) continue;
        const nm = meta[String(d.abilityId)]?.name;
        if (!nm || !avoidableNames.has(normName(nm))) continue;
        const label = d.sourceName ? `${nm} (${d.sourceName})` : nm;
        // "Raw" avoidable damage = before mitigation (matches the workbook)
        dmgByName.set(label, (dmgByName.get(label) ?? 0) + (d.unmitigatedAmount ?? d.amount));
      }

      // Tracked avoidable debuff APPLICATIONS this player sourced. enemyDebuffs are
      // merged intervals (one per application window), so counting intervals =
      // counting applications — matches the sheet's count.
      const debuffByName = new Map<string, number>();
      // Demoralizing Shout / Expose Armor uptime is matched by resolved WCL name
      // (not curated id) — the debuff aura id differs from the cast id for Demo
      // Shout, so an id match silently drops it.
      const demoShoutIvals: { startTime: number; endTime: number }[] = [];
      const exposeArmorIvals: { startTime: number; endTime: number }[] = [];
      for (const e of report.enemyDebuffs ?? []) {
        if (e.sourceId !== r.playerId || !fightIds.has(e.fightId)) continue;
        const nm = meta[String(e.spellId)]?.name;
        if (!nm) continue;
        const norm = normName(nm);
        if (norm === "demoralizing shout") demoShoutIvals.push(e);
        else if (norm === "expose armor") exposeArmorIvals.push(e);
        if (!debuffNames.has(norm)) continue;
        debuffByName.set(nm, (debuffByName.get(nm) ?? 0) + 1);
      }

      // On-use trinket/racial activations from this player's casts (per-fight scoped).
      // Match by on-use id first, then by resolved name; count under the canonical
      // display name so e.g. "Lust for Battle" is reported as "Bloodlust Brooch".
      const trinketCounts = new Map<string, number>();
      let demoShoutCasts = 0;
      let exposeArmorCasts = 0;
      for (const c of report.playerCasts ?? []) {
        if (c.playerId !== r.playerId || !fightIds.has(c.fightId)) continue;
        const nm = meta[String(c.spellId)]?.name;
        const norm = nm ? normName(nm) : undefined;
        if (norm === "demoralizing shout") demoShoutCasts++;
        else if (norm === "expose armor") exposeArmorCasts++;
        const canonical = trinketById.get(c.spellId) ?? (norm ? trinketByName.get(norm) : undefined);
        if (!canonical) continue;
        trinketCounts.set(canonical, (trinketCounts.get(canonical) ?? 0) + 1);
      }

      const myHits = hitsByPlayer.get(r.playerId);

      return {
        playerId: r.playerId,
        playerName: r.playerName,
        className: r.className,
        hitStats: myHits && myHits.length > 0 ? aggregateHits(myHits) : undefined,
        trinketUses: [...trinketCounts].map(([name, count]) => ({ playerId: r.playerId, name, count })),
        avoidableByAbility: [...dmgByName]
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount),
        debuffsApplied: [...debuffByName].map(([name, count]) => ({ name, count })),
        deaths: r.deaths,
        friendlyFire: r.friendlyFire,
        damageReflected: r.damageReflected,
        damageToHostilePlayers: r.damageToHostilePlayers,
        // total computed from the name-matched breakdown so the two agree
        totalAvoidableDamageTaken: [...dmgByName.values()].reduce((s, a) => s + a, 0),
        battleShoutUptime: r.battleShoutUptime,
        demoShoutUptime: durationMs > 0 ? mergedDurationMs(demoShoutIvals) / durationMs : 0,
        demoShoutCasts,
        exposeArmorUptime: durationMs > 0 ? mergedDurationMs(exposeArmorIvals) / durationMs : 0,
        exposeArmorCasts,
      };
    });
}
