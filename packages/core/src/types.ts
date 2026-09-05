/**
 * Schema version of the normalized report payload. BUMP THIS whenever the
 * analyzer output changes — a new/changed field in normalizeReport, or a
 * semantic change in @wcl/data that alters the numbers. Cached reports stamped
 * with an older version are flagged `stale` so the UI can prompt a WCL refresh
 * (see isStaleSchema + apps/api GET /api/report/:id). This is the general signal
 * that supersedes the per-field "undefined = cached before X" guesswork.
 *
 * History:
 *   1 — introduced cache schema versioning (hitType stats, NPC source names,
 *       unmitigated avoidable damage, per-fight hit stats all current as of v1).
 *   2 — added per-boss DPS/HPS parse value (RankingCharacter.parse).
 *   3 — fixed parse to read WCL's `amount` field (v2 report rankings) — v2
 *       cached it from the wrong field (`total`) and always got 0.
 *   4 — extra-Windfury-attack count now matched by ability name ("Windfury
 *       Attack") instead of an unverified curated id that never hit (always 0);
 *       dropped the unused Battle Squawk tally.
 *   5 — extra-Windfury-attack match widened to any "Windfury*" damage event, so
 *       Windfury Totem procs on non-shaman melee are counted too.
 *   6 — extra-Windfury-attack count now read from WCL `extraattacks` events
 *       (v5 still missed totem procs — their swings log as plain Melee).
 *   7 — reverted v6: WCL's DamageDone stream carries no `extraattacks` events,
 *       so v6 zeroed everyone. Back to matching "Windfury*" damage events
 *       (shaman Windfury Weapon imbue only).
 *   8 — Resistances tab now counts SR from socketed gems (Void Sphere) and from
 *       head/hands/feet armour-kit & glyph enchants + all-resist enchants/flasks.
 *   9 — RPB role sheet gained RoleSheetRow.twist (Windfury / Grace of Air totem
 *       twisting). Superseded by v10's shape.
 *  10 — twist metric reworked to the air-totem SLOT model (derived from totem
 *       casts, no buff fetch): per-totem slot uptime, cast counts and a per-fight
 *       slot-occupancy timeline (segments[].slots / windfuryPct / gracePct).
 *  11 — Fight gained friendlyPlayers (WCL's per-pull roster); RPB/role-breakdown
 *       tables now restrict their player columns to that pull's actual roster
 *       instead of every player who ever appeared anywhere in the report.
 */
export const SCHEMA_VERSION = 11;

/** A cached report is stale when its stamped version differs from the current
 *  one. Pre-versioning caches have no `schemaVersion` (undefined) → stale. */
export function isStaleSchema(version: number | undefined): boolean {
  return version !== SCHEMA_VERSION;
}

/** Normalized report payload produced by apps/api and consumed by all analyses. */
export interface ReportData {
  /** Analyzer schema version this payload was produced under (SCHEMA_VERSION at
   *  fetch time). Absent on caches predating versioning → treated as stale. */
  schemaVersion?: number;
  reportId: string;
  title: string;
  zoneName: string;
  /** ms epoch of report start; fight times are ms relative to this */
  startTime: number;
  endTime: number;
  fights: Fight[];
  players: Player[];
  /** combatantInfo gear snapshots, boss fights only; empty when unavailable */
  gear: GearSnapshot[];
  /** consumable/drum buff intervals on players (M3+); undefined = report cached before M3 */
  buffs?: BuffInterval[];
  drumCasts?: DrumCast[];
  drumApplications?: DrumApplication[];
  /** RPB (M5a+) — all optional; undefined = report cached before M5a (refresh notice). */
  playerTotals?: PlayerTotals[];
  playerDeaths?: PlayerDeath[];
  interrupts?: InterruptEvent[];
  damageTakenEvents?: DamageTakenEvent[];
  playerCasts?: PlayerCast[];
  playerDamage?: PlayerDamageEvent[];
  absorbs?: AbsorbEvent[];
  /** enemy-debuff intervals sourced by a player (M5b+); undefined = cached before M5b */
  enemyDebuffs?: EnemyDebuffInterval[];
  /** WCL parse-percentile rankings per ranked boss, grouped by WCL role
   *  (rankings feature); undefined = report cached before this feature. */
  rankings?: ReportRanking[];
  /** per-player, per-boss-fight raw hit-type counts (RPB role sheets). roleSheet
   *  sums the rows for the scoped fights, so a single boss pull and the combined
   *  ALL-bosses view are both exact. undefined = cached before per-fight support. */
  hitStatsByFight?: PlayerFightHits[];
  /** per-fight effective healing by source (performance breakdown);
   *  undefined = report cached before this feature (drives refresh notice). */
  healingEvents?: HealingEvent[];
  /** WCL abilityGameID → name, for damage-taken/death ability labels;
   *  undefined/absent on pre-feature caches. */
  abilityMeta?: Record<string, { name: string }>;
  /** itemId/gemId → name+quality, for every id appearing in gear */
  itemMeta: Record<string, ItemMeta>;
}

