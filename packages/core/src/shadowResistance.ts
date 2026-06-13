import type { ReportData } from "./types";
import { itemName } from "./itemName";
import type { IssueSeverity } from "./gearIssues";

export const SR_BOSSES = ["Mother Shahraz", "Kaz'rogal", "Azgalor"] as const;
export type SrBoss = (typeof SR_BOSSES)[number];

export interface ShadowResConfig {
  itemShadowRes: Record<string, number>;
  enchantShadowRes: Record<string, number>;
  buffShadowRes: Record<string, number>;
  /** advisory soft target for colouring total SR (not an official threshold) */
  softTarget: number;
}

export interface ShadowResPlayer {
  playerId: number; name: string;
  total: number; fromGear: number; fromBuffs: number;
  /** slot id → contribution text, e.g. "Pendant of Shadow's End (~30 SR) +15 SR" */
  slots: Record<number, string>;
  severity: IssueSeverity;
}
export interface ShadowResResult {
  boss: string; fightId: number; isKill: boolean;
  /** SR bosses actually present in the report, for the view's selector */
  availableBosses: SrBoss[];
  players: ShadowResPlayer[];
}

function srSeverity(total: number, softTarget: number): IssueSeverity {
  if (total >= softTarget) return "minor";          // green / ok
  if (total >= softTarget * 0.6) return "moderate"; // yellow
  return "major";                                    // red
}

/**
 * CLA `shadow resi`: per-player Shadow Resistance for Shahraz/Kaz'rogal/Azgalor.
 * Analyzes the kill, else the longest wipe of the chosen boss. SR-from-buffs is
 * read from combatantInfo pull auras (no extra event fetch). Returns null when
 * none of the three SR bosses are in the report.
 */
export function shadowResistance(
  report: ReportData,
  cfg: ShadowResConfig,
  opts?: { boss?: SrBoss },
): ShadowResResult | null {
  const availableBosses = SR_BOSSES.filter((b) => report.fights.some((f) => f.isBoss && f.name === b));
  const boss = opts?.boss && availableBosses.includes(opts.boss) ? opts.boss : availableBosses[0];
  if (!boss) return null;

  const bossFights = report.fights.filter((f) => f.isBoss && f.name === boss);
  const kill = bossFights.find((f) => f.kill === true);
  const fight = kill ?? bossFights.reduce((a, b) => (b.endTime - b.startTime > a.endTime - a.startTime ? b : a));

  const playerById = new Map(report.players.map((p) => [p.id, p]));
  const players: ShadowResPlayer[] = [];
  for (const snap of report.gear.filter((g) => g.fightId === fight.id)) {
    const player = playerById.get(snap.playerId);
    if (!player) continue;

    let fromGear = 0;
    const slots: Record<number, string> = {};
    for (const item of snap.items) {
      const innate = cfg.itemShadowRes[String(item.itemId)] ?? 0;
      const ench = item.permanentEnchantId ? (cfg.enchantShadowRes[String(item.permanentEnchantId)] ?? 0) : 0;
      if (innate === 0 && ench === 0) continue;
      fromGear += innate + ench;
      const parts: string[] = [];
      if (innate > 0) parts.push(`${itemName(report, item.itemId)} (~${innate} SR)`);
      if (ench > 0) parts.push(`+${ench} SR`);
      slots[item.slot] = parts.join(" ");
    }

    // distinct auras only (combatantInfo lists each aura once); sum their SR
    let fromBuffs = 0;
    for (const spellId of snap.auras ?? []) fromBuffs += cfg.buffShadowRes[String(spellId)] ?? 0;

    const total = fromGear + fromBuffs;
    players.push({ playerId: player.id, name: player.name, total, fromGear, fromBuffs, slots, severity: srSeverity(total, cfg.softTarget) });
  }
  players.sort((a, b) => a.name.localeCompare(b.name));
  return { boss, fightId: fight.id, isKill: kill !== undefined, availableBosses, players };
}
