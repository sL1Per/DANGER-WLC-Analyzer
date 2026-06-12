import { useMemo } from "react";
import { consumables, uptimeSeverity, type ReportData } from "@wcl/core";
import { consumableBuffs, jcNecks, suboptimalConsumables } from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";

function UptimeCell({ value }: { value: number }) {
  return <td className={`sev-${uptimeSeverity(value)}`}>{value.toFixed(2)}</td>;
}

export function ConsumablesView({ report }: { report: ReportData }) {
  const result = useMemo(
    () => consumables(report, { buffs: consumableBuffs, jcNecks, suboptimal: suboptimalConsumables }),
    [report],
  );

  if (result === null) {
    return <p>This report was cached before consumable support — refresh it from WCL (requires credentials).</p>;
  }
  if (result.rows.length === 0) {
    return <p>No boss fights in this report.</p>;
  }
  return (
    <div>
      <p><small>Only boss fights evaluated. Some T6 fights miss the combatantInfo with consumables info — loggers should stand close to the boss at the pull.</small></p>
      <SeverityLegend />
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>player</th>
              <th>total average (excl. Scrolls)</th>
              <th>Elixir or Flask</th>
              <th>Battle Elixir</th>
              <th>Guardian Elixir</th>
              <th>Flask</th>
              <th>Food Buff</th>
              <th>Scrolls (* if lower than lvl 5)</th>
              <th>Weapon Enhancement</th>
              <th>JC neck</th>
              <th>suboptimal stuff found</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.playerId}>
                <td>{r.playerName}</td>
                <UptimeCell value={r.totalAverage} />
                <UptimeCell value={r.elixirOrFlask} />
                <td>{r.battleElixir.toFixed(2)}</td>
                <td>{r.guardianElixir.toFixed(2)}</td>
                <td>{r.flask.toFixed(2)}</td>
                <UptimeCell value={r.food} />
                <td>{r.scrolls}</td>
                {r.weaponEnhancement === null
                  ? <td>-</td>
                  : <UptimeCell value={r.weaponEnhancement} />}
                <td className={r.jcNeck.inactiveOnFights > 0 ? "sev-moderate" : ""}>
                  {r.jcNeck.equipped
                    ? `${r.jcNeck.usedOnFights}${r.jcNeck.inactiveOnFights > 0 ? ` — inactive on ${r.jcNeck.inactiveOnFights} fight(s)` : ""}`
                    : "-"}
                </td>
                <td className={r.suboptimal.length > 0 ? "sev-moderate" : ""}>{r.suboptimal.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
