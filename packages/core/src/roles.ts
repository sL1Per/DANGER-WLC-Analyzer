import type { Role, ReportData } from "./types";

export interface RoleSignal { spellId: number; role: Role; name: string; }
export interface RoleConfig { signals: RoleSignal[]; }

/** Thresholds (fractions of total output), tuned during E2E. */
const HEALER_HEALING_SHARE = 0.4;
const TANK_TAKEN_SHARE = 0.5; // damage taken / (damage taken + damage done)
const CASTER_MAGIC_SHARE = 0.5; // magic damage / damage done

/**
 * Auto-detect a player's role. Order: a tank aura/cast signal combined with a
 * high damage-taken share wins; otherwise output ratios decide healer/caster/
 * physical; ambiguous -> physical. Manual override is applied by the caller.
 */
export function detectRole(playerId: number, report: ReportData, cfg: RoleConfig): Role {
  const totals = report.playerTotals?.find((t) => t.playerId === playerId);
  if (!totals) return "physical";

  const output = totals.healingDone + totals.damageDone;
  // Healer: meaningful healing share is the strongest signal.
  if (output > 0 && totals.healingDone / output >= HEALER_HEALING_SHARE) return "healer";

  // Tank: a tank signal aura/cast AND a high damage-taken share.
  const hasTankSignal = report.gear?.some(
    (g) => g.playerId === playerId
      && (g.auras ?? []).some((a) => cfg.signals.some((s) => s.spellId === a && s.role === "tank")),
  ) ?? false;
  const takenShare = totals.damageTaken / (totals.damageTaken + totals.damageDone || 1);
  if (hasTankSignal && takenShare >= TANK_TAKEN_SHARE) return "tank";

  // Caster vs physical by magic share of damage done.
  if (totals.damageDone > 0 && totals.magicDamageDone / totals.damageDone >= CASTER_MAGIC_SHARE) {
    return "caster";
  }
  if (totals.damageDone > 0) return "physical";
  return "physical";
}
