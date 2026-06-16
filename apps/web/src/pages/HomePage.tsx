import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { parseReportInput } from "@wcl/core";
import { loadCredentials, loadLastReportId, saveLastReportId } from "../lib/storage";
import { useReport } from "../lib/useReport";
import { ReportSummary } from "../components/ReportSummary";

export function HomePage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string>(() => loadLastReportId() ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = parseReportInput(input);
    if (!id) {
      setError("That doesn't look like a WCL report URL or id.");
      return;
    }
    setError(null);
    saveLastReportId(id);
    setReportId(id);
  }

  return (
    <div>
      <form className="card card--center" onSubmit={onSubmit}>
        <h1>WCL Raid Analyzer</h1>
        <p className="subhead">Paste a WarcraftLogs report URL or id to begin.</p>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://classic.warcraftlogs.com/reports/…"
          size={60}
          aria-label="report url or id"
        />
        <button type="submit" style={{ marginTop: 16 }}>
          Analyze
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      {reportId && <HomeSummary reportId={reportId} />}
    </div>
  );
}

function HomeSummary({ reportId }: { reportId: string }) {
  const { result, error, loading, reload } = useReport(reportId);

  if (loading) return <p>Loading report…</p>;
  if (error) {
    return (
      <div role="alert">
        <p>{error.message}</p>
        {error.needsKey && (
          <p>
            <Link to="/settings">Add your WCL credentials</Link> to load this report.
          </p>
        )}
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className="card" style={{ marginTop: 24 }}>
      {loadCredentials() !== null && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button className="btn-outline" onClick={reload}>
            Refresh from WCL
          </button>
        </div>
      )}
      <ReportSummary report={result.data} cachedAt={result.cachedAt} />
    </div>
  );
}
