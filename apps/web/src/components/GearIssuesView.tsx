import { useMemo, useState } from "react";
import { gearIssues, QUALITY_NAMES, type GearIssueConfig, type ReportData } from "@wcl/core";
import { badEnchants, excludedItems, itemShadowRes, itemSockets } from "@wcl/data";

export function GearIssuesView({ report }: { report: ReportData }) {
  const [minGemQuality, setMinGemQuality] = useState(3);
  const [excludeShahraz, setExcludeShahraz] = useState(false);
  const [listNoIssues, setListNoIssues] = useState(false);

  const rows = useMemo(() => {
    const cfg: GearIssueConfig = {
      minGemQuality, excludeShahraz, listNoIssues,
      itemSockets, itemShadowRes, badEnchants, excludedItems,
    };
    return gearIssues(report, cfg);
  }, [report, minGemQuality, excludeShahraz, listNoIssues]);

  if (report.gear.length === 0) {
    return <p>No gear data in this report (combatantInfo missing — loggers may have been too far from the boss at pull).</p>;
  }
  return (
    <div>
      <fieldset>
        <legend>Settings</legend>
        <label>
          minimum gem quality:{" "}
          <select aria-label="minimum gem quality" value={minGemQuality}
            onChange={(e) => setMinGemQuality(Number(e.target.value))}>
            {[2, 3, 4].map((q) => <option key={q} value={q}>{QUALITY_NAMES[q]}</option>)}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={excludeShahraz}
            onChange={(e) => setExcludeShahraz(e.target.checked)} />
          exclude Mother Shahraz
        </label>
        <label>
          <input type="checkbox" checked={listNoIssues}
            onChange={(e) => setListNoIssues(e.target.checked)} />
          list players with no issues
        </label>
      </fieldset>
      <p><small>Gear is only recorded at the start of boss fights. Issues are aggregated across all boss fights in the report.</small></p>
      <table>
        <thead><tr><th>player</th><th>issues</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId}>
              <td>{r.playerName}</td>
              <td>
                <ul className="issues">
                  {r.issues.map((i, idx) => (
                    <li key={idx}>{i.itemName ? `${i.itemName} ` : ""}[{i.issue}]</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
