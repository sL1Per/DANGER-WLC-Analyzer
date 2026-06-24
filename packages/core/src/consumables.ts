import type { Fight, GearSnapshot, ReportData, Role } from "./types";
import { detectRole, type RoleConfig } from "./roles";
import type { IssueSeverity } from "./gearIssues";

/** Primary stat a consumable provides, for spec-aware suboptimal detection. */
export type SuboptimalStat = "strength" | "agility" | "spellDamage" | "spellHealing";

/** Classes whose physical/tank specs scale with Agility (not Strength). */
const AGILITY_CLASSES = new Set(["Rogue", "Hunter", "Shaman", "Druid"]);

/**
 * Stats a player's spec actually wants, so a consumable providing any *other*
 * stat is flagged as suboptimal. Caster→spellDamage, healer→spellHealing, and a
 * melee/tank wants Strength or Agility depending on class (a Warrior/Paladin
 * scales with Str; a Rogue/Hunter/Enhance shaman/Feral druid with Agi).
 */
function wantedStats(role: Role, cls: string): Set<SuboptimalStat> {
  if (role === "caster") return new Set(["spellDamage"]);
  if (role === "healer") return new Set(["spellHealing"]);
  return new Set([AGILITY_CLASSES.has(cls) ? "agility" : "strength"]);
}

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
  /**
   * Consumables/temp enchants that are the wrong choice, matching the original's
   * class-aware detection. A `stat` entry is flagged only when the player's spec
   * does not want that stat (e.g. a Strength elixir on an agility melee, a
   * spell-damage oil on a healer); an entry with no `stat` is "always" suboptimal
   * — strictly worse/outdated for everyone (e.g. Elixir of the Mongoose, a
   * generic Well Fed). See `wantedStats` for the per-spec stat mapping.
   */
  suboptimal: { kind: "buff" | "tempEnchant"; id: number; name: string; stat?: SuboptimalStat }[];
  /** role auto-detection config (shared with RPB), used to derive each player's wanted stats */
  roles: RoleConfig;
  /**
   * Enchant ids (combatantInfo `temporaryEnchant`) that count as a consumable
   * weapon enhancement. Whitelist — excludes shaman imbues, Windfury Totem and
   * rogue poisons, which WCL also reports in the same field. See @wcl/data.
   */
  weaponEnhancements: number[];
}

