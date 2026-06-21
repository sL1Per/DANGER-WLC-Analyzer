import { useMemo } from "react";
import { rpbConsumables, type ReportData } from "@wcl/core";
import { rpbConsumableSpecs } from "../../lib/analysisConfig";
import { scopeReportToFight } from "../../lib/scopeReport";
import { ConsumableMatrix } from "../ConsumableMatrix";

export function ConsumablesCategory({ report, fightId }: { report: ReportData; fightId: number }) {
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);
  const result = useMemo(() => rpbConsumables(scoped, rpbConsumableSpecs), [scoped]);

  if (result === null) {
    return <p className="notice">This report was cached before consumable support — Refresh from WCL (requires credentials).</p>;
  }
  const catalog = rpbConsumableSpecs.map((s) => ({ key: s.key, name: s.name }));
  return (
    <div>
      <p className="intro">Each row is one consumable; each column a raider. Cells are colored relative to the heaviest user on this pull — red means they used it least.</p>
      <ConsumableMatrix rows={result.rows} catalog={catalog} />
    </div>
  );
}
