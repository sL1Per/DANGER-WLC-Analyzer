import type { ReportData } from "@wcl/core";
import { Link } from "react-router-dom";
import { loadCredentials } from "../lib/storage";
import { SeverityLegend } from "./SeverityLegend";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString();

export function ReportHeader({ report, onRefresh }: { report: ReportData; onRefresh?: () => void }) {
  const canRefresh = onRefresh && loadCredentials() !== null;
  return (
    <header className="report-header">
      <Link to="/" className="report-header__brand">
        <span className="report-header__mark" aria-hidden>W</span>
        <span>
          <span className="report-header__title">Raid Analyzer</span>
          <span className="report-header__subtitle">TBC Classic · Combat Log Analytics</span>
        </span>
      </Link>

      <div className="report-header__identity">
        <strong>{report.title}</strong>
        <span className="mono">{report.zoneName} · {report.players.length} players · {fmtDate(report.startTime)}</span>
      </div>

      <div className="report-header__actions">
        <SeverityLegend />
        <Link to="/settings" className="btn-outline">Settings</Link>
        <Link to="/" className="btn-outline">New report</Link>
        {canRefresh && <button className="btn-outline" onClick={onRefresh}>Refresh from WCL</button>}
      </div>
    </header>
  );
}
