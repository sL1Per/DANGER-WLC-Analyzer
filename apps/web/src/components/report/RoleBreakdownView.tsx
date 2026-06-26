import { useSearchParams } from "react-router-dom";
import type { ReportData, Role } from "@wcl/core";
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
  onPlayer,
}: {
  report: ReportData;
  fightId: number;
  onPlayer: (name: string) => void;
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

  return (
    <div className="role-breakdown-view">
      <div className="segmented" role="group" aria-label="Breakdown mode">
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

      <nav className="cat-subnav">
        {ROLES.map(([key, label]) => (
          <button
            key={key}
            className={role === key ? "active" : ""}
            onClick={() => patch({ role: key })}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="role-breakdown-content">
        {mode === "casts" ? (
          <RoleCastsTable
            report={report}
            fightId={fightId}
            role={role}
            onPlayer={onPlayer}
          />
        ) : (
          <RoleSheetTable
            report={report}
            fightId={fightId}
            role={role}
            onPlayer={onPlayer}
          />
        )}
      </div>
    </div>
  );
}
