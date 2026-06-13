import type { ReportData } from "./types";
import type { IssueSeverity } from "./gearIssues";

export type BossRequirement =
  | { kind: "single"; count: number }
  | { kind: "split"; count1: number; label1: string; count2: number; label2: string };

export interface ZoneValidation {
  zone: string;
  trash: { name: string; npcIds: number[]; minKills: number }[];
  boss: BossRequirement;
  startingPointNpcIds: number[];
  verified: boolean;
}

export interface ValidateConfig {
  rules: ZoneValidation[];
  /** full WCL zone name → short code used in `rules` */
  zoneCodeByName: Record<string, string>;
}

export interface ValidateTrashRow {
  name: string; minKills: number; killed: number; enough: boolean; severity: IssueSeverity;
}
export interface ValidateResult {
  zone: string;
  zoneVerified: boolean;
  unsupportedZone: boolean;
  trash: ValidateTrashRow[];
  bosses: { required: string; killed: number; enough: boolean; severity: IssueSeverity };
  validStartingPoint: boolean;
  totalCharacters: number;
  isValid: boolean;
}

const sev = (ok: boolean): IssueSeverity => (ok ? "minor" : "major");

/**
 * CLA `validate`: check a report against per-zone speedrun requirements.
 * Whole-report (a speedrun log is validated end to end, like the original).
 * Returns null when the report predates M4 (no kill data) so the view can show
 * a refresh notice instead of all-zero rows.
 */
export function validate(
  report: ReportData,
  cfg: ValidateConfig,
  opts?: { zoneOverride?: string },
): ValidateResult | null {
  if (report.npcKills === undefined) return null;

  const zone = opts?.zoneOverride ?? cfg.zoneCodeByName[report.zoneName] ?? report.zoneName;
  const rule = cfg.rules.find((r) => r.zone === zone);
  const totalCharacters = report.players.length;

  if (!rule) {
    return {
      zone, zoneVerified: false, unsupportedZone: true,
      trash: [], bosses: { required: "?", killed: 0, enough: false, severity: "major" },
      validStartingPoint: false, totalCharacters, isValid: false,
    };
  }

  const kills = report.npcKills;
  const trash: ValidateTrashRow[] = rule.trash.map((t) => {
    const killed = t.npcIds.reduce((sum, id) => sum + (kills[String(id)] ?? 0), 0);
    const enough = killed >= t.minKills;
    return { name: t.name, minKills: t.minKills, killed, enough, severity: sev(enough) };
  });

  const bossKills = report.fights.filter((f) => f.isBoss && f.kill === true).length;
  let bosses: ValidateResult["bosses"];
  if (rule.boss.kind === "single") {
    const enough = bossKills >= rule.boss.count;
    bosses = { required: String(rule.boss.count), killed: bossKills, enough, severity: sev(enough) };
  } else {
    // split rule = a COMBINED two-zone run (e.g. MH+BT); we check the total
    // boss kills against count1+count2. Only meaningful on a combined log, not
    // a single-zone report (where the total is unreachable).
    const need = rule.boss.count1 + rule.boss.count2;
    const enough = bossKills >= need;
    bosses = {
      required: `${rule.boss.count1} for ${rule.boss.label1} and ${rule.boss.count2} for ${rule.boss.label2}`,
      killed: bossKills, enough, severity: sev(enough),
    };
  }

  const firstPull = report.firstPullNpcIds ?? [];
  const validStartingPoint = firstPull.some((id) => rule.startingPointNpcIds.includes(id));

  const isValid = trash.every((t) => t.enough) && bosses.enough && validStartingPoint;
  return {
    zone, zoneVerified: rule.verified, unsupportedZone: false,
    trash, bosses, validStartingPoint, totalCharacters, isValid,
  };
}
