import { Fragment, useMemo, useState } from "react";
import { rpb, type Role, type ReportData, type RpbRow } from "@wcl/core";
import {
  spellCastTimes, roleSignals, casterClasses, hasteBuffs, engineeringDamageIds,
  oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
} from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";
import { loadRoleOverrides, saveRoleOverride } from "../lib/storage";

const ROLES: Role[] = ["tank", "healer", "caster", "physical"];
const sevClass = (s: RpbRow["severity"]) => (s === "ok" ? "sev-ok" : `sev-${s}`);
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function RpbView({ report }: { report: ReportData }) {
  const [, force] = useState(0);
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

  return (
    <div>
      <p><small>Roles are auto-detected and adjustable per character (saved in your browser). Kalecgos is excluded. Activity is spell-haste corrected; melee activity is approximate.</small></p>
      <SeverityLegend />
      {ROLES.map((role) => {
        const group = rows.filter((r) => r.role === role);
        if (group.length === 0) return null;
        return (
          <section key={role}>
            <h3 style={{ textTransform: "capitalize" }}>{role}</h3>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>player</th><th>role</th><th>deaths</th><th>interrupted</th>
                    <th>total dmg taken</th><th>friendly fire</th>
                    <th>engi dmg</th><th>oil dmg</th><th>shout uptime</th>
                    <th>active % (ST/AoE)</th><th>haste s saved</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((r) => (
                    <Fragment key={r.playerId}>
                      <tr className={sevClass(r.severity)}>
                        <td>{r.playerName}</td>
                        <td>
                          <label className="sr-only" htmlFor={`role-${r.playerId}`}>role for {r.playerName}</label>
                          <select
                            id={`role-${r.playerId}`}
                            aria-label={`role for ${r.playerName}`}
                            value={r.role}
                            onChange={(e) => { saveRoleOverride(r.playerName, e.target.value as Role); force((n) => n + 1); }}
                          >
                            {ROLES.map((ro) => <option key={ro} value={ro}>{ro}</option>)}
                          </select>
                        </td>
                        <td className={r.deaths > 0 ? "sev-major" : ""}>{r.deaths}</td>
                        <td>{r.interruptedSpells > 0 ? `${r.interruptedSpells} (${r.interruptSources.join(", ")})` : 0}</td>
                        <td title={`all boss damage taken: ${r.totalPartlyAvoidable.toLocaleString()}`}>{r.totalAvoidableDamageTaken.toLocaleString()}</td>
                        <td>{r.friendlyFire.toLocaleString()}</td>
                        <td>{r.engineeringDamage.toLocaleString()}</td>
                        <td>{r.oilOfImmolationDamage.toLocaleString()}</td>
                        <td>{pct(r.battleShoutUptime)}</td>
                        <td>{r.activity ? `${pct(r.activity.relativeActiveST)} / ${pct(r.activity.relativeActiveAoe)}` : "—"}</td>
                        <td>{r.activity ? r.activity.secondsSubtractedHaste.toFixed(1) : "—"}</td>
                      </tr>
                      {(r.classRows.length > 0 || r.totalAbsorbed > 0 || r.damageReflected > 0 || r.damageToHostilePlayers > 0) && (
                        <tr className="class-rows">
                          <td colSpan={11}>
                            <span className="sr-only">details for {r.playerName}: </span>
                            {r.totalAbsorbed > 0 && (
                              <span className="badge" style={{ marginRight: "0.75rem" }}>
                                absorbed: {r.totalAbsorbed.toLocaleString()}
                              </span>
                            )}
                            {r.damageReflected > 0 && (
                              <span className="badge" style={{ marginRight: "0.75rem" }} title="self/reflected damage (counts as done to self)">
                                reflected: {r.damageReflected.toLocaleString()}
                              </span>
                            )}
                            {r.damageToHostilePlayers > 0 && (
                              <span className="badge" style={{ marginRight: "0.75rem" }} title="damage to hostile players (PvP; counts as done to self)">
                                to hostile players: {r.damageToHostilePlayers.toLocaleString()}
                              </span>
                            )}
                            <ul className="class-ability-list">
                              {r.classRows.map((c) => (
                                <li key={c.key} className={sevClass(c.severity)}>
                                  {c.name}
                                  {c.measure === "cast-count"
                                    ? `: ${c.castCount}× `
                                    : `: ${pct(c.uptimePct ?? 0)} uptime `}
                                  {c.rankFlag && <span title="mostly a lower rank than optimal"> ⚠ low rank</span>}
                                  {!c.verified && <span className="badge" title="spell ids not yet Wowhead-verified"> unverified</span>}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <p><small>"Total dmg taken" shows avoidable damage from tracked abilities (hover for total). Class rows show per-class debuff/buff uptime and key casts; ⚠ flags a lower-than-optimal rank; "unverified" marks spell ids still pending Wowhead confirmation.</small></p>
    </div>
  );
}
