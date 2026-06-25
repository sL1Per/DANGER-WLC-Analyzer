import { useSearchParams } from "react-router-dom";
import type { ReportData, Role } from "@wcl/core";
import { ALL_FIGHTS } from "../../lib/scopeReport";
import { SummaryView } from "./SummaryView";
import { RoleSheetTable } from "./RoleSheetTable";
import { RoleCastsTable } from "./RoleCastsTable";

const SUBS = [
  ["overview", "Overview"],
  ["tank", "Tank"],
  ["tank-casts", "Tank - Casts"],
  ["healer", "Healer"],
  ["healer-casts", "Healer - Casts"],
  ["caster", "Caster"],
  ["caster-casts", "Caster - Casts"],
  ["physical", "Physical"],
  ["physical-casts", "Physical - Casts"],
] as const;

type SubKey = (typeof SUBS)[number][0];
type SubEntry = readonly [SubKey, string];

/** Map sub key → role (for role and casts subs). */
const SUB_TO_ROLE: Partial<Record<SubKey, Role>> = {
  tank: "tank",
  "tank-casts": "tank",
  healer: "healer",
  "healer-casts": "healer",
  caster: "caster",
  "caster-casts": "caster",
  physical: "physical",
  "physical-casts": "physical",
};

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

  // Only the combined BOSSES card (ALL_FIGHTS) shows role/casts sub-tabs.
  const bossesCard = fightId === ALL_FIGHTS;
  const visibleSubs: readonly SubEntry[] = bossesCard ? SUBS : [SUBS[0]];

  const requestedSub = (params.get("sub") ?? "overview") as SubKey;
  // If the current sub is not visible (e.g. switching from bosses card to single
  // pull), fall back to overview.
  const sub: SubKey = visibleSubs.some(([key]) => key === requestedSub)
    ? requestedSub
    : "overview";

  const patch = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    setParams(p, { replace: false });
  };

  return (
    <div className="role-breakdown-view">
      <nav className="cat-subnav">
        {visibleSubs.map(([key, label]) => (
          <button
            key={key}
            className={sub === key ? "active" : ""}
            onClick={() => patch({ sub: key })}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="role-breakdown-content">
        {sub === "overview" && (
          <SummaryView report={report} fightId={fightId} onPlayer={onPlayer} />
        )}
        {sub !== "overview" && !sub.endsWith("-casts") && SUB_TO_ROLE[sub] && (
          <RoleSheetTable
            report={report}
            fightId={fightId}
            role={SUB_TO_ROLE[sub]!}
            onPlayer={onPlayer}
          />
        )}
        {sub.endsWith("-casts") && SUB_TO_ROLE[sub] && (
          <RoleCastsTable
            report={report}
            fightId={fightId}
            role={SUB_TO_ROLE[sub]!}
            onPlayer={onPlayer}
          />
        )}
      </div>
    </div>
  );
}