/** A buff active on a player, clamped to one fight's window (report-relative ms). */
export interface BuffInterval {
  fightId: number;
  targetId: number;
  spellId: number;
  startTime: number;
  endTime: number;
}

/** A debuff a player applied to an enemy, clamped to one fight (report-relative ms). */
export interface EnemyDebuffInterval {
  fightId: number;
  /** the player who applied the debuff */
  sourceId: number;
  /** the enemy actor the debuff is on */
  targetEnemyId: number;
  spellId: number;
  startTime: number;
  endTime: number;
}

/** One drum cast by a player. */
export interface DrumCast { fightId: number; sourceId: number; spellId: number; timestamp: number; }

/** One drum-buff application (source = the drummer). */
export interface DrumApplication { fightId: number; sourceId: number; targetId: number; spellId: number; timestamp: number; }

export interface Fight {
  id: number;
  name: string;
  /** 0 = trash pull, otherwise WCL encounter id */
  encounterId: number;
  isBoss: boolean;
  /** true=kill, false=wipe; undefined for trash */
  kill?: boolean;
  startTime: number; // ms relative to report start
  endTime: number;
  /** WCL's roster for this specific pull (player ids). Undefined/empty means WCL
   *  gave us no participation info for this fight — callers that build a per-fight
   *  roster from this should fall back to every report player rather than showing
   *  an empty table (see rpb.ts's scopedRoster). */
  friendlyPlayers?: number[];
}

export interface Player {
  id: number;
  name: string;
  /** WCL subType, e.g. "Mage" */
  class: string;
}

/** One equipped item from a combatantInfo snapshot. */
export interface GearItem {
  /** WoW inventory slot id (0=Head … 17=Wand/Idol/Relic, 18=Tabard) */
  slot: number;
  itemId: number;
  itemLevel?: number;
  permanentEnchantId?: number;
  temporaryEnchantId?: number;
  gemIds: number[];
}

/** A player's full gear at the start of one boss fight. */
export interface GearSnapshot {
  fightId: number;
  playerId: number;
  items: GearItem[];
  /** spell ids active at boss pull (combatantInfo auras); used for SR-from-buffs */
  auras?: number[];
}

/** Item/gem name resolved via WCL gameData (its GameItem type exposes no quality —
 *  gem quality comes from a static table instead; see GearIssueConfig.gemQuality). */
export interface ItemMeta { name: string; }

export type FightMode = "all" | "bosses" | "trash";

export interface FightFilter {
  mode: FightMode;
  excludeWipes: boolean;
  /** mutually exclusive with range */
  fightId?: number | "last";
  /** mutually exclusive with fightId; ms relative to report start */
  range?: { start: number; end: number };
}

export type Role = "tank" | "healer" | "caster" | "physical";

/** Per-player aggregate output from WCL summary tables (whole report, boss
 *  fights), used by detectRole. All amounts are raw effective values. */
export interface PlayerTotals {
  playerId: number;
  healingDone: number;
  damageDone: number;
  damageTaken: number;
  /** portion of damageDone dealt with a magic school (not Physical) */
  magicDamageDone: number;
}

/** A boss/trash-fight death of a player (Kalecgos already excluded upstream).
 *  killingAbilityId/timestamp are present from the performance-breakdown feature
 *  onward; undefined on reports cached before it. */
