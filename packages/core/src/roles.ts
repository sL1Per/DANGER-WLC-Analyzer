import type { Role, ReportData } from "./types";

export interface RoleSignal { spellId: number; role: Role; name: string; }
export interface RoleConfig {
  signals: RoleSignal[];
  /** class names whose DPS spec is spell-based; every other DPS class → physical */
  casterClasses: string[];
  /** WCL spec names that are physical DPS despite a caster class default
   *  (e.g. "Enhancement" shaman). Resolved from rankings spec when available. */
  physicalSpecs: string[];
  /** WCL spec names that are caster DPS despite a physical class default
   *  (e.g. "Balance" druid). Resolved from rankings spec when available. */
  casterSpecs: string[];
}

/** Thresholds (fractions of total output), tuned during E2E. */
const HEALER_HEALING_SHARE = 0.4;
const TANK_TAKEN_SHARE = 0.5; // damage taken / (damage taken + damage done)

/** A player's WCL spec, read from the rankings parse data (keyed by name). */
function specOf(playerName: string, report: ReportData): string | undefined {
  for (const r of report.rankings ?? []) {
    for (const ch of [...r.dps, ...r.healers, ...r.tanks]) {
      if (ch.name === playerName && ch.spec) return ch.spec;
    }
  }
  return undefined;
}

/**
 * Auto-detect a player's role. Order: healer (healing share) → tank (a tank
 * aura/cast signal + a high damage-taken share) → caster/physical.
 *
 * The caster/physical split is CLASS-based because WCL summary tables expose no
 * damage-school breakdown (the table `type` field is the actor's class, not a
 * school — confirmed in E2E: a school-based split mislabelled every DPS as a
 * caster). When the WCL rankings expose a spec, hybrid DPS specs that break the
 * class default — a physical spec on a caster class (enhancement shaman) or a
 * caster spec on a physical class (balance druid) — are corrected via
 * cfg.physicalSpecs / cfg.casterSpecs; otherwise the caller's manual override applies.
 */
export function detectRole(playerId: number, report: ReportData, cfg: RoleConfig): Role {
  const player = report.players.find((p) => p.id === playerId);
  const spec = player ? specOf(player.name, report) : undefined;
  const byClass: Role =
    spec && cfg.physicalSpecs.includes(spec) ? "physical"
      : spec && cfg.casterSpecs.includes(spec) ? "caster"
        : player && cfg.casterClasses.includes(player.class) ? "caster" : "physical";

  const totals = report.playerTotals?.find((t) => t.playerId === playerId);
  if (!totals) return byClass;

  // Healer: meaningful healing share is the strongest signal.
  const output = totals.healingDone + totals.damageDone;
  if (output > 0 && totals.healingDone / output >= HEALER_HEALING_SHARE) return "healer";

  // Tank: a tank signal aura/cast AND a high damage-taken share.
  const hasTankSignal = report.gear?.some(
    (g) => g.playerId === playerId
      && (g.auras ?? []).some((a) => cfg.signals.some((s) => s.spellId === a && s.role === "tank")),
  ) ?? false;
  const takenShare = totals.damageTaken / (totals.damageTaken + totals.damageDone || 1);
  if (hasTankSignal && takenShare >= TANK_TAKEN_SHARE) return "tank";

  return byClass;
}
