import type { BuffInterval, Fight, GearSnapshot, ReportData } from "./types";
import type { IssueSeverity } from "./gearIssues";

export interface ConsumableConfig {
  // reference data, injected so core stays dependency-free (@wcl/data wires these)
  buffs: {
    spellId: number;
    name: string;
    category: "battleElixir" | "guardianElixir" | "flask" | "food" | "scroll";
    /** scroll metadata; level < 5 means a sub-max scroll (flagged with *) */
    scroll?: { type: string; level: number };
  }[];
  /** JC necks with on-use absorbs: itemId equipped → buffId proves a use */
  jcNecks: { itemId: number; buffId: number; name: string }[];
  /** consumables/temp enchants that work but are the wrong choice */
  suboptimal: { kind: "buff" | "tempEnchant"; id: number; name: string }[];
}

/** One player's row of the "buff consumables" sheet. All uptimes are 0–1 fractions of total boss-fight time. */
export interface ConsumableRow {
  playerId: number;
  playerName: string;
  /** uptime of battle ∪ guardian ∪ flask (merged, not summed) */
  elixirOrFlask: number;
  battleElixir: number;
  guardianElixir: number;
  flask: number;
  food: number;
  /** e.g. "83% (Agi*,Prot)"; "" when no scrolls were used */
  scrolls: string;
  scrollUptime: number;
  /** fraction of snapshot-covered boss time with a temp weapon enchant; null = no gear snapshots at all */
  weaponEnhancement: number | null;
  jcNeck: { usedOnFights: number; inactiveOnFights: number; equipped: boolean };
  /** distinct suboptimal consumable names, insertion order */
  suboptimal: string[];
  /** mean of elixirOrFlask/food/weaponEnhancement (see totalAverage()) */
  totalAverage: number;
}

const NECK_SLOT = 1;
const WEAPON_SLOT = 15;
/** JC necks are never flagged inactive on Kael'thas (original sheet's caveat). */
const JC_NECK_EXEMPT_PREFIX = "Kael'thas";

/**
 * CLA "buff consumables": per-player consumable discipline on boss fights.
 * Returns null when the report predates M3 (no buff data cached) so the UI
 * can show a refresh notice instead of all-zero rows.
 */
export function consumables(report: ReportData, cfg: ConsumableConfig): { rows: ConsumableRow[] } | null {
  if (report.buffs === undefined) return null;

  const bossFights = new Map(report.fights.filter((f) => f.isBoss).map((f) => [f.id, f]));
  if (bossFights.size === 0) return { rows: [] };
  const totalBossMs = [...bossFights.values()].reduce((sum, f) => sum + (f.endTime - f.startTime), 0);

  const idsByCategory = (category: ConsumableConfig["buffs"][number]["category"]) =>
    new Set(cfg.buffs.filter((b) => b.category === category).map((b) => b.spellId));
  const battleIds = idsByCategory("battleElixir");
  const guardianIds = idsByCategory("guardianElixir");
  const flaskIds = idsByCategory("flask");
  const foodIds = idsByCategory("food");
  const scrollIds = idsByCategory("scroll");
  const elixirOrFlaskIds = new Set([...battleIds, ...guardianIds, ...flaskIds]);

  const rows: ConsumableRow[] = [];
  for (const player of report.players) {
    // only intervals on boss fights count anywhere below
    const buffs = report.buffs.filter((b) => b.targetId === player.id && bossFights.has(b.fightId));
    const snapshots = report.gear.filter((s) => s.playerId === player.id && bossFights.has(s.fightId));
    const uptime = (ids: Set<number>) => mergedUptime(buffs, ids, bossFights, totalBossMs);

    const elixirOrFlask = uptime(elixirOrFlaskIds);
    const food = uptime(foodIds);
    const scrollUptime = uptime(scrollIds);
    const weaponEnhancement = weaponEnhancementUptime(snapshots, bossFights);

    rows.push({
      playerId: player.id,
      playerName: player.name,
      elixirOrFlask,
      battleElixir: uptime(battleIds),
      guardianElixir: uptime(guardianIds),
      flask: uptime(flaskIds),
      food,
      scrolls: formatScrolls(buffs, cfg, scrollUptime),
      scrollUptime,
      weaponEnhancement,
      jcNeck: jcNeckUsage(snapshots, buffs, cfg, bossFights),
      suboptimal: suboptimalNames(buffs, snapshots, cfg),
      totalAverage: totalAverage(elixirOrFlask, food, weaponEnhancement),
    });
  }
  rows.sort((a, b) => a.playerName.localeCompare(b.playerName));
  return { rows };
}

/**
 * Uptime → severity for conditional formatting. Our thresholds (the original
 * sheet's gradient is not reproducible exactly): ≥ 90% is fine (minor/green),
 * ≥ 50% is mediocre (moderate/yellow), below that is a real problem (major/red).
 */
export function uptimeSeverity(uptime: number): IssueSeverity {
  return uptime >= 0.9 ? "minor" : uptime >= 0.5 ? "moderate" : "major";
}

/**
 * Uptime of a set of spell ids: clamp each interval to its boss fight's window,
 * merge overlaps per fight (two simultaneous food buffs must not double-count),
 * then divide the merged total by totalBossMs.
 */
