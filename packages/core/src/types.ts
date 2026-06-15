/** Normalized report payload produced by apps/api and consumed by all analyses. */
export interface ReportData {
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
  /** enemy gameId → total kills across the report (M4+); undefined = report cached before M4 */
  npcKills?: Record<string, number>;
  /** enemy gameIds that died in the chronologically first fight (for the valid-start check) */
  firstPullNpcIds?: number[];
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

/** A boss-fight death of a player (Kalecgos already excluded upstream). */
export interface PlayerDeath { playerId: number; fightId: number; }

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
