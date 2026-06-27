import { useMemo } from "react";
import { consumables, uptimeSeverity, type ReportData } from "@wcl/core";
import { CLASS_ORDER, classColorVar } from "../lib/classColors";
import { consumablesConfig } from "../lib/analysisConfig";
import { useIsPhone } from "../lib/useMediaQuery";
import { StatCard, StatCards } from "./report/StatCard";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const classRank = (c: string): number => {
  const i = (CLASS_ORDER as readonly string[]).indexOf(c);
  return i === -1 ? CLASS_ORDER.length : i;
};

function UptimeCell({ value }: { value: number }) {
  return <td className={`col-num sev-${uptimeSeverity(value)}`}>{pct(value)}</td>;
}

export function ConsumablesView({ report, onPlayer }: { report: ReportData; onPlayer?: (name: string) => void }) {
  const isPhone = useIsPhone();
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
  if (isPhone) {
    const sev = (v: number) => `sev-${uptimeSeverity(v)}`;
    return (
      <div>
        <p><small>Only boss fights evaluated. Some T6 fights miss combatantInfo — stand close to the boss at pull.</small></p>
        <StatCards>
          {rows.map((r) => (
            <StatCard
              key={r.playerId}
              title={r.playerName}
              titleStyle={classColorVar(classOf.get(r.playerId) ?? "")}
              onTitleClick={onPlayer ? () => onPlayer(r.playerName) : undefined}
              rows={[
                { label: "Total avg (excl. Scrolls)", value: pct(r.totalAverage), className: sev(r.totalAverage) },
                { label: "Elixir or Flask", value: pct(r.elixirOrFlask), className: sev(r.elixirOrFlask) },
                { label: "Battle Elixir", value: `${pct(r.battleElixir)}${r.battleElixirNames.length ? ` — ${r.battleElixirNames.join(", ")}` : ""}` },
                { label: "Guardian Elixir", value: `${pct(r.guardianElixir)}${r.guardianElixirNames.length ? ` — ${r.guardianElixirNames.join(", ")}` : ""}` },
                { label: "Flask", value: `${pct(r.flask)}${r.flaskNames.length ? ` — ${r.flaskNames.join(", ")}` : ""}` },
                { label: "Food Buff", value: pct(r.food), className: sev(r.food) },
                { label: "Scrolls", value: r.scrolls || "—" },
                { label: "Weapon Enhancement", value: r.weaponEnhancement === null ? "—" : pct(r.weaponEnhancement), className: r.weaponEnhancement === null ? undefined : sev(r.weaponEnhancement) },
                { label: "JC neck", value: r.jcNeck.equipped ? `${r.jcNeck.usedOnFights}${r.jcNeck.inactiveOnFights > 0 ? ` — inactive on ${r.jcNeck.inactiveOnFights}` : ""}` : "—", className: r.jcNeck.inactiveOnFights > 0 ? "sev-moderate" : undefined },
                { label: "Suboptimal found", value: r.suboptimal.length ? r.suboptimal.join(", ") : "—", className: r.suboptimal.length ? "sev-moderate" : undefined },
              ]}
            />
          ))}
        </StatCards>
      </div>
    );
  }
  return (
    <div>
      <p><small>Only boss fights evaluated. Some T6 fights miss the combatantInfo with consumables info — loggers should stand close to the boss at the pull.</small></p>
      <div className="scroll-x">
        <table className="buff-consumables">
          <thead>
            <tr>
              <th>player</th>
              <th className="col-num">total average (excl. Scrolls)</th>
              <th className="col-num">Elixir or Flask</th>
              <th className="col-num">Battle Elixir</th>
              <th className="col-name">Battle Elixir name</th>
              <th className="col-num">Guardian Elixir</th>
              <th className="col-name">Guardian Elixir name</th>
              <th className="col-num">Flask</th>
              <th className="col-name">Flask name</th>
              <th className="col-num">Food Buff</th>
              <th className="col-name">Scrolls (* if lower than lvl 5)</th>
              <th className="col-num">Weapon Enhancement</th>
              <th className="col-name">JC neck</th>
              <th className="col-name">suboptimal stuff found</th>
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
                <td className="col-num">{pct(r.battleElixir)}</td>
                <td className="col-name">{r.battleElixirNames.join(", ")}</td>
                <td className="col-num">{pct(r.guardianElixir)}</td>
                <td className="col-name">{r.guardianElixirNames.join(", ")}</td>
                <td className="col-num">{pct(r.flask)}</td>
                <td className="col-name">{r.flaskNames.join(", ")}</td>
                <UptimeCell value={r.food} />
                <td className="col-name">{r.scrolls}</td>
                {r.weaponEnhancement === null
                  ? <td className="col-num">-</td>
                  : <UptimeCell value={r.weaponEnhancement} />}
                <td className={`col-name${r.jcNeck.inactiveOnFights > 0 ? " sev-moderate" : ""}`}>
                  {r.jcNeck.equipped
                    ? `${r.jcNeck.usedOnFights}${r.jcNeck.inactiveOnFights > 0 ? ` — inactive on ${r.jcNeck.inactiveOnFights} fight(s)` : ""}`
                    : "-"}
                </td>
                <td className={`col-name${r.suboptimal.length > 0 ? " sev-moderate" : ""}`}>{r.suboptimal.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
