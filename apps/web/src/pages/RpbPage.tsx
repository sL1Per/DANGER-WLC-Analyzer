import { Link, useParams } from "react-router-dom";
import { loadCredentials } from "../lib/storage";
import { useReport } from "../lib/useReport";
import { RpbView } from "../components/RpbView";
import { ShareToDiscord } from "../components/ShareToDiscord";

export function RpbPage() {
  const { reportId = "" } = useParams();
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
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Role Performance Breakdown</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <ShareToDiscord
            title={result.data.title}
            zoneName={result.data.zoneName}
            link={window.location.href}
          />
          {loadCredentials() !== null && (
            <button className="btn-outline" onClick={reload}>
              Refresh from WCL
            </button>
          )}
        </div>
      </div>
      <div className="card">
        <RpbView key={result.data.reportId} report={result.data} />
      </div>
    </div>
  );
}
