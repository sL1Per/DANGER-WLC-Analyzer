import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { ReportData } from "@wcl/core";
import { fetchSnapshot } from "../lib/share";
import { ReportView } from "../components/report/ReportView";
import { LoadingNugget } from "../components/LoadingNugget";

export function SharedReportPage() {
  const { shareId = "" } = useParams();
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSnapshot(shareId)
      .then((d) => { if (alive) setReport(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Could not load shared report."); });
    return () => { alive = false; };
  }, [shareId]);

  if (error) return <div role="alert"><p>{error}</p><p><Link to="/">Go home</Link></p></div>;
  if (!report) return <LoadingNugget />;
  // read-only: no onRefresh, no shareActions → ReportView hides refresh/stale UI
  return <ReportView report={report} />;
}
