import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadCredentials } from "../lib/storage";
import { useReport } from "../lib/useReport";
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
  const { result, error, loading, reload } = useReport(reportId);
  const [tab, setTab] = useState<"summary" | "gear issues" | "gear listing" | "buff consumables" | "drums" | "validate" | "shadow resi" | "fight timeline">("summary");

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <nav className="segmented">
          {(["summary", "gear issues", "gear listing", "buff consumables", "drums", "validate", "shadow resi", "fight timeline"] as const).map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        {loadCredentials() !== null && (
          <button className="btn-outline" onClick={reload}>
            Refresh from WCL
          </button>
        )}
      </div>
      <div className="card">
        {tab === "summary" && <ReportSummary report={result.data} cachedAt={result.cachedAt} />}
        {tab === "gear issues" && <GearIssuesView key={result.data.reportId} report={result.data} />}
        {tab === "gear listing" && <GearListingView key={result.data.reportId} report={result.data} />}
        {tab === "buff consumables" && <ConsumablesView key={result.data.reportId} report={result.data} />}
        {tab === "drums" && <DrumsView key={result.data.reportId} report={result.data} />}
        {tab === "validate" && <ValidateView key={result.data.reportId} report={result.data} />}
        {tab === "shadow resi" && <ShadowResView key={result.data.reportId} report={result.data} />}
        {tab === "fight timeline" && <TimelineView key={result.data.reportId} report={result.data} />}
      </div>
    </div>
  );
}
