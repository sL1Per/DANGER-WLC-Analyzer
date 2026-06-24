import { useMemo } from "react";
import { roleSheet, type ReportData, type Role } from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { roleSheetConfig } from "../../lib/analysisConfig";
import { heatClass, relativeHeat, deathsHeat } from "../../lib/heatmap";
import { classColorVar } from "../../lib/classColors";

const fmt = (count: number, pct: number) =>
  count === 0 ? "—" : `${count} (${Math.round(pct * 100)}%)`;

const fmtNum = (n: number) => (n === 0 ? "—" : n.toLocaleString());

export function RoleSheetTable({
  report,
  fightId,
  role,
  onPlayer,
}: {
  report: ReportData;
  fightId: number;
  role: Role;
  onPlayer: (name: string) => void;
}) {
  const scoped = useMemo(
    () => scopeReportToFight(report, fightId),
    [report, fightId],
  );
  const rows = useMemo(
    () => roleSheet(scoped, role, roleSheetConfig()),
    [scoped, role],
  );

  if (rows === null) {
    return (
      <p className="notice">
        This report was cached before RPB support — Refresh from WCL (requires
        credentials).
      </p>
    );
  }

  if (rows.length === 0) {
    return <p className="notice">No {role} players found in this report.</p>;
  }

  // relative heat scales for avoidable damage (per-role)
  const avoidVals = rows.map((r) => r.totalAvoidableDamageTaken);
  const aMin = Math.min(...avoidVals, 0);
  const aMax = Math.max(...avoidVals, 0);

  return (
    <div className="scroll-x">
      <table className="role-sheet-table">
        <thead>
          <tr>
            {/* Player column */}
            <th rowSpan={2}>Player</th>

            {/* Section band headers */}
            <th colSpan={7} className="band-header">
              Stats &amp; Misc
            </th>
            <th colSpan={1} className="band-header">
              Trinkets &amp; Racials
            </th>
            <th colSpan={6} className="band-header">
              Raw avoidable damage taken by tracked abilities
            </th>
            <th colSpan={1} className="band-header">
              Avoidable debuffs applied by tracked abilities
            </th>
          </tr>
          <tr>
            {/* Stats & Misc sub-headers */}
            <th>Out: Crit</th>
            <th>Out: Dodge</th>
            <th>Out: Miss</th>
            <th>Out: Parry</th>
            <th>Out: Resist</th>
            <th>In: Crit</th>
            <th>In: Crushing</th>
            {/* (remaining incoming columns) */}
            {/* We'll merge the rest of incoming into the band — but keep it one row */}
            {/* Trinkets */}
            <th>Trinkets / Racials</th>
            {/* Avoidable */}
            <th className="col-deaths"># of deaths in total</th>
            <th>Total (partly) avoidable damage taken</th>
            <th>Friendly Fire</th>
            <th>Damage Reflected</th>
            <th>Damage to Hostile Players</th>
            <th>By Ability</th>
            {/* Debuffs */}
            <th>Debuffs Applied</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hs = r.hitStats;
            const out = hs?.outgoing;
            const inc = hs?.incomingMelee;

            const trinketCell =
              r.trinketUses.length === 0
                ? "—"
                : r.trinketUses.map((t) => `${t.name} ×${t.count}`).join(", ");

            const avoidAbilityCell =
              r.avoidableByAbility.length === 0
                ? "—"
                : r.avoidableByAbility
                    .map((a) => `${a.name}: ${a.amount.toLocaleString()}`)
                    .join("; ");

            const debuffCell =
              r.debuffsApplied.length === 0
                ? "—"
                : r.debuffsApplied
                    .map((d) => `${d.name} ×${d.count}`)
                    .join(", ");

            return (
              <tr key={r.playerId}>
                {/* Player */}
                <td className="player-cell" style={classColorVar(r.className)}>
                  <button
                    className="player-link"
                    onClick={() => onPlayer(r.playerName)}
                  >
                    {r.playerName}
                  </button>
                </td>

                {/* Stats & Misc — outgoing */}
                <td className="mono">
                  {out ? fmt(out.crit.count, out.crit.pct) : "—"}
                </td>
                <td className="mono">
                  {out ? fmt(out.dodge.count, out.dodge.pct) : "—"}
                </td>
                <td className="mono">
                  {out ? fmt(out.miss.count, out.miss.pct) : "—"}
                </td>
                <td className="mono">
                  {out ? fmt(out.parry.count, out.parry.pct) : "—"}
                </td>
                <td className="mono">
                  {out ? fmt(out.resist.count, out.resist.pct) : "—"}
                </td>
                {/* incoming */}
                <td className="mono">
                  {inc ? fmt(inc.crit.count, inc.crit.pct) : "—"}
                </td>
                <td className="mono">
                  {inc ? fmt(inc.crushing.count, inc.crushing.pct) : "—"}
                </td>

                {/* Trinkets */}
                <td>{trinketCell}</td>

                {/* Avoidable section */}
                <td className={heatClass(deathsHeat(r.deaths))}>{r.deaths}</td>
                <td
                  className={`mono ${heatClass(
                    relativeHeat(
                      aMax - r.totalAvoidableDamageTaken,
                      0,
                      aMax - aMin,
                    ),
                  )}`}
                >
                  {r.totalAvoidableDamageTaken.toLocaleString()}
                </td>
                <td className="mono">{fmtNum(r.friendlyFire)}</td>
                <td className="mono">{fmtNum(r.damageReflected)}</td>
                <td className="mono">{fmtNum(r.damageToHostilePlayers)}</td>
                <td>{avoidAbilityCell}</td>

                {/* Debuffs */}
                <td>{debuffCell}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
