import { useEffect, useState } from "react";
import { ApiError, fetchReport, refreshReport, type ReportResponse } from "./api";
import { addRecentReport, saveLastReportId } from "./storage";

/** Loads a cached report (and exposes a WCL refresh), shared by the CLA and RPB
 *  pages so both pull the same data with identical loading/error handling. */
export function useReport(reportId: string) {
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const asApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(500, String(e)));

  const remember = (r: ReportResponse) => {
    const { reportId: id, title, zoneName, players, startTime } = r.data;
    addRecentReport({ id, title, zoneName, players: players.length, startTime });
    return r;
  };

  useEffect(() => {
    if (reportId) saveLastReportId(reportId);
    setLoading(true);
    setError(null);
    fetchReport(reportId)
      .then(remember)
      .then(setResult)
      .catch((e) => setError(asApiError(e)))
      .finally(() => setLoading(false));
  }, [reportId]);

  const reload = () =>
    refreshReport(reportId).then(remember).then(setResult).catch((e) => setError(asApiError(e)));

  return { result, error, loading, reload };
}
