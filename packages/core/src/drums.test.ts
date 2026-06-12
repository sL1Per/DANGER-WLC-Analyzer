import { describe, expect, it } from "vitest";
import { drums, type DrumConfig, type DrumRow } from "./drums";
import { reportFixture } from "./fixtures/report.fixture";
import type { ReportData } from "./types";

const cfg: DrumConfig = {
  drums: [
    { castId: 35476, buffId: 35476, kind: "battle", greater: false, name: "Drums of Battle" },
    { castId: 351355, buffId: 351355, kind: "battle", greater: true, name: "Greater Drums of Battle" },
    { castId: 35475, buffId: 35475, kind: "war", greater: false, name: "Drums of War" },
  ],
};

const rowFor = (report: ReportData, name: string): DrumRow => {
  const result = drums(report, cfg);
  const row = result?.rows.find((r) => r.playerName === name);
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

describe("drums — fixture baseline", () => {
  it("computes Playerone's row from the fixture", () => {
    const p1 = rowFor(reportFixture, "Playerone");
    expect(p1.playerId).toBe(1);
    expect(p1.battle).toEqual({ casts: 2, avgBuffs: 1.5 });
    expect(p1.war).toEqual({ casts: 0, avgBuffs: 0 });
    expect(p1.restoration).toEqual({ casts: 0, avgBuffs: 0 });
    expect(p1.wasted).toBe(1); // second cast buffed nobody = "on Tinnitus"
    expect(p1.total).toBe(2);
    expect(p1.avgBuffsPerDrum).toBe(1.5);
    expect(p1.weightedScore).toBe(3); // = total successful applications
    expect(p1.lesserCasts).toBe(2); // 35476 is the non-greater version
  });
  it("gives no row to players without drum casts", () => {
    const result = drums(reportFixture, cfg);
    expect(result?.rows.map((r) => r.playerName)).toEqual(["Playerone"]);
  });
});

describe("drums — application matching", () => {
  it("ignores applications outside the 1500ms window after the cast", () => {
    const report = structuredClone(reportFixture);
    // 1600ms after cast #1 (151_000): just past the window — must not count
    report.drumApplications!.push({ fightId: 3, sourceId: 1, targetId: 2, spellId: 35476, timestamp: 152_600 });
    const p1 = rowFor(report, "Playerone");
    expect(p1.weightedScore).toBe(3);
    expect(p1.battle.avgBuffs).toBe(1.5);
  });
  it("attributes an application to the earliest matching cast only (greedy)", () => {
    const report = structuredClone(reportFixture);
    // two casts 200ms apart, ONE application 250ms after the first cast:
    // both windows contain it, but it belongs to the first cast — the second is wasted
    report.drumCasts = [
      { fightId: 3, sourceId: 1, spellId: 35476, timestamp: 151_000 },
      { fightId: 3, sourceId: 1, spellId: 35476, timestamp: 151_200 },
    ];
    report.drumApplications = [
      { fightId: 3, sourceId: 1, targetId: 2, spellId: 35476, timestamp: 151_250 },
    ];
    const p1 = rowFor(report, "Playerone");
    expect(p1.weightedScore).toBe(1);
    expect(p1.wasted).toBe(1);
    expect(p1.battle).toEqual({ casts: 2, avgBuffs: 0.5 });
  });
  it("does not match applications from other sources", () => {
    const report = structuredClone(reportFixture);
    report.drumApplications!.push({ fightId: 3, sourceId: 2, targetId: 1, spellId: 35476, timestamp: 151_150 });
    const p1 = rowFor(report, "Playerone");
    expect(p1.weightedScore).toBe(3);
  });
});

describe("drums — greater vs lesser", () => {
  it("counts only non-greater casts as lesser", () => {
    const report = structuredClone(reportFixture);
    report.drumCasts![1]!.spellId = 351355; // upgrade the wasted cast to Greater Drums of Battle
    const p1 = rowFor(report, "Playerone");
    expect(p1.lesserCasts).toBe(1);
    expect(p1.battle.casts).toBe(2); // greater + lesser combine in the kind column
    expect(p1.total).toBe(2);
  });
});

describe("drums — input handling", () => {
  it("ignores casts whose spellId is not a configured drum", () => {
    const report = structuredClone(reportFixture);
    report.drumCasts!.push({ fightId: 3, sourceId: 1, spellId: 99999, timestamp: 160_000 });
    const p1 = rowFor(report, "Playerone");
    expect(p1.total).toBe(2);
    expect(p1.wasted).toBe(1);
  });
  it("returns null when the report predates M3 (no drum data cached)", () => {
    const report = structuredClone(reportFixture);
    delete report.drumCasts;
    delete report.drumApplications;
    expect(drums(report, cfg)).toBeNull();
  });
  it("sorts rows alphabetically by player name", () => {
    const report = structuredClone(reportFixture);
    report.drumCasts!.push({ fightId: 1, sourceId: 2, spellId: 35475, timestamp: 10_000 });
    const result = drums(report, cfg);
    expect(result?.rows.map((r) => r.playerName)).toEqual(["Playerone", "Playertwo"]);
    expect(result?.rows[1]?.war).toEqual({ casts: 1, avgBuffs: 0 });
  });
});
