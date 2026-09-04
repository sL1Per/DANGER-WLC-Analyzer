import { useMemo } from "react";
import { rpb, consumables, gearIssues, type ReportData } from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { buildRpbConfig, consumablesConfig, gearIssueConfig } from "../../lib/analysisConfig";
import { buildFlags } from "../../lib/flags";
import { classColorVar } from "../../lib/classColors";

export function FlagsView({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);

  const summary = useMemo(() => {
    const rpbResult = rpb(scoped, buildRpbConfig());
    if (rpbResult === null) return null;
    const consRows = consumables(scoped, consumablesConfig)?.rows ?? [];
    const gearRows = gearIssues(scoped, gearIssueConfig);
    return buildFlags(rpbResult.rows, consRows, gearRows);
  }, [scoped]);

  if (summary === null) {
    return <p className="notice">This report was cached before RPB support — Refresh from WCL (requires credentials).</p>;
  }

  return (
    <div className="flags-view">
      <h2>Flags</h2>
      {summary.rows.length === 0 ? (
        <p className="notice">No flags — everyone's clean on this pull.</p>
      ) : (
        <>
          <p className="intro">{summary.flaggedCount} raider{summary.flaggedCount === 1 ? "" : "s"} flagged · {summary.majorCount} major</p>
          <div className="flaglist">
            {summary.rows.map((row) => (
              <div key={row.playerId} className={`flagrow flagrow--${row.severity}`} style={classColorVar(row.className)}>
                <div className="flagrow__who">
                  <span className="flagrow__cc" style={{ background: "var(--class-color, var(--text-subtle))" }} />
                  <button className="player-link flagrow__name" style={{ color: "var(--class-color, inherit)" }} onClick={() => onPlayer(row.playerName)}>
                    {row.playerName}
                  </button>
                  <span className="flagrow__role"> · {row.role}</span>
                </div>
                <div className="flagrow__chips">
                  {row.chips.map((chip, i) => (
                    <span key={i} className={`fchip ${chip.severity}`}>{chip.text}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
