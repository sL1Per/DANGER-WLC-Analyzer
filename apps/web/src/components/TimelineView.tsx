import { useState } from "react";
import { compareTimelines, type TimelineComparison, type TimelinePull, type ReportData } from "@wcl/core";
import { ApiError, fetchReport } from "../lib/api";
import { SeverityLegend } from "./SeverityLegend";

function hms(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

function PullRows({ pulls }: { pulls: TimelinePull[] }) {
  return (
    <>
      {pulls.map((p, i) => (
        <tr key={i}>
          <td>{p.name}{p.isBoss ? "" : " (trash)"}</td>
          <td className={`sev-${p.idleSeverity}`}>{p.idle === null ? "---" : hms(p.idle)}</td>
          <td>{hms(p.start)}</td>
          <td>{hms(p.duration)}</td>
          <td>{hms(p.end)}</td>
        </tr>
      ))}
    </>
  );
}

export function TimelineView({ report }: { report: ReportData }) {
  const [id, setId] = useState("");
  const [cmp, setCmp] = useState<TimelineComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const compare = () => {
    setError(null);
    setLoading(true);
    fetchReport(id.trim())
      .then((res) => setCmp(compareTimelines(report, res.data)))
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <p>
        Compare this log's pull timing against a second log.{" "}
        <input placeholder="second report id or url" value={id} onChange={(e) => setId(e.target.value)} />{" "}
        <button onClick={compare} disabled={!id.trim() || loading}>compare</button>
      </p>
      {loading && <p>Loading second report…</p>}
      {error && <p role="alert" className="sev-major">{error}</p>}
      {cmp && (
        <div>
          <SeverityLegend />
          {cmp.bossDiffs.length > 0 && (
            <ul className="timeline-diffs">
              {cmp.bossDiffs.map((d) => (
                <li key={d.boss} className={`sev-${d.severity}`}>
                  {d.boss}: {d.cumulativeDiff <= 0 ? "ahead by " : "behind by "}{hms(Math.abs(d.cumulativeDiff))}
                </li>
              ))}
            </ul>
          )}
          <div className="scroll-x timeline-pair">
            <table>
              <caption>{cmp.a.title} — total idle {hms(cmp.a.totalIdle)}</caption>
              <thead><tr><th>name</th><th>idle</th><th>start</th><th>duration</th><th>end</th></tr></thead>
              <tbody><PullRows pulls={cmp.a.pulls} /></tbody>
            </table>
            <table>
              <caption>{cmp.b.title} — total idle {hms(cmp.b.totalIdle)}</caption>
              <thead><tr><th>name</th><th>idle</th><th>start</th><th>duration</th><th>end</th></tr></thead>
              <tbody><PullRows pulls={cmp.b.pulls} /></tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
