import { useMemo } from "react";
import { performanceSummary, type ReportData, type PerfRanked, type PerfDeathRow } from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { classColorVar } from "../../lib/classColors";

const amount = (n: number) => Math.round(n).toLocaleString();
const rate = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(1));
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function PerformanceView({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
  const summary = useMemo(() => performanceSummary(scopeReportToFight(report, fightId)), [report, fightId]);

  if (summary === null) {
    return <p className="notice">This report was cached before the performance breakdown — Refresh from WCL (requires credentials).</p>;
  }

  return (
    <div className="perf-summary">
      <SourcePanel title="Damage Done By Source" rateLabel="DPS" rows={summary.damageBySource} onPlayer={onPlayer} />
      <SourcePanel title="Healing Done By Source" rateLabel="HPS" rows={summary.healingBySource} onPlayer={onPlayer} />
      <AbilityPanel title="Damage Taken By Ability" rateLabel="DTPS" rows={summary.damageTakenByAbility} />
      <DeathsPanel rows={summary.deaths} onPlayer={onPlayer} />
    </div>
  );
}

function maxAmount(rows: PerfRanked[]): number {
  return rows.reduce((m, r) => Math.max(m, r.amount), 0);
}

function SourcePanel({ title, rateLabel, rows, onPlayer }: { title: string; rateLabel: string; rows: PerfRanked[]; onPlayer: (name: string) => void }) {
  const max = maxAmount(rows);
  return (
    <section className="card perf-panel">
      <h3>{title}</h3>
      <div className="scroll-x">
        <table className="perf-table">
          <thead><tr><th>Name</th><th>%</th><th>Amount</th><th>{rateLabel}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="player-cell" style={classColorVar(r.className ?? "")}>
                  <button className="player-link" onClick={() => onPlayer(r.name)}>{r.name}</button>
                </td>
                <td className="mono">{pct(r.percent)}</td>
                <td className="perf-amount">
                  <span className="perf-bar" style={{ ["--w" as string]: `${max > 0 ? (r.amount / max) * 100 : 0}%` }} />
                  <span className="mono">{amount(r.amount)}</span>
                </td>
                <td className="mono">{rate(r.perSecond)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AbilityPanel({ title, rateLabel, rows }: { title: string; rateLabel: string; rows: PerfRanked[] }) {
  const max = maxAmount(rows);
  return (
    <section className="card perf-panel">
      <h3>{title}</h3>
      <div className="scroll-x">
        <table className="perf-table">
          <thead><tr><th>Name</th><th>%</th><th>Amount</th><th>{rateLabel}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="mono">{pct(r.percent)}</td>
                <td className="perf-amount">
                  <span className="perf-bar" style={{ ["--w" as string]: `${max > 0 ? (r.amount / max) * 100 : 0}%` }} />
                  <span className="mono">{amount(r.amount)}</span>
                </td>
                <td className="mono">{rate(r.perSecond)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeathsPanel({ rows, onPlayer }: { rows: PerfDeathRow[]; onPlayer: (name: string) => void }) {
  return (
    <section className="card perf-panel">
      <h3>Deaths</h3>
      <div className="scroll-x">
        <table className="perf-table">
          <thead><tr><th>Name</th><th>Killing Blow</th><th>Time</th></tr></thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={3} className="sev-neutral">No deaths</td></tr>
              : rows.map((r, i) => (
                <tr key={`${r.playerId}-${i}`}>
                  <td className="player-cell" style={classColorVar(r.className ?? "")}>
                    <button className="player-link" onClick={() => onPlayer(r.playerName)}>{r.playerName}</button>
                  </td>
                  <td>{r.killingBlow}</td>
                  <td className="mono">{mmss(r.timeMs)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
