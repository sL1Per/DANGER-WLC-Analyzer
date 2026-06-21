import { describe, expect, it } from "vitest";
import { reportFixture } from "@wcl/core";
import { scopeReportToFight } from "./scopeReport";

describe("scopeReportToFight", () => {
  it("keeps only the chosen fight but preserves every other field by reference", () => {
    const report = reportFixture;
    const target = report.fights.find((f) => f.isBoss)!;
    const scoped = scopeReportToFight(report, target.id);

    expect(scoped.fights).toEqual([target]);
    expect(scoped.players).toBe(report.players);
    expect(scoped.playerTotals).toBe(report.playerTotals);
    expect(scoped.gear).toBe(report.gear);
    expect(scoped).not.toBe(report);
  });

  it("yields an empty fights array for an unknown id", () => {
    expect(scopeReportToFight(reportFixture, -1).fights).toEqual([]);
  });
});
