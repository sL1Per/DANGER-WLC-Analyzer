import { ENCHANTABLE_SLOTS, QUALITY_NAMES, REQUIRED_SLOTS, SLOT_NAMES } from "./slots";
import { itemName } from "./gearListing";
import type { GearItem, ReportData } from "./types";

export interface GearIssueConfig {
  /** flag gems below this quality (1 common … 4 epic) */
  minGemQuality: number;
  /** skip Mother Shahraz fights entirely (SR gear is legitimate there) */
  excludeShahraz: boolean;
  /** include players that have zero issues in the result */
  listNoIssues: boolean;
  // reference data, injected so core stays dependency-free (@wcl/data wires these)
  itemSockets: Record<string, number>;
  itemShadowRes: Record<string, number>;
  badEnchants: { enchantId: number; slot: number | null; name: string }[];
  excludedItems: { itemId: number; name: string }[];
}

export interface GearIssue { itemId: number; itemName: string; issue: string; }
export interface PlayerGearIssues { playerId: number; playerName: string; issues: GearIssue[]; }

/** Boss names where shadow-resistance gear is legitimate, not "useless". */
const SR_FIGHT_NAMES = new Set(["Mother Shahraz", "Kaz'rogal", "Azgalor"]);
const SHAHRAZ = "Mother Shahraz";

export function gearIssues(report: ReportData, cfg: GearIssueConfig): PlayerGearIssues[] {
  const badEnchantById = new Map(cfg.badEnchants.map((e) => [e.enchantId, e]));
  const excludedById = new Map(cfg.excludedItems.map((i) => [i.itemId, i]));
  const fightById = new Map(report.fights.map((f) => [f.id, f]));

  const result: PlayerGearIssues[] = [];
  for (const player of report.players) {
    const seen = new Set<string>();
    const issues: GearIssue[] = [];
    const add = (itemId: number, issue: string) => {
      const key = `${itemId}|${issue}`;
      if (seen.has(key)) return;
      seen.add(key);
      issues.push({ itemId, itemName: itemId ? itemName(report, itemId) : "", issue });
    };

    for (const snap of report.gear) {
      if (snap.playerId !== player.id) continue;
      const fight = fightById.get(snap.fightId);
      if (!fight) continue;
      if (cfg.excludeShahraz && fight.name === SHAHRAZ) continue;

      const bySlot = new Map<number, GearItem>(
        snap.items.filter((i) => i.itemId !== 0).map((i) => [i.slot, i]));

      for (const slot of REQUIRED_SLOTS) {
        if (!bySlot.has(slot)) add(0, `no item on ${SLOT_NAMES[slot]}`);
      }

      for (const item of bySlot.values()) {
        if (excludedById.has(item.itemId)) add(item.itemId, "useless/fun item");
        checkEnchant(item, badEnchantById, add);
        checkGems(report, item, cfg, add);
        checkShadowRes(item, fight.name, cfg, add);
      }
    }
    if (issues.length > 0 || cfg.listNoIssues) {
      result.push({ playerId: player.id, playerName: player.name, issues });
    }
  }
  result.sort((a, b) => a.playerName.localeCompare(b.playerName));
  return result;
}

function checkEnchant(
  item: GearItem,
  badEnchantById: Map<number, { slot: number | null; name: string }>,
  add: (itemId: number, issue: string) => void,
): void {
  if (!ENCHANTABLE_SLOTS.has(item.slot)) return;
  if (item.permanentEnchantId === undefined) {
    add(item.itemId, "no enchant");
    return;
  }
  const bad = badEnchantById.get(item.permanentEnchantId);
  if (bad && (bad.slot === null || bad.slot === item.slot)) {
    add(item.itemId, `cheap or bad enchant (${bad.name})`);
  }
}

function checkGems(
  report: ReportData,
  item: GearItem,
  cfg: GearIssueConfig,
  add: (itemId: number, issue: string) => void,
): void {
  const sockets = cfg.itemSockets[String(item.itemId)] ?? 0;
  if (sockets === 0) return;
  const missing = sockets - item.gemIds.length;
  if (missing > 0) add(item.itemId, `missing gem(s) (${item.gemIds.length}/${sockets})`);
  for (const gemId of item.gemIds) {
    const quality = report.itemMeta[String(gemId)]?.quality;
    if (quality !== undefined && quality < cfg.minGemQuality) {
      // one entry per offending gem, like the original — bypass dedupe via counter suffix
      add(item.itemId, `${QUALITY_NAMES[quality] ?? "low-quality"} gem used`);
    }
  }
}

function checkShadowRes(
  item: GearItem,
  fightName: string,
  cfg: GearIssueConfig,
  add: (itemId: number, issue: string) => void,
): void {
  if (SR_FIGHT_NAMES.has(fightName)) return;
  if (cfg.itemShadowRes[String(item.itemId)] !== undefined) {
    add(item.itemId, "useless SR gear");
  }
}
