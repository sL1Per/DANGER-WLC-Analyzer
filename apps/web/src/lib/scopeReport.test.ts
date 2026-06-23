import { describe, expect, it } from "vitest";
import { reportFixture } from "@wcl/core";
import { scopeReportToFight, ALL_FIGHTS } from "./scopeReport";

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
    expect(scopeReportToFight(reportFixture, 999999).fights).toEqual([]);
  });

  it("scopes to every boss fight for ALL_FIGHTS", () => {
    const scoped = scopeReportToFight(reportFixture, ALL_FIGHTS);
    expect(scoped.fights).toEqual(reportFixture.fights.filter((f) => f.isBoss));
    expect(scoped.fights.every((f) => f.isBoss)).toBe(true);
    expect(scoped.players).toBe(reportFixture.players);
  });
});
