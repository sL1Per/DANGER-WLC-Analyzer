import type { Fight, ReportData } from "./types";
import type { IssueSeverity } from "./gearIssues";

export const SR_BOSSES = ["Mother Shahraz", "Kaz'rogal", "Azgalor"] as const;
export type SrBoss = (typeof SR_BOSSES)[number];

export interface ShadowResConfig {
  itemShadowRes: Record<string, number>;
  enchantShadowRes: Record<string, number>;
  /** socketed gem itemId → Shadow Resistance granted (e.g. Void Sphere +4) */
  gemShadowRes: Record<string, number>;
  buffShadowRes: Record<string, number>;
  /** advisory soft target for colouring total SR (not an official threshold) */
  softTarget: number;
}

export interface ShadowResPlayer {
  playerId: number; name: string;
  total: number; fromGear: number; fromBuffs: number;
  /** slot id → contribution text, e.g. "~30 SR" (innate) or "+24 SR" (enchant + gem, no innate) */
  slots: Record<number, string>;
  severity: IssueSeverity;
}
export interface ShadowResResult {
  boss: string; fightId: number; isKill: boolean;
  players: ShadowResPlayer[];
}

function srSeverity(total: number, softTarget: number): IssueSeverity {
  if (total >= softTarget) return "minor";          // green / ok
  if (total >= softTarget * 0.6) return "moderate"; // yellow
  return "major";                                    // red
}

/**
 * CLA `shadow resi`: per-player Shadow Resistance for Shahraz/Kaz'rogal/Azgalor.
 *
 * `opts.fightId`, when given, pins the analysis to that exact pull (the caller
 * picked a specific SR-relevant fight via the report's own fight selector, so
 * there's no ambiguity to resolve here — this view no longer has its own boss
 * picker). Omitted (the combined BOSSES card, which isn't one specific pull),
 * it falls back to the first SR boss present in the report (Shahraz, then
 * Kaz'rogal, then Azgalor), analyzing its kill, else its longest wipe.
 *
 * SR-from-buffs is read from combatantInfo pull auras (no extra event fetch).
 * Returns null when there's no matching SR-boss fight to analyze.
 */
export function shadowResistance(
  report: ReportData,
  cfg: ShadowResConfig,
  opts?: { fightId?: number },
): ShadowResResult | null {
  const fight: Fight | undefined = opts?.fightId !== undefined
    ? report.fights.find((f) => f.id === opts.fightId && f.isBoss && (SR_BOSSES as readonly string[]).includes(f.name))
    : (() => {
        const boss = SR_BOSSES.find((b) => report.fights.some((f) => f.isBoss && f.name === b));
        if (!boss) return undefined;
        const bossFights = report.fights.filter((f) => f.isBoss && f.name === boss);
        return bossFights.find((f) => f.kill === true)
          ?? bossFights.reduce((a, b2) => (b2.endTime - b2.startTime > a.endTime - a.startTime ? b2 : a));
      })();
  if (!fight) return null;

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
      let gems = 0;
      for (const gemId of item.gemIds ?? []) gems += cfg.gemShadowRes[String(gemId)] ?? 0;
      if (innate === 0 && ench === 0 && gems === 0) continue;
      fromGear += innate + ench + gems;
      const total = innate + ench + gems;
      // "~" when the total includes an approximate (curated) innate value, else it's an exact bonus.
      slots[item.slot] = innate > 0 ? `~${total} SR` : `+${total} SR`;
    }

    // distinct auras only (dedup defensively in case a source repeats one); sum their SR
    let fromBuffs = 0;
    for (const spellId of new Set(snap.auras ?? [])) fromBuffs += cfg.buffShadowRes[String(spellId)] ?? 0;

    const total = fromGear + fromBuffs;
    players.push({ playerId: player.id, name: player.name, total, fromGear, fromBuffs, slots, severity: srSeverity(total, cfg.softTarget) });
  }
  players.sort((a, b) => a.name.localeCompare(b.name));
  return { boss: fight.name, fightId: fight.id, isKill: fight.kill === true, players };
}
