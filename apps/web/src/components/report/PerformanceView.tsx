import { useMemo } from "react";
import {
  rpb, consumables, gearIssues, type ReportData, type Role, type RpbRow,
} from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { buildRpbConfig, consumablesConfig, gearIssueConfig } from "../../lib/analysisConfig";
import { consumablesStatus, statusHeat, type ConsumablesStatus } from "../../lib/playerRollups";
import { heatClass, relativeHeat, deathsHeat, type Heat } from "../../lib/heatmap";
import { classColorVar } from "../../lib/classColors";

const ROLE_ORDER: Role[] = ["tank", "healer", "caster", "physical"];
const ROLE_LABEL: Record<Role, string> = { tank: "Tanks", healer: "Healers", caster: "Casters", physical: "Melee & Ranged" };
const STATUS_LABEL: Record<ConsumablesStatus, string> = { full: "Full", partial: "Partial", missing: "Missing" };
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function PerformanceView({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
  const fight = report.fights.find((f) => f.id === fightId);
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);

  const result = useMemo(() => rpb(scoped, buildRpbConfig()), [scoped]);
  const consRows = useMemo(() => consumables(scoped, consumablesConfig)?.rows ?? [], [scoped]);
  const gearFlags = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of gearIssues(scoped, gearIssueConfig)) {
      map.set(r.playerId, r.issues.filter((i) => i.itemId !== 0).length);
    }
    return map;
  }, [scoped]);

  if (result === null) {
    return <p className="notice">This report was cached before RPB support — Refresh from WCL (requires credentials).</p>;
  }
  const rows = result.rows;
  const consByPlayer = new Map(consRows.map((c) => [c.playerId, c]));

  // relative scales across this pull's raid
  const avoid = rows.map((r) => r.totalAvoidableDamageTaken);
  const aMin = Math.min(...avoid, 0), aMax = Math.max(...avoid, 0);
  const upt = rows.map((r) => r.activity?.relativeActiveST ?? 0);
  const uMin = Math.min(...upt, 0), uMax = Math.max(...upt, 0);

  const underConsumed = rows.filter((r) => consumablesStatus(consByPlayer.get(r.playerId)) !== "full").length;
  const totalDeaths = rows.reduce((s, r) => s + r.deaths, 0);
  const totalFlags = [...gearFlags.values()].reduce((s, n) => s + n, 0);

  const heat = (h: Heat) => heatClass(h);

  return (
    <div className="perf">
      <div className="perf-banner">
        <h2>{fight?.name ?? "Boss"}</h2>
        {fight && <span className={`pill ${fight.kill ? "pill--kill" : "pill--wipe"}`}>{fight.kill ? "Kill" : "Wipe"}</span>}
        <div className="perf-stats mono">
          <span>Duration {fight ? `${Math.round((fight.endTime - fight.startTime) / 1000)}s` : "—"}</span>
          <span className={heat(deathsHeat(totalDeaths))}>Deaths {totalDeaths}</span>
          <span className={heat(underConsumed > 0 ? "watch" : "good")}>Under-consumed {underConsumed}</span>
          <span className={heat(totalFlags > 0 ? "watch" : "good")}>Gear flags {totalFlags}</span>
        </div>
      </div>

      {ROLE_ORDER.map((role) => {
        const group = rows.filter((r) => r.role === role);
        if (group.length === 0) return null;
        return (
          <section key={role} className="card perf-role">
            <h3 className="role-band" data-role={role}>{ROLE_LABEL[role]} <span className="role-count">{group.length}</span></h3>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Player</th><th>Spec</th><th>Deaths</th><th>Avoidable dmg</th>
                    <th>Interrupts</th><th>Uptime</th><th>Consumables</th><th>Gear flags</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((r) => {
                    const status = consumablesStatus(consByPlayer.get(r.playerId));
                    const flags = gearFlags.get(r.playerId) ?? 0;
                    const noInterrupts = r.role === "tank" || r.role === "healer";
                    const u = r.activity?.relativeActiveST ?? null;
                    return (
                      <tr key={r.playerId}>
                        <td className="player-cell" style={classColorVar(r.className)}>
                          <span className="class-dot" />
                          <button className="player-link" onClick={() => onPlayer(r.playerName)}>{r.playerName}</button>
                        </td>
                        <td>{specOf(r)}</td>
                        <td className={heat(deathsHeat(r.deaths))}>{r.deaths}</td>
                        <td className={`mono ${heat(relativeHeat(aMax - r.totalAvoidableDamageTaken, 0, aMax - aMin))}`}>
                          {r.totalAvoidableDamageTaken.toLocaleString()}
                        </td>
                        <td className={noInterrupts ? "sev-neutral" : "mono"}>{noInterrupts ? "—" : r.interruptedSpells}</td>
                        <td className={u === null ? "sev-neutral" : `mono ${heat(relativeHeat(u, uMin, uMax))}`}>
                          {u === null ? "—" : pct(u)}
                        </td>
                        <td className={heat(statusHeat(status))}>{STATUS_LABEL[status]}</td>
                        <td className={heat(flags > 0 ? "bad" : "good")}>{flags}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Spec isn't on RpbRow; surface it from rankings when resolvable, else the class. */
function specOf(r: RpbRow): string {
  return r.className;
}
