import { useMemo } from "react";
import { consumables, uptimeSeverity, type ReportData } from "@wcl/core";
import { CLASS_ORDER, classColorVar } from "../lib/classColors";
import { consumablesConfig } from "../lib/analysisConfig";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const classRank = (c: string): number => {
  const i = (CLASS_ORDER as readonly string[]).indexOf(c);
  return i === -1 ? CLASS_ORDER.length : i;
};

function UptimeCell({ value }: { value: number }) {
  return <td className={`sev-${uptimeSeverity(value)}`}>{pct(value)}</td>;
}

export function ConsumablesView({ report, onPlayer }: { report: ReportData; onPlayer?: (name: string) => void }) {
  const result = useMemo(() => consumables(report, consumablesConfig), [report]);
  const classOf = useMemo(() => new Map(report.players.map((p) => [p.id, p.class])), [report.players]);
  const rows = useMemo(() => {
    if (result === null) return [];
    return [...result.rows].sort((a, b) => {
      const d = classRank(classOf.get(a.playerId) ?? "") - classRank(classOf.get(b.playerId) ?? "");
      return d !== 0 ? d : a.playerName.localeCompare(b.playerName);
    });
  }, [result, classOf]);

  if (result === null) {
    return <p>This report was cached before consumable support — refresh it from WCL (requires credentials).</p>;
  }
  if (rows.length === 0) {
    return <p>No boss fights in this report.</p>;
  }
  return (
    <div>
      <p><small>Only boss fights evaluated. Some T6 fights miss the combatantInfo with consumables info — loggers should stand close to the boss at the pull.</small></p>
      <div className="scroll-x">
        <table className="buff-consumables">
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
            {rows.map((r) => (
              <tr key={r.playerId}>
                <td className="player-cell" style={classColorVar(classOf.get(r.playerId) ?? "")}>
                  {onPlayer
                    ? <button className="player-link" onClick={() => onPlayer(r.playerName)}>{r.playerName}</button>
                    : r.playerName}
                </td>
                <UptimeCell value={r.totalAverage} />
                <UptimeCell value={r.elixirOrFlask} />
                <td>{pct(r.battleElixir)}</td>
                <td>{pct(r.guardianElixir)}</td>
                <td>{pct(r.flask)}</td>
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
