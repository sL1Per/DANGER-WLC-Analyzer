import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, fetchReport, refreshReport, type ReportResponse } from "../lib/api";
import { loadCredentials } from "../lib/storage";
import { ReportSummary } from "../components/ReportSummary";
import { GearListingView } from "../components/GearListingView";

export function ReportPage() {
  const { reportId = "" } = useParams();
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "gear listing">("summary");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchReport(reportId)
      .then(setResult)
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError(500, String(e))))
      .finally(() => setLoading(false));
  }, [reportId]);

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
    <div>
      {loadCredentials() !== null && (
        <button
          onClick={() =>
            refreshReport(reportId)
              .then(setResult)
              .catch((e) => setError(e instanceof ApiError ? e : new ApiError(500, String(e))))
          }
        >
          Refresh from WCL
        </button>
      )}
      <nav className="tabs">
        {(["summary", "gear listing"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === "summary" && <ReportSummary report={result.data} cachedAt={result.cachedAt} />}
      {tab === "gear listing" && <GearListingView report={result.data} />}
    </div>
  );
}
