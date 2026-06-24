import { useMemo } from "react";
import { rpbConsumables, type ReportData } from "@wcl/core";
import { rpbConsumableSpecs } from "../../lib/analysisConfig";
import { scopeReportToFight } from "../../lib/scopeReport";
import { ConsumableMatrix } from "../ConsumableMatrix";

export function ConsumablesCategory({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);
  const result = useMemo(() => rpbConsumables(scoped, rpbConsumableSpecs), [scoped]);

  if (result === null) {
    return <p className="notice">This report was cached before consumable support — Refresh from WCL (requires credentials).</p>;
  }
  const catalog = rpbConsumableSpecs.map((s) => ({ key: s.key, name: s.name, uptime: s.buffUptime }));
  return (
    <div>
      <p className="intro">Consumable counts across the night. Each row is a relative heatmap — green = top user, red = nobody home. A blank row means nobody used it.</p>
      <ConsumableMatrix rows={result.rows} catalog={catalog} onPlayer={onPlayer} />
    </div>
  );
}
