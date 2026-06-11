import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, fetchReport, refreshReport, type ReportResponse } from "../lib/api";
import { ReportSummary } from "../components/ReportSummary";

export function ReportPage() {
  const { reportId = "" } = useParams();
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

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
      <button onClick={() => refreshReport(reportId).then(setResult)}>Refresh from WCL</button>
      <ReportSummary report={result.data} cachedAt={result.cachedAt} />
    </div>
  );
}
