import { buildRankingsGrid, type RankingsRole, type ReportData } from "@wcl/core";
import { classColorVar } from "../../lib/classColors";
import { parseClass } from "../../lib/parseColor";

const ROLE_LABEL: Record<RankingsRole, string> = {
  dps: "Damage Dealers", healers: "Healers", tanks: "Tanks",
};

export function SummaryRankings({ report, onPlayer }: { report: ReportData; onPlayer: (name: string) => void }) {
  if (report.rankings === undefined) {
    return <p className="notice">This report was cached before parse rankings — Refresh from WCL (requires credentials).</p>;
  }
  const grid = buildRankingsGrid(report.rankings);
  if (!grid) return <p className="notice">No ranked boss kills in this report.</p>;

  return (
    <div className="summary-rankings">
      <p className="intro">Each cell is the WarcraftLogs parse percentile for that boss. Higher = better; colors follow the WCL scale. Rows are sorted by season-average parse.</p>
      {grid.sections.map((section) => (
        <section key={section.role} className="card">
          <h3>{ROLE_LABEL[section.role]}</h3>
          <div className="scroll-x">
            <table className="rank-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Avg</th>
                  {grid.bosses.map((b) => <th key={b.fightID}>{b.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {section.players.map((p) => (
                  <tr key={p.name}>
                    <td className="player-cell" style={classColorVar(p.class)}>
                      <button className="player-link" onClick={() => onPlayer(p.name)}>{p.name}</button>
                    </td>
                    <td className={`mono ${parseClass(p.overall)}`}><strong>{Math.round(p.overall)}</strong></td>
                    {grid.bosses.map((b) => {
                      const cell = p.perBoss[b.fightID];
                      return cell
                        ? <td key={b.fightID} className={`mono ${parseClass(cell.rankPercent)}`}>{cell.rankPercent}</td>
                        : <td key={b.fightID} className="sev-neutral">—</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
