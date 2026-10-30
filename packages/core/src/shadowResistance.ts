import type { Fight, ReportData } from "./types";
import type { IssueSeverity } from "./gearIssues";

/** Resistance school worn per encounter — only bosses that call for resist
 *  gear: Shahraz (whole raid) is shadow; on Illidan the Flame of Azzinoth tanks
 *  stack fire.
 *  Key order is the fallback order on the combined BOSSES card. */
export const RES_BOSSES = {
  "Mother Shahraz": "shadow",
  "Illidan Stormrage": "fire",
} as const satisfies Record<string, ResSchool>;
export type ResSchool = "shadow" | "fire";
export type ResBoss = keyof typeof RES_BOSSES;
const RES_BOSS_NAMES = Object.keys(RES_BOSSES) as ResBoss[];
export const isResBoss = (name: string): name is ResBoss => Object.hasOwn(RES_BOSSES, name);

/** Encounters where shadow-resistance gear is legitimate. */
export const SR_BOSSES = RES_BOSS_NAMES.filter((b) => RES_BOSSES[b] === "shadow");

/** Short label per school, used in slot cells ("+15 FR") and row headers. */
export const RES_ABBR: Record<ResSchool, string> = { shadow: "SR", fire: "FR" };

export interface ResistanceSchoolConfig {
  /** itemId → innate resistance of this school */
  items: Record<string, number>;
  /** permanent-enchant id → resistance granted */
  enchants: Record<string, number>;
  /** socketed gem itemId → resistance granted (e.g. Void Sphere +4) */
  gems: Record<string, number>;
  /** pull-aura spell id → resistance granted */
  buffs: Record<string, number>;
  /** advisory soft target for colouring total resistance (not an official threshold) */
  softTarget: number;
  /** only players wearing an item with innate resistance of this school are
   *  expected to stack it (fire on Illidan: just the Flame tanks) — everyone
   *  else gets no severity colour. All-resist enchants/gems don't count. */
  gearedOnly?: boolean;
}
export type ResistanceConfig = Record<ResSchool, ResistanceSchoolConfig>;

export interface ResistancePlayer {
  playerId: number; name: string;
  total: number; fromGear: number; fromBuffs: number;
  /** slot id → contribution text, e.g. "~30 SR" (innate) or "+24 FR" (enchant + gem, no innate) */
  slots: Record<number, string>;
  /** undefined when this player isn't expected to stack the school (see gearedOnly) */
  severity?: IssueSeverity;
}
export interface ResistanceResult {
  boss: ResBoss; school: ResSchool; fightId: number; isKill: boolean;
  players: ResistancePlayer[];
}

function resSeverity(total: number, softTarget: number): IssueSeverity {
  if (total >= softTarget) return "minor";          // green / ok
  if (total >= softTarget * 0.6) return "moderate"; // yellow
  return "major";                                    // red
}

/**
 * CLA `shadow resi`, extended per school: per-player resistance for the
 * RES_BOSSES encounters, in the school that boss calls for.
 *
 * `opts.fightId`, when given, pins the analysis to that exact pull (the caller
 * picked a specific SR-relevant fight via the report's own fight selector, so
 * there's no ambiguity to resolve here — this view no longer has its own boss
 * picker). Omitted (the combined BOSSES card, which isn't one specific pull),
 * it falls back to the first resistance boss present in the report (in
 * RES_BOSSES order), analyzing its kill, else its longest wipe.
 *
 * Resistance-from-buffs is read from combatantInfo pull auras (no extra event fetch).
 * Returns null when there's no matching resistance-boss fight to analyze.
 */
export function resistance(
  report: ReportData,
  cfgBySchool: ResistanceConfig,
  opts?: { fightId?: number },
): ResistanceResult | null {
  const fight: Fight | undefined = opts?.fightId !== undefined
    ? report.fights.find((f) => f.id === opts.fightId && f.isBoss && isResBoss(f.name))
    : (() => {
        const boss = RES_BOSS_NAMES.find((b) => report.fights.some((f) => f.isBoss && f.name === b));
        if (!boss) return undefined;
        const bossFights = report.fights.filter((f) => f.isBoss && f.name === boss);
        return bossFights.find((f) => f.kill === true)
          ?? bossFights.reduce((a, b2) => (b2.endTime - b2.startTime > a.endTime - a.startTime ? b2 : a));
      })();
  if (!fight || !isResBoss(fight.name)) return null;
  const boss = fight.name;
  const school = RES_BOSSES[boss];
  const cfg = cfgBySchool[school];
  const abbr = RES_ABBR[school];

  const playerById = new Map(report.players.map((p) => [p.id, p]));
  const players: ResistancePlayer[] = [];
  for (const snap of report.gear.filter((g) => g.fightId === fight.id)) {
    const player = playerById.get(snap.playerId);
    if (!player) continue;

    let fromGear = 0;
    let wearsSchoolItem = false;
    const slots: Record<number, string> = {};
    for (const item of snap.items) {
      const innate = cfg.items[String(item.itemId)] ?? 0;
      const ench = item.permanentEnchantId ? (cfg.enchants[String(item.permanentEnchantId)] ?? 0) : 0;
      let gems = 0;
      for (const gemId of item.gemIds ?? []) gems += cfg.gems[String(gemId)] ?? 0;
      if (innate === 0 && ench === 0 && gems === 0) continue;
      if (innate > 0) wearsSchoolItem = true;
      fromGear += innate + ench + gems;
      const total = innate + ench + gems;
      // "~" when the total includes an approximate (curated) innate value, else it's an exact bonus.
      slots[item.slot] = innate > 0 ? `~${total} ${abbr}` : `+${total} ${abbr}`;
    }

    // distinct auras only (dedup defensively in case a source repeats one); sum their resistance
    let fromBuffs = 0;
    for (const spellId of new Set(snap.auras ?? [])) fromBuffs += cfg.buffs[String(spellId)] ?? 0;

    const total = fromGear + fromBuffs;
    const expected = !cfg.gearedOnly || wearsSchoolItem;
    players.push({
      playerId: player.id, name: player.name, total, fromGear, fromBuffs, slots,
      severity: expected ? resSeverity(total, cfg.softTarget) : undefined,
    });
  }
  players.sort((a, b) => a.name.localeCompare(b.name));
  return { boss, school, fightId: fight.id, isKill: fight.kill === true, players };
}
