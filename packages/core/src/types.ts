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

export type FightMode = "all" | "bosses" | "trash";

export interface FightFilter {
  mode: FightMode;
  excludeWipes: boolean;
  /** mutually exclusive with range */
  fightId?: number | "last";
  /** mutually exclusive with fightId; ms relative to report start */
  range?: { start: number; end: number };
}
