import { useMemo } from "react";
import { rpb, consumables, gearIssues, type ReportData, type RpbRow, type ConsumableRow, type PlayerGearIssues } from "@wcl/core";
import { scopeReportToFight } from "./scopeReport";
import { buildRpbConfig, consumablesConfig, gearIssueConfig } from "./analysisConfig";

export interface FightAnalysis {
  rpbRows: RpbRow[] | null;
  consRows: ConsumableRow[];
  gearRows: PlayerGearIssues[];
}

/** Per-fight analyzer pass (RPB + consumables + gear issues) behind
 *  FightHeader's stat bar, memoized so the heaviest analysis in the app runs
 *  once per scope change, not on every render. */
export function useFightAnalysis(report: ReportData, fightId: number): FightAnalysis {
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);
  return useMemo(() => {
    const rpbResult = rpb(scoped, buildRpbConfig());
    const consRows = consumables(scoped, consumablesConfig)?.rows ?? [];
    const gearRows = gearIssues(scoped, gearIssueConfig);
    return { rpbRows: rpbResult?.rows ?? null, consRows, gearRows };
  }, [scoped]);
}
