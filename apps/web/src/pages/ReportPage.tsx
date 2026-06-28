import { useParams, Link } from "react-router-dom";
import { useReport } from "../lib/useReport";
import { LoadingNugget } from "../components/LoadingNugget";
import { ReportView } from "../components/report/ReportView";
import { PublishShare } from "../components/PublishShare";

export function ReportPage() {
  const { reportId = "" } = useParams();
  const { result, error, loading, reload } = useReport(reportId);

  if (loading) return <LoadingNugget />;
  if (error) {
    return (
      <div role="alert">
        <p>{error.message}</p>
        {error.needsKey && <p><Link to="/settings">Add your WCL credentials</Link> to load this report.</p>}
      </div>
    );
  }
  if (!result) return null;

  return (
    <ReportView
      report={result.data}
      stale={result.stale}
      onRefresh={reload}
      shareActions={<PublishShare report={result.data} />}
    />
  );
}
