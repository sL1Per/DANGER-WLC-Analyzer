import { useMemo } from "react";
import type { ReportData } from "@wcl/core";
import { buildFlags } from "../../lib/flags";
import { classColorVar } from "../../lib/classColors";
import { useFightAnalysis } from "../../lib/useFightAnalysis";

export function FlagsView({ report, fightId }: { report: ReportData; fightId: number }) {
  const { rpbRows, consRows, gearRows } = useFightAnalysis(report, fightId);

  const summary = useMemo(() => {
    if (rpbRows === null) return null;
    return buildFlags(rpbRows, consRows, gearRows);
  }, [rpbRows, consRows, gearRows]);

  if (summary === null) {
    return <p className="notice">This report was cached before RPB support — Refresh from WCL (requires credentials).</p>;
  }

  return (
    <div className="flags-view">
      <h2 className="flags-view__wip">Tab is work in progress</h2>
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
                  <span className="player-link flagrow__name" style={{ color: "var(--class-color, inherit)" }}>
                    {row.playerName}
                  </span>
                  <span className="flagrow__role"> · {row.role}</span>
                </div>
                <div className="flagrow__chips">
                  {row.chips.map((chip, i) => (
                    <span key={i} className={`fchip sev-${chip.severity}`}>{chip.text}</span>
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
