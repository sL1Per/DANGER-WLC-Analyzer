import type { RpbRow, ConsumableRow, PlayerGearIssues, Role } from "@wcl/core";

export type FlagSeverity = "major" | "moderate";

export interface FlagChip {
  text: string;
  severity: FlagSeverity;
}

export interface PlayerFlags {
  playerId: number;
  playerName: string;
  className: string;
  role: Role;
  severity: FlagSeverity;
  chips: FlagChip[];
}

export interface FlagsSummary {
  rows: PlayerFlags[];
  flaggedCount: number;
  majorCount: number;
}

const FLASK_MAJOR_BELOW = 0.5;
const FLASK_MODERATE_BELOW = 0.9;
const FOOD_MAJOR_BELOW = 0.5;
const FOOD_MODERATE_BELOW = 0.9;
const WEAPON_OIL_MAJOR_BELOW = 0.5;
const BATTLE_SHOUT_MODERATE_BELOW = 0.7;
const AVOIDABLE_DAMAGE_THRESHOLD = 20000;
const ROLES_EXPECTED_TO_INTERRUPT: ReadonlySet<Role> = new Set(["physical", "caster"]);

function consumableChips(row: ConsumableRow | undefined): FlagChip[] {
  if (!row) return [];
  const chips: FlagChip[] = [];

  if (row.elixirOrFlask < FLASK_MAJOR_BELOW) chips.push({ text: "No flask", severity: "major" });
  else if (row.elixirOrFlask < FLASK_MODERATE_BELOW) chips.push({ text: "Flask below target", severity: "moderate" });

  if (row.food < FOOD_MAJOR_BELOW) chips.push({ text: "Food ✗", severity: "major" });
  else if (row.food < FOOD_MODERATE_BELOW) chips.push({ text: "Food below target", severity: "moderate" });

  if (row.weaponEnhancement !== null && row.weaponEnhancement < WEAPON_OIL_MAJOR_BELOW) {
    chips.push({ text: "No weapon oil", severity: "major" });
  }

  return chips;
}

function rpbChips(row: RpbRow): FlagChip[] {
  const chips: FlagChip[] = [];

  if (row.battleShoutUptime < BATTLE_SHOUT_MODERATE_BELOW) {
    chips.push({ text: `Battle Shout uptime ${Math.round(row.battleShoutUptime * 100)}%`, severity: "moderate" });
  }

  if (row.interruptedSpells === 0 && ROLES_EXPECTED_TO_INTERRUPT.has(row.role)) {
    chips.push({ text: "0 interrupts", severity: "moderate" });
  }

  if (row.deaths > 0) {
    chips.push({ text: `${row.deaths} death${row.deaths === 1 ? "" : "s"}`, severity: "moderate" });
  }

  if (row.totalAvoidableDamageTaken > AVOIDABLE_DAMAGE_THRESHOLD) {
    chips.push({ text: `${row.totalAvoidableDamageTaken.toLocaleString()} avoidable damage taken`, severity: "moderate" });
  }

  return chips;
}

function gearChips(row: PlayerGearIssues | undefined): FlagChip[] {
  if (!row || row.issues.length === 0) return [];
  return [{
    text: `${row.issues.length} gear flag${row.issues.length === 1 ? "" : "s"}`,
    severity: "moderate",
  }];
}

/**
 * Roster-wide "who missed something" rollup for the Flags tab — composes the
 * existing RPB / consumables / gear-issue analyzer outputs (already scoped to
 * a fight by the caller, same as every other report tab) into a short,
 * worst-first list of per-player chips. A player with no chips is omitted.
 */
export function buildFlags(
  rpbRows: RpbRow[],
  consumableRows: ConsumableRow[],
  gearIssueRows: PlayerGearIssues[],
): FlagsSummary {
  const consByPlayer = new Map(consumableRows.map((r) => [r.playerId, r]));
  const gearByPlayer = new Map(gearIssueRows.map((r) => [r.playerId, r]));

  const rows: PlayerFlags[] = [];
  for (const rpbRow of rpbRows) {
    const gearRow = gearByPlayer.get(rpbRow.playerId);
    const chips = [
      ...rpbChips(rpbRow),
      ...consumableChips(consByPlayer.get(rpbRow.playerId)),
      ...gearChips(gearRow),
    ];
    if (chips.length === 0) continue;

    const hasGearMajor = gearRow && gearRow.issues.some((i) => i.severity === "major");
    const severity: FlagSeverity =
      rpbRow.severity === "major" || hasGearMajor || chips.some((c) => c.severity === "major") ? "major" : "moderate";

    rows.push({
      playerId: rpbRow.playerId,
      playerName: rpbRow.playerName,
      className: rpbRow.className,
      role: rpbRow.role,
      severity,
      chips,
    });
  }

  rows.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "major" ? -1 : 1;
    return b.chips.length - a.chips.length;
  });

  return {
    rows,
    flaggedCount: rows.length,
    majorCount: rows.filter((r) => r.severity === "major").length,
  };
}
