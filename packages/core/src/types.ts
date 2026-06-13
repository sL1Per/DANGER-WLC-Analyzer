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

/** Item/gem metadata resolved via WCL gameData. quality: 1 common … 4 epic. */
export interface ItemMeta { name: string; quality?: number; }

export type FightMode = "all" | "bosses" | "trash";

export interface FightFilter {
  mode: FightMode;
  excludeWipes: boolean;
  /** mutually exclusive with range */
  fightId?: number | "last";
  /** mutually exclusive with fightId; ms relative to report start */
  range?: { start: number; end: number };
}
