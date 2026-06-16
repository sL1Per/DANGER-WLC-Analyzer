import { buildRankingsGrid, type RankingsRole, type ReportData } from "@wcl/core";
import { classColor } from "../lib/classColors";
import { parseClass } from "../lib/parseColor";

const ROLE_LABEL: Record<RankingsRole, string> = {
  dps: "Damage Dealers",
  healers: "Healers",
  tanks: "Tanks",
};

export function RankingsGrid({ report }: { report: ReportData }) {
  if (report.rankings === undefined) {
    return <p className="sev-legend">Refresh from WCL to load parse rankings.</p>;
  }
  const grid = buildRankingsGrid(report.rankings);
  if (!grid) return <p className="sev-legend">No ranked boss kills in this report.</p>;

  return (
    <div>
      <h2>Rankings</h2>
      {grid.sections.map((section) => (
        <section key={section.role}>
          <h3>{ROLE_LABEL[section.role]}</h3>
          <table>
            <thead>
              <tr>
                <th>player</th>
                {grid.bosses.map((b) => (
                  <th key={b.fightID}>{b.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.players.map((p) => (
                <tr key={p.name}>
                  <td>
                    <span style={{ color: classColor(p.class), fontWeight: 600 }}>{p.name}</span>
                  </td>
                  {grid.bosses.map((b) => {
                    const cell = p.perBoss[b.fightID];
                    return cell ? (
                      <td key={b.fightID} className={parseClass(cell.rankPercent)}>
                        {cell.rankPercent}
                      </td>
                    ) : (
                      <td key={b.fightID} className="sev-neutral">
                        —
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
