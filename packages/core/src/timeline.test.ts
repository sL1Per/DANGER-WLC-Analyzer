import { describe, expect, it } from "vitest";
import { compareTimelines } from "./timeline";
import type { ReportData } from "./types";

function rep(title: string, fights: ReportData["fights"]): ReportData {
  return {
    reportId: title, title, zoneName: "Sunwell Plateau",
    startTime: 0, endTime: 1_000_000, fights, players: [], gear: [], itemMeta: {},
  };
}

const A = rep("log A", [
  { id: 1, name: "Trash", encounterId: 0, isBoss: false, startTime: 0, endTime: 10_000 },
  { id: 2, name: "Kalecgos", encounterId: 724, isBoss: true, kill: true, startTime: 30_000, endTime: 90_000 },
]);
const B = rep("log B", [
  { id: 1, name: "Trash", encounterId: 0, isBoss: false, startTime: 0, endTime: 12_000 },
  { id: 2, name: "Kalecgos", encounterId: 724, isBoss: true, kill: true, startTime: 20_000, endTime: 70_000 },
]);

describe("compareTimelines", () => {
  it("builds per-pull idle/start/duration/end for each log", () => {
    const r = compareTimelines(A, B);
    expect(r.a.pulls[0]!.idle).toBeNull();        // first pull has no idle
    expect(r.a.pulls[0]!.duration).toBe(10_000);
    expect(r.a.pulls[1]!.idle).toBe(20_000);      // 30000 - 10000
    expect(r.a.totalIdle).toBe(20_000);
  });
  it("computes per-boss cumulative time difference matched by boss identity", () => {
    const r = compareTimelines(A, B);
    const diff = r.bossDiffs.find((d) => d.boss === "Kalecgos")!;
    expect(diff.cumulativeDiff).toBe(20_000);     // A reached boss-end at 90000, B at 70000
    expect(diff.severity).toBe("major");          // A is slower → behind → red
  });
  it("flags long idle gaps", () => {
    const slow = rep("slow", [
      { id: 1, name: "T", encounterId: 0, isBoss: false, startTime: 0, endTime: 1000 },
      { id: 2, name: "T2", encounterId: 0, isBoss: false, startTime: 200_000, endTime: 201_000 },
    ]);
    const r = compareTimelines(slow, B);
    expect(r.a.pulls[1]!.idleSeverity).toBe("major");
  });
});
