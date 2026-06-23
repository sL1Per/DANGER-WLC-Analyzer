import { useMemo, useState } from "react";
import { rpb, rpbConsumables, type Role, type ReportData } from "@wcl/core";
import {
  spellCastTimes, roleSignals, casterClasses, physicalSpecs, casterSpecs, hasteBuffs, engineeringDamageIds,
  oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
  rpbConsumables as rpbConsumablesData,
} from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";
import { RpbRowsView } from "./RpbRowsView";
import { RpbCardsView } from "./RpbCardsView";
import { ConsumableMatrix } from "./ConsumableMatrix";
import { groupByClass } from "../lib/rpbGrouping";
import {
  loadRoleOverrides, saveRoleOverride,
  loadRpbViewMode, saveRpbViewMode, type RpbViewMode,
  loadRpbTab, saveRpbTab, type RpbTab,
} from "../lib/storage";

const ROLES: Role[] = ["tank", "healer", "caster", "physical"];
const REFRESH_NOTICE = "This report was cached before RPB support — refresh it from WCL (requires credentials).";

export function RpbView({ report }: { report: ReportData }) {
  const [, force] = useState(0);
  const [tab, setTab] = useState<RpbTab>(() => loadRpbTab());
  const [view, setView] = useState<RpbViewMode>(() => loadRpbViewMode());
  const overrides = loadRoleOverrides();

  const result = useMemo(() => rpb(report, {
    roles: { signals: roleSignals, casterClasses, physicalSpecs, casterSpecs },
    activity: { castTimes: spellCastTimes, hasteBuffs, aoeWindowMs: 500 },
    engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
    classAbilities, avoidableAbilityIds,
  }), [report]);
  const consumables = useMemo(() => rpbConsumables(report, rpbConsumablesData), [report]);

  const selectTab = (t: RpbTab) => { setTab(t); saveRpbTab(t); };

  return (
    <div>
      <div className="segmented" role="group" aria-label="RPB section">
        {(["general", "roles"] as const).map((t) => (
          <label key={t} className={tab === t ? "active" : ""}>
            <input
              type="radio"
              name="rpb-tab"
              aria-label={`${t} tab`}
              checked={tab === t}
              onChange={() => selectTab(t)}
            />
            {t}
          </label>
        ))}
      </div>

      {tab === "general"
        ? <GeneralTab consumables={consumables} />
        : <RolesTab
            result={result}
            overrides={overrides}
            view={view}
            setView={setView}
            force={force}
          />}
    </div>
  );
}

function GeneralTab({ consumables }: { consumables: ReturnType<typeof rpbConsumables> }) {
  if (consumables === null) return <p>{REFRESH_NOTICE}</p>;
  const catalog = rpbConsumablesData.map((c) => ({ key: c.key, name: c.name }));
  return (
    <div>
      <p><small>Per-player consumable use counts on boss fights (Kalecgos excluded). Each row is a relative heatmap across the raid: green = top user, red = least. An all-zero row (nobody used it) stays neutral.</small></p>
      <ConsumableMatrix rows={consumables.rows} catalog={catalog} />
    </div>
  );
}

function RolesTab({
  result, overrides, view, setView, force,
}: {
  result: ReturnType<typeof rpb>;
  overrides: Record<string, Role>;
  view: RpbViewMode;
  setView: (m: RpbViewMode) => void;
  force: (fn: (n: number) => number) => void;
}) {
  if (result === null) return <p>{REFRESH_NOTICE}</p>;

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
