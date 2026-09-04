import { useMemo } from "react";
import { performanceSummary, type ReportData, type PerfRanked, type PerfDeathRow } from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { classColorVar } from "../../lib/classColors";
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";

const amount = (n: number) => Math.round(n).toLocaleString();
const rate = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(1));
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function PerformanceView({ report, fightId }: { report: ReportData; fightId: number }) {
  const summary = useMemo(() => performanceSummary(scopeReportToFight(report, fightId)), [report, fightId]);

  if (summary === null) {
    return <p className="notice">This report was cached before the performance breakdown — Refresh from WCL (requires credentials).</p>;
  }

  return (
    <div className="perf-summary">
      <SourcePanel title="Damage Done By Source" rateLabel="DPS" rows={summary.damageBySource} />
      <SourcePanel title="Healing Done By Source" rateLabel="HPS" rows={summary.healingBySource} />
      <AbilityPanel title="Damage Taken By Ability" rateLabel="DTPS" rows={summary.damageTakenByAbility} />
      <DeathsPanel rows={summary.deaths} />
    </div>
  );
}

function maxAmount(rows: PerfRanked[]): number {
  return rows.reduce((m, r) => Math.max(m, r.amount), 0);
}

function SourcePanel({ title, rateLabel, rows }: { title: string; rateLabel: string; rows: PerfRanked[] }) {
  const isPhone = useIsPhone();
  const max = maxAmount(rows);
  if (isPhone) {
    return (
      <section className="card perf-panel">
        <h3>{title}</h3>
        <StatCards>
          {rows.map((r) => (
            <StatCard
              key={r.id}
              title={r.name}
              titleStyle={classColorVar(r.className ?? "")}
              rows={[
                { label: "%", value: pct(r.percent) },
                { label: "Amount", value: amount(r.amount) },
                { label: rateLabel, value: rate(r.perSecond) },
              ]}
            />
          ))}
        </StatCards>
      </section>
    );
  }
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
                  <span className="player-link">{r.name}</span>
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
  const isPhone = useIsPhone();
  const max = maxAmount(rows);
  if (isPhone) {
    return (
      <section className="card perf-panel">
        <h3>{title}</h3>
        <StatCards>
          {rows.map((r) => (
            <StatCard
              key={r.id}
              title={r.name}
              rows={[
                { label: "%", value: pct(r.percent) },
                { label: "Amount", value: amount(r.amount) },
                { label: rateLabel, value: rate(r.perSecond) },
              ]}
            />
          ))}
        </StatCards>
      </section>
    );
  }
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

function DeathsPanel({ rows }: { rows: PerfDeathRow[] }) {
  const isPhone = useIsPhone();
  if (isPhone) {
    return (
      <section className="card perf-panel">
        <h3>Deaths</h3>
        <StatCards>
          {rows.length === 0
            ? <p className="sev-neutral">No deaths</p>
            : rows.map((r, i) => (
              <StatCard
                key={`${r.playerId}-${i}`}
                title={r.playerName}
                titleStyle={classColorVar(r.className ?? "")}
                rows={[
                  { label: "Killing Blow", value: r.killingBlow },
                  { label: "Time", value: mmss(r.timeMs) },
                ]}
              />
            ))}
        </StatCards>
      </section>
    );
  }
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
                    <span className="player-link">{r.playerName}</span>
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
