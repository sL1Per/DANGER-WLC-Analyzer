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
  /** itemId/gemId → name+quality, for every id appearing in gear */
  itemMeta: Record<string, ItemMeta>;
}

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
