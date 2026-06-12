import type { ReportData } from "./types";

export function itemName(report: ReportData, itemId: number): string {
  return report.itemMeta[String(itemId)]?.name ?? `item ${itemId}`;
}