/** One player's row of the "buff consumables" sheet. All uptimes are 0–1 fractions of total boss-fight time. */
export interface ConsumableRow {
  playerId: number;
  playerName: string;
  /** max(flask, avg(battle, guardian)) — a flask = full credit, each elixir = half */
  elixirOrFlask: number;
  battleElixir: number;
  guardianElixir: number;
  flask: number;
  food: number;
  /** e.g. "83% (Agi*,Prot)"; "" when no scrolls were used */
  scrolls: string;
  scrollUptime: number;
  /** fraction of boss-fight snapshots with a consumable weapon enhancement; null = no gear snapshots at all */
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
 *
 * Elixirs/flask/food/scrolls are read from each boss fight's combatantInfo
 * *pull auras* (the original's source) — a column is "fights with the buff at
 * pull / boss-fight snapshots", count-based per fight. JC necks stay buff-based
 * (their on-use absorb is a transient combat proc, not a pull aura).
 *
 * Returns null when the report predates the buff/aura fetch (M3/M4) so the UI
 * can show a refresh notice instead of all-zero rows.
 */
export function consumables(report: ReportData, cfg: ConsumableConfig): { rows: ConsumableRow[] } | null {
  if (report.buffs === undefined) return null;

  const bossFights = new Map(report.fights.filter((f) => f.isBoss).map((f) => [f.id, f]));
  if (bossFights.size === 0) return { rows: [] };

  // Aura-based detection needs combatantInfo pull auras (captured since M4). A
  // report cached before that has gear but no auras → treat like a stale cache.
  const bossSnapshots = report.gear.filter((s) => bossFights.has(s.fightId));
  if (bossSnapshots.length > 0 && !bossSnapshots.some((s) => s.auras !== undefined)) return null;

  const idsByCategory = (category: ConsumableConfig["buffs"][number]["category"]) =>
    new Set(cfg.buffs.filter((b) => b.category === category).map((b) => b.spellId));
  const battleIds = idsByCategory("battleElixir");
  const guardianIds = idsByCategory("guardianElixir");
  const flaskIds = idsByCategory("flask");
  const foodIds = idsByCategory("food");
  const scrollIds = idsByCategory("scroll");

  const rows: ConsumableRow[] = [];
  for (const player of report.players) {
    const snapshots = report.gear.filter((s) => s.playerId === player.id && bossFights.has(s.fightId));
    // pull-aura snapshots drive elixir/flask/food/scroll presence
    const auraSnapshots = snapshots.filter((s) => s.auras !== undefined);
    const presence = (ids: Set<number>) => auraPresenceFraction(auraSnapshots, ids);

    const battleElixir = presence(battleIds);
    const guardianElixir = presence(guardianIds);
    const flask = presence(flaskIds);
    // A flask replaces both elixirs (full credit); two separate elixirs each
    // count as half, so a battle-only player is only half-covered. This is NOT a
    // union of the three: max(flask, avg(battle, guardian)).
    const elixirOrFlask = Math.max(flask, (battleElixir + guardianElixir) / 2);
    const food = presence(foodIds);
    const scrollUptime = presence(scrollIds);
    const weaponEnhancement = weaponEnhancementUptime(snapshots, cfg.weaponEnhancements);

    rows.push({
      playerId: player.id,
      playerName: player.name,
      elixirOrFlask,
      battleElixir,
      guardianElixir,
      flask,
      food,
      scrolls: formatScrolls(auraSnapshots, cfg, scrollUptime),
      scrollUptime,
      weaponEnhancement,
      jcNeck: jcNeckUsage(snapshots, cfg, bossFights),
      suboptimal: suboptimalNames(auraSnapshots, snapshots, cfg, wantedStats(detectRole(player.id, report, cfg.roles), player.class)),
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
 * Count-based per boss fight, from combatantInfo pull auras: the fraction of the
 * player's boss-fight snapshots whose pull auras include any of the given spell
 * ids. A flask present at pull on 2 of 3 boss fights is 0.67 — not its share of
 * total boss time (time-weighting was the bug this replaced). Denominator is the
 * snapshots we have auras for; a fight with no combatantInfo simply isn't data.
 */
function auraPresenceFraction(auraSnapshots: GearSnapshot[], ids: Set<number>): number {
  if (auraSnapshots.length === 0) return 0;
  let present = 0;
  for (const snap of auraSnapshots) {
    if (snap.auras!.some((spellId) => ids.has(spellId))) present += 1;
  }
  return present / auraSnapshots.length;
}

/**
 * Weapon enhancement is gear-based (combatantInfo), not buff-based, and counted
 * per boss fight (NOT time-weighted): the fraction of boss-fight snapshots whose
 * slot-15 item carries a *consumable* temporaryEnchantId (oil/stone/weightstone
 * — see `weaponEnhancements`). Non-consumable temp enchants WCL reports here
 * (shaman imbues, Windfury Totem on allies, rogue poisons) do not count. Null =
 * no snapshots at all (gear info missing — distinct from "had no enhancement").
 */
function weaponEnhancementUptime(snapshots: GearSnapshot[], weaponEnhancements: number[]): number | null {
  if (snapshots.length === 0) return null;
  const enhancementIds = new Set(weaponEnhancements);
  let enhanced = 0;
  for (const snap of snapshots) {
    const weapon = snap.items.find((i) => i.slot === WEAPON_SLOT);
    if (weapon && weapon.temporaryEnchantId !== undefined && enhancementIds.has(weapon.temporaryEnchantId)) {
      enhanced += 1;
    }
  }
  return enhanced / snapshots.length;
}

/** "83% (Agi*,Prot)" — types alphabetical, * when any used scroll of the type is below level 5. */
function formatScrolls(auraSnapshots: GearSnapshot[], cfg: ConsumableConfig, scrollUptime: number): string {
  if (scrollUptime <= 0) return "";
  const usedIds = new Set(auraSnapshots.flatMap((s) => s.auras!));
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
  cfg: ConsumableConfig,
  bossFights: Map<number, Fight>,
): { usedOnFights: number; inactiveOnFights: number; equipped: boolean } {
  const jcItemIds = new Set(cfg.jcNecks.map((n) => n.itemId));
  const jcBuffIds = new Set(cfg.jcNecks.map((n) => n.buffId));
  // The on-use buff lasts 30 min, so players trigger it pre-pull and swap to a
  // main neck — the buff is in the combatantInfo pull auras even though the JC
  // neck is no longer equipped. "used" = fights the buff is up; "inactive" =
  // fights the player never swapped (still wearing the JC neck → wasted stats).
  // The two are independent counts: wearing the neck means the buff is up too.
  let usedOnFights = 0;
  let inactiveOnFights = 0;
  for (const snap of snapshots) {
    if ((snap.auras ?? []).some((a) => jcBuffIds.has(a))) usedOnFights += 1;
    const neckItem = snap.items.find((i) => i.slot === NECK_SLOT);
    if (neckItem && jcItemIds.has(neckItem.itemId)
      && !bossFights.get(snap.fightId)!.name.startsWith(JC_NECK_EXEMPT_PREFIX)) {
      inactiveOnFights += 1;
    }
  }
  return { usedOnFights, inactiveOnFights, equipped: usedOnFights > 0 || inactiveOnFights > 0 };
}

/**
 * Distinct suboptimal names: matching pull-aura buffs, or temp weapon enchants
 * equipped. Spec-aware — a `stat` entry is flagged only when the player's spec
 * does not want that stat (`wanted`); an entry without a `stat` is always
 * suboptimal (strictly worse / outdated for everyone).
 */
function suboptimalNames(auraSnapshots: GearSnapshot[], snapshots: GearSnapshot[], cfg: ConsumableConfig, wanted: Set<SuboptimalStat>): string[] {
  const usedBuffIds = new Set(auraSnapshots.flatMap((s) => s.auras!));
  const tempEnchantIds = new Set(
    snapshots
      .map((s) => s.items.find((i) => i.slot === WEAPON_SLOT)?.temporaryEnchantId)
      .filter((id): id is number => id !== undefined),
  );
  const names: string[] = [];
  for (const entry of cfg.suboptimal) {
    if (entry.stat && wanted.has(entry.stat)) continue; // the player's spec wants this stat — fine
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
