import { useMemo, useState } from "react";
import { rpb, type Role, type ReportData } from "@wcl/core";
import {
  spellCastTimes, roleSignals, casterClasses, hasteBuffs, engineeringDamageIds,
  oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
} from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";
import { RpbRowsView } from "./RpbRowsView";
import { RpbCardsView } from "./RpbCardsView";
import { groupByClass } from "../lib/rpbGrouping";
import {
  loadRoleOverrides, saveRoleOverride,
  loadRpbViewMode, saveRpbViewMode, type RpbViewMode,
} from "../lib/storage";

const ROLES: Role[] = ["tank", "healer", "caster", "physical"];

export function RpbView({ report }: { report: ReportData }) {
  const [, force] = useState(0);
  const [view, setView] = useState<RpbViewMode>(() => loadRpbViewMode());
  const overrides = loadRoleOverrides();
  const result = useMemo(() => rpb(report, {
    roles: { signals: roleSignals, casterClasses },
    activity: { castTimes: spellCastTimes, hasteBuffs, aoeWindowMs: 500 },
    engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
    classAbilities, avoidableAbilityIds,
  }), [report]);

  if (result === null) {
    return <p>This report was cached before RPB support — refresh it from WCL (requires credentials).</p>;
  }

  // apply per-character overrides on top of auto-detected roles
  const rows = result.rows.map((r) => ({ ...r, role: overrides[r.playerName] ?? r.role }));

  const onRoleChange = (playerName: string, role: Role) => {
    saveRoleOverride(playerName, role);
    force((n) => n + 1);
  };
  const setMode = (m: RpbViewMode) => {
    setView(m);
    saveRpbViewMode(m);
  };

  return (
    <div>
      <p><small>Roles are auto-detected and adjustable per character (saved in your browser). Players are grouped and colored by class. Kalecgos is excluded. Activity is spell-haste corrected; melee activity is approximate.</small></p>

      <div className="segmented" role="group" aria-label="View mode">
        {(["rows", "cards"] as const).map((m) => (
          <label key={m} className={view === m ? "active" : ""}>
            <input
              type="radio"
              name="rpb-view"
              aria-label={`${m} view`}
              checked={view === m}
              onChange={() => setMode(m)}
            />
            {m}
          </label>
        ))}
      </div>

      <SeverityLegend />

      {ROLES.map((role) => {
        const group = rows.filter((r) => r.role === role);
        if (group.length === 0) return null;
        const groups = groupByClass(group);
        return (
          <details key={role} className="role-section" open>
            <summary>
              <h3 style={{ textTransform: "capitalize" }}>{role}</h3>
              <span className="role-count">{group.length}</span>
            </summary>
            {view === "rows"
              ? <RpbRowsView groups={groups} onRoleChange={onRoleChange} />
              : <RpbCardsView groups={groups} onRoleChange={onRoleChange} />}
          </details>
        );
      })}

      <p><small>Heatmap: green = good, yellow = watch, red = problem. "Total dmg taken" shows avoidable damage from tracked abilities (hover for total); ⚠ flags a lower-than-optimal rank; class abilities still pending Wowhead confirmation are marked on hover.</small></p>
    </div>
  );
}
