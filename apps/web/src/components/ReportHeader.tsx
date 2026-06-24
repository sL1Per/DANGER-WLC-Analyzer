import type { ReportData } from "@wcl/core";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadRecentReports, type RecentReport } from "../lib/storage";
import { SeverityLegend } from "./SeverityLegend";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString();

function ReportSwitcher({ report }: { report: ReportData }) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentReport[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Re-read on open so the list reflects any reports viewed since mount.
  function toggle() {
    if (!open) setRecent(loadRecentReports());
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const others = recent.filter((r) => r.id !== report.reportId);

  return (
    <div className="report-switcher" ref={ref}>
      <button
        type="button"
        className="report-switcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="report-switcher__current">
          <strong>{report.title}</strong>
          <span className="mono">{report.zoneName} · {report.players.length} players · {fmtDate(report.startTime)}</span>
        </span>
        <span className="report-switcher__chevron" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="report-switcher__menu" role="listbox">
          {others.length === 0 ? (
            <p className="report-switcher__empty">No other cached raids yet.</p>
          ) : (
            others.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={false}
                className="report-switcher__item"
                onClick={() => { setOpen(false); navigate(`/report/${r.id}`); }}
              >
                <strong>{r.title}</strong>
                <span className="mono">{r.zoneName} · {r.players} players · {fmtDate(r.startTime)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ReportHeader({ report, onRefresh }: { report: ReportData; onRefresh?: () => void }) {
  return (
    <header className="report-header">
      <Link to="/" className="report-header__brand">
        <span className="report-header__mark" aria-hidden>D</span>
        <span>
          <span className="report-header__title">DANGER Raid Analyzer <span className="brand-tag">For TBC Anniversary</span></span>
          <span className="report-header__subtitle">Combat Log Analytics &amp; Role Performance Breakdown</span>
        </span>
      </Link>

      <div className="report-header__identity">
        <ReportSwitcher report={report} />
      </div>

      <div className="report-header__actions">
        <SeverityLegend />
        <Link to="/settings" className="btn-outline">Settings</Link>
        <Link to="/" className="btn-outline">New report</Link>
        {onRefresh && <button className="btn-outline" onClick={onRefresh}>Refresh from WCL</button>}
      </div>
    </header>
  );
}
