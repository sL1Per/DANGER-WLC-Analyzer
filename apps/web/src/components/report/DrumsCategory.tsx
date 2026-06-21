import { useMemo } from "react";
import type { ReportData } from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { DrumsView } from "../DrumsView";

export function DrumsCategory({ report, fightId }: { report: ReportData; fightId: number }) {
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);
  return <DrumsView report={scoped} />;
}
