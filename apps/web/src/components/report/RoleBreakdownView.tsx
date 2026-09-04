import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { detectRole, type ReportData, type Role } from "@wcl/core";
import { buildRpbConfig } from "../../lib/analysisConfig";
import { RoleSheetTable } from "./RoleSheetTable";
import { RoleCastsTable } from "./RoleCastsTable";

const MODES = [
  ["stats", "By Stats"],
  ["casts", "By Casts"],
] as const;
type Mode = (typeof MODES)[number][0];

const ROLES: readonly (readonly [Role, string])[] = [
  ["tank", "Tanks"],
  ["healer", "Healers"],
  ["caster", "Casters"],
  ["physical", "Melee/Ranged"],
];

const DEFAULT_MODE: Mode = "stats";
const DEFAULT_ROLE: Role = "tank";

export function RoleBreakdownView({
  report,
  fightId,
}: {
  report: ReportData;
  fightId: number;
}) {
  const [params, setParams] = useSearchParams();

  const requestedMode = (params.get("mode") ?? DEFAULT_MODE) as Mode;
  const mode: Mode = MODES.some(([key]) => key === requestedMode)
    ? requestedMode
    : DEFAULT_MODE;

  const requestedRole = (params.get("role") ?? DEFAULT_ROLE) as Role;
  const role: Role = ROLES.some(([key]) => key === requestedRole)
    ? requestedRole
    : DEFAULT_ROLE;

  const patch = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    setParams(p, { replace: false });
  };

  // Player count per role, for the role-tab badges (report-wide, like role detection).
  const roleCounts = useMemo(() => {
    const cfg = buildRpbConfig();
    const counts: Record<Role, number> = { tank: 0, healer: 0, caster: 0, physical: 0 };
    for (const p of report.players) counts[detectRole(p.id, report, cfg.roles)]++;
    return counts;
  }, [report]);

  return (
    <div className="role-breakdown-view">
      <nav className="cat-subnav role-subnav">
        {ROLES.map(([key, label]) => (
          <button
            key={key}
            className={role === key ? "active" : ""}
            onClick={() => patch({ role: key })}
          >
            {label}
            <span className="subnav-count" aria-hidden>{roleCounts[key]}</span>
          </button>
        ))}
      </nav>

      <div className="pill-toggle" role="group" aria-label="Breakdown mode">
        {MODES.map(([key, label]) => (
          <label key={key} className={mode === key ? "active" : ""}>
            <input
              type="radio"
              name="rb-mode"
              aria-label={label}
              checked={mode === key}
              onChange={() => patch({ mode: key })}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="role-breakdown-content">
        {mode === "casts" ? (
          <RoleCastsTable
            report={report}
            fightId={fightId}
            role={role}
          />
        ) : (
          <RoleSheetTable
            report={report}
            fightId={fightId}
            role={role}
          />
        )}
      </div>
    </div>
  );
}
