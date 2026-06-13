import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, fetchReport, refreshReport, type ReportResponse } from "../lib/api";
import { loadCredentials } from "../lib/storage";
import { ReportSummary } from "../components/ReportSummary";
import { GearListingView } from "../components/GearListingView";
import { GearIssuesView } from "../components/GearIssuesView";
import { ConsumablesView } from "../components/ConsumablesView";
import { DrumsView } from "../components/DrumsView";
import { ValidateView } from "../components/ValidateView";
import { ShadowResView } from "../components/ShadowResView";
import { TimelineView } from "../components/TimelineView";

export function ReportPage() {
  const { reportId = "" } = useParams();
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "gear issues" | "gear listing" | "buff consumables" | "drums" | "validate" | "shadow resi" | "fight timeline">("summary");

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
        {(["summary", "gear issues", "gear listing", "buff consumables", "drums", "validate", "shadow resi", "fight timeline"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === "summary" && <ReportSummary report={result.data} cachedAt={result.cachedAt} />}
      {tab === "gear issues" && <GearIssuesView key={result.data.reportId} report={result.data} />}
      {tab === "gear listing" && <GearListingView key={result.data.reportId} report={result.data} />}
      {tab === "buff consumables" && <ConsumablesView key={result.data.reportId} report={result.data} />}
      {tab === "drums" && <DrumsView key={result.data.reportId} report={result.data} />}
      {tab === "validate" && <ValidateView key={result.data.reportId} report={result.data} />}
      {tab === "shadow resi" && <ShadowResView key={result.data.reportId} report={result.data} />}
      {tab === "fight timeline" && <TimelineView key={result.data.reportId} report={result.data} />}
    </div>
  );
}
