import type { Fight, ReportData } from "./types";

export interface ListedItem { itemId: number; name: string; }
export interface GearListingRow {
  playerId: number;
  playerName: string;
  /** keyed by slot id; absent slot = nothing equipped/recorded */
  items: Partial<Record<number, ListedItem>>;
}

export function itemName(report: ReportData, itemId: number): string {
  return report.itemMeta[String(itemId)]?.name ?? `item ${itemId}`;
}

/** Boss fights that have at least one gear snapshot, in fight order. */
export function listGearFights(report: ReportData): Fight[] {
  const withGear = new Set(report.gear.map((g) => g.fightId));
  return report.fights.filter((f) => f.isBoss && withGear.has(f.id));
}

export function gearListing(
  report: ReportData,
  fightId?: number,
): { fight: Fight | null; rows: GearListingRow[] } {
  const candidates = listGearFights(report);
  const fight = fightId !== undefined
    ? candidates.find((f) => f.id === fightId) ?? null
    : candidates[candidates.length - 1] ?? null;
  if (!fight) return { fight: null, rows: [] };

  const rows: GearListingRow[] = [];
  for (const snap of report.gear.filter((g) => g.fightId === fight.id)) {
    const player = report.players.find((p) => p.id === snap.playerId);
    if (!player) continue;
    const items: GearListingRow["items"] = {};
    for (const item of snap.items) {
      if (item.itemId === 0) continue;
      items[item.slot] = { itemId: item.itemId, name: itemName(report, item.itemId) };
    }
    rows.push({ playerId: player.id, playerName: player.name, items });
  }
  rows.sort((a, b) => a.playerName.localeCompare(b.playerName));
  return { fight, rows };
}
