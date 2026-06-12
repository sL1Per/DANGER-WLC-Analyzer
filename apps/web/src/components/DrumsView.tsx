import { useMemo } from "react";
import { drums, type DrumKindStats, type ReportData } from "@wcl/core";
import { drumSpells } from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";

function KindCell({ stats }: { stats: DrumKindStats }) {
  return <td>{stats.casts > 0 ? `${stats.casts} (⌀ ${stats.avgBuffs.toFixed(2)})` : ""}</td>;
}

export function DrumsView({ report }: { report: ReportData }) {
  const result = useMemo(() => drums(report, { drums: drumSpells }), [report]);

  if (result === null) {
    return <p>This report was cached before drum support — refresh it from WCL (requires credentials).</p>;
  }
  if (result.rows.length === 0) {
    return <p>No drums were used in this report.</p>;
  }
  const lesserRows = result.rows.filter((r) => r.lesserCasts > 0);
  const totalLesser = lesserRows.reduce((sum, r) => sum + r.lesserCasts, 0);
  return (
    <div>
      <p><small>⌀ = average buffs per drum. Drums cast while every nearby raider still had the Tinnitus debuff buffed nobody — those casts are wasted.</small></p>
      <SeverityLegend />
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>player</th>
              <th># of battle drums</th>
              <th># of war drums</th>
              <th># of restoration drums</th>
              <th># of drums on Tinnitus</th>
              <th># of drums total</th>
              <th>buffs per drum (⌀)</th>
              <th>weighted score</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.playerId}>
                <td>{r.playerName}</td>
                <KindCell stats={r.battle} />
                <KindCell stats={r.war} />
                <KindCell stats={r.restoration} />
                <td className={r.wasted > 0 ? "sev-major" : ""}>{r.wasted}</td>
                <td>{r.total}</td>
                <td>{r.avgBuffsPerDrum.toFixed(2)}</td>
                <td>{r.weightedScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lesserRows.length > 0 && (
        <p className="sev-moderate">
          Used the lesser (non-Greater) version of these drums {totalLesser} times across {lesserRows.length} player(s).
        </p>
      )}
    </div>
  );
}