export interface PlayerDeath {
  playerId: number;
  fightId: number;
  /** WCL killingAbilityGameID of the killing blow; undefined when unknown */
  killingAbilityId?: number;
  /** event timestamp, report-relative ms; undefined on pre-feature caches */
  timestamp?: number;
}

/** An enemy spell a player interrupted. In WCL the interrupt event's source is the
 *  interrupter (the player) and the target is the enemy whose cast was stopped. */
export interface InterruptEvent {
  fightId: number;
  /** the player who did the interrupting (the WCL event source) */
  interrupterPlayerId: number;
  /** the spell that got interrupted (WCL extraAbilityGameID) */
  interruptedSpellId: number;
  /** display name of the enemy whose cast was interrupted (the WCL event target) */
  sourceName: string;
}

/** A damage-taken event on a player, with classification flags. */
export interface DamageTakenEvent {
  fightId: number;
  targetPlayerId: number;
  abilityId: number;
  amount: number;
  /** true when the damage source is friendly (friendly fire / reflected setups) */
  fromFriendly: boolean;
  /** display name of the damage source (boss/add) or "Environment"; for the
   *  role sheet's "Ability (Source)" labels. */
  sourceName?: string;
  /** damage before mitigation — the workbook's "Raw avoidable damage". */
  unmitigatedAmount?: number;
}

/** A player's cast (for activity). */
export interface PlayerCast { fightId: number; playerId: number; spellId: number; timestamp: number; }

/** A player's outgoing damage instance (for AoE hit-counting + engineering/oil). */
export interface PlayerDamageEvent {
  fightId: number; sourceId: number; abilityId: number; targetId: number;
  amount: number; timestamp: number;
  /** true when the target is a hostile PLAYER (PvP; counted as self-damage in RPB) */
  targetHostilePlayer: boolean;
  /** true when the source is also the target (self/reflected) */
  selfInflicted: boolean;
}

/** An absorb credited to a player. */
export interface AbsorbEvent { fightId: number; playerId: number; spellId: number; amount: number; }

/** Effective healing done by a player in one fight (HealingDone events). */
export interface HealingEvent { fightId: number; sourceId: number; amount: number; }

/** One character's parse in a boss ranking (from WCL's rankings JSON). */
export interface RankingCharacter {
  name: string;
  /** WoW class string, e.g. "Mage" (matches Player.class) */
  class: string;
  spec?: string;
  /** damage/healing parse percentile, 0–100 */
  rankPercent: number;
  /** item-level (bracket) parse percentile, 0–100 */
  bracketPercent: number;
  /** the parse metric value: DPS for dps/tank rankings, HPS for healer rankings */
  parse: number;
}

/** WCL parse rankings for one ranked (killed) boss fight, grouped by WCL role. */
export interface ReportRanking {
  fightID: number;
  encounterId: number;
  encounterName: string;
  tanks: RankingCharacter[];
  healers: RankingCharacter[];
  dps: RankingCharacter[];
}

/** One hit-type tally: raw count + share of the relevant population. */
export interface HitStat { count: number; pct: number; }

/** Per-player hit-type breakdown from the WCL damage/healing tables (boss fights). */
export interface PlayerHitStats {
  playerId: number;
  outgoing: { crit: HitStat; dodge: HitStat; miss: HitStat; parry: HitStat; resist: HitStat };
  incomingMelee: { crit: HitStat; crushing: HitStat; blocked: HitStat; dodge: HitStat; immune: HitStat; miss: HitStat; parry: HitStat };
  critHeals: HitStat;
  /** count of extra Windfury attacks granted (0 when not applicable) */
  extraWindfury: number;
}

/** A use of a curated on-use trinket or racial (count of casts/applications). */
export interface TrinketUse { playerId: number; name: string; count: number; }

/** Raw (un-normalized) hit-type counts for one player on one boss fight. Stored
 *  per fight so roleSheet can sum the scoped fights and recompute percentages —
 *  this is what makes the role sheet correct on a single boss pull. */
export interface PlayerFightHits {
  playerId: number;
  fightId: number;
  outgoing: { hit: number; crit: number; dodge: number; miss: number; parry: number; resist: number };
  incomingMelee: { hit: number; crit: number; crushing: number; blocked: number; dodge: number; immune: number; miss: number; parry: number };
  heal: { hit: number; crit: number };
  extraWindfury: number;
}