function mergedUptime(
  buffs: BuffInterval[],
  ids: Set<number>,
  bossFights: Map<number, Fight>,
  totalBossMs: number,
): number {
  if (totalBossMs === 0) return 0;
  const byFight = new Map<number, [number, number][]>();
  for (const b of buffs) {
    if (!ids.has(b.spellId)) continue;
    const fight = bossFights.get(b.fightId);
    if (!fight) continue; // callers pre-filter to boss fights; stay safe anyway
    const start = Math.max(b.startTime, fight.startTime);
    const end = Math.min(b.endTime, fight.endTime);
    if (end <= start) continue;
    let list = byFight.get(b.fightId);
    if (!list) byFight.set(b.fightId, (list = []));
    list.push([start, end]);
  }
  let coveredMs = 0;
  for (const intervals of byFight.values()) {
    intervals.sort((a, b) => a[0] - b[0]);
    let [curStart, curEnd] = intervals[0]!;
    for (const [start, end] of intervals.slice(1)) {
      if (start <= curEnd) {
        curEnd = Math.max(curEnd, end); // overlapping/adjacent: extend
      } else {
        coveredMs += curEnd - curStart;
        [curStart, curEnd] = [start, end];
      }
    }
    coveredMs += curEnd - curStart;
  }
  return coveredMs / totalBossMs;
}

/**
 * Temp weapon enchant uptime is gear-based (combatantInfo), not buff-based:
 * over the boss fights with a snapshot, the time-weighted share where the
 * slot-15 item carries a temporaryEnchantId. Null = no snapshots at all
 * (gear info missing — distinct from "had no enhancement").
 */
function weaponEnhancementUptime(snapshots: GearSnapshot[], bossFights: Map<number, Fight>): number | null {
  if (snapshots.length === 0) return null;
  let totalMs = 0;
  let enhancedMs = 0;
  for (const snap of snapshots) {
    const fight = bossFights.get(snap.fightId)!;
    const duration = fight.endTime - fight.startTime;
    totalMs += duration;
    const weapon = snap.items.find((i) => i.slot === WEAPON_SLOT);
    if (weapon && weapon.temporaryEnchantId !== undefined) enhancedMs += duration;
  }
  return totalMs === 0 ? 0 : enhancedMs / totalMs;
}

/** "83% (Agi*,Prot)" — types alphabetical, * when any used scroll of the type is below level 5. */
function formatScrolls(buffs: BuffInterval[], cfg: ConsumableConfig, scrollUptime: number): string {
  if (scrollUptime <= 0) return "";
  const usedIds = new Set(buffs.map((b) => b.spellId));
  const lowLevel = new Set<string>(); // types where a sub-max scroll was used
  const types = new Set<string>();
  for (const buff of cfg.buffs) {
    if (buff.category !== "scroll" || !buff.scroll || !usedIds.has(buff.spellId)) continue;
    types.add(buff.scroll.type);
    if (buff.scroll.level < 5) lowLevel.add(buff.scroll.type);
  }
  const labels = [...types].sort().map((t) => (lowLevel.has(t) ? `${t}*` : t));
  return `${Math.round(scrollUptime * 100)}% (${labels.join(",")})`;
}

/** Per boss-fight snapshot: equipped JC neck used (its buff appeared) vs. inactive. */
function jcNeckUsage(
  snapshots: GearSnapshot[],
  buffs: BuffInterval[],
  cfg: ConsumableConfig,
  bossFights: Map<number, Fight>,
): { usedOnFights: number; inactiveOnFights: number; equipped: boolean } {
  const neckByItemId = new Map(cfg.jcNecks.map((n) => [n.itemId, n]));
  let usedOnFights = 0;
  let inactiveOnFights = 0;
  let equipped = false;
  for (const snap of snapshots) {
    const neckItem = snap.items.find((i) => i.slot === NECK_SLOT);
    const neck = neckItem && neckByItemId.get(neckItem.itemId);
    if (!neck) continue;
    equipped = true;
    const used = buffs.some((b) => b.fightId === snap.fightId && b.spellId === neck.buffId);
    if (used) {
      usedOnFights += 1;
    } else if (!bossFights.get(snap.fightId)!.name.startsWith(JC_NECK_EXEMPT_PREFIX)) {
      inactiveOnFights += 1;
    }
  }
  return { usedOnFights, inactiveOnFights, equipped };
}

/** Distinct suboptimal names: matching buffs seen, or temp weapon enchants equipped. */
function suboptimalNames(buffs: BuffInterval[], snapshots: GearSnapshot[], cfg: ConsumableConfig): string[] {
  const usedBuffIds = new Set(buffs.map((b) => b.spellId));
  const tempEnchantIds = new Set(
    snapshots
      .map((s) => s.items.find((i) => i.slot === WEAPON_SLOT)?.temporaryEnchantId)
      .filter((id): id is number => id !== undefined),
  );
  const names: string[] = [];
  for (const entry of cfg.suboptimal) {
    const hit = entry.kind === "buff" ? usedBuffIds.has(entry.id) : tempEnchantIds.has(entry.id);
    if (hit && !names.includes(entry.name)) names.push(entry.name);
  }
  return names;
}

/**
 * Mean of [elixirOrFlask, food, weaponEnhancement]. Reverse-engineered from the
 * original's sample data: weaponEnhancement is excluded when it is null (no
 * gear info) OR 0 — e.g. elixirOrFlask 0.2, food 0.83, weaponEnh 0 yields
 * (0.2 + 0.83) / 2 = 0.515 in the original sheet, not /3.
 */
function totalAverage(elixirOrFlask: number, food: number, weaponEnhancement: number | null): number {
  const parts = [elixirOrFlask, food];
  if (weaponEnhancement !== null && weaponEnhancement !== 0) parts.push(weaponEnhancement);
  return parts.reduce((sum, v) => sum + v, 0) / parts.length;
}
