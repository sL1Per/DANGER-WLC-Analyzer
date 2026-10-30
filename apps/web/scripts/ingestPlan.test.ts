import { describe, expect, it } from "vitest";
import type { GuildReport } from "../src/lib/wcl/wcl";
import { initialState, markPosted, planIngest, unchanged } from "./ingestPlan";

const MIN = 60_000;
const QUIET = 30 * MIN;
const T0 = 1_000_000_000_000;

function report(over: Partial<GuildReport> & { code: string }): GuildReport {
  return {
    title: over.code, startTime: T0, endTime: T0 + 120 * MIN, zone: { name: "BT / Hyjal" },
    fights: [{ encounterID: 601, kill: true, startTime: 0 }], ...over,
  };
}

describe("planIngest", () => {
  const now = T0 + 300 * MIN;

  it("posts a log uploaded long after the raid ended", () => {
    // Raid ended hours ago and was only uploaded the next morning.
    const r = report({ code: "late", endTime: now - 12 * 60 * MIN });
    expect(planIngest([r], initialState(), now, QUIET).toPost.map((x) => x.code)).toEqual(["late"]);
  });

  it("waits while a log is still being live-logged", () => {
    const r = report({ code: "live", endTime: now - 2 * MIN });
    expect(planIngest([r], initialState(), now, QUIET).toPost).toEqual([]);
  });

  it("posts once the log has been quiet for the quiet period", () => {
    const r = report({ code: "done", endTime: now - QUIET });
    expect(planIngest([r], initialState(), now, QUIET).toPost.map((x) => x.code)).toEqual(["done"]);
  });

  it("does not post a log that has no boss fights", () => {
    const r = report({ code: "trash", fights: [{ encounterID: 0, kill: null, startTime: 0 }] });
    expect(planIngest([r], initialState(), now, QUIET).toPost).toEqual([]);
  });

  it("never re-posts a report already marked posted", () => {
    const r = report({ code: "done" });
    const state = markPosted(initialState(), "done", "share1");
    expect(planIngest([r], state, now, QUIET).toPost).toEqual([]);
  });

  it("does not change state for reports it posts (the job marks them after Discord accepts)", () => {
    const r = report({ code: "done" });
    expect(planIngest([r], initialState(), now, QUIET).nextState.posted).toEqual({});
  });

  it("orders posts oldest first", () => {
    const a = report({ code: "a", startTime: T0 + 200 * MIN, endTime: T0 + 250 * MIN });
    const b = report({ code: "b", startTime: T0 + 10 * MIN, endTime: T0 + 60 * MIN });
    expect(planIngest([a, b], initialState(), now, QUIET).toPost.map((x) => x.code)).toEqual(["b", "a"]);
  });

  it("caps the posted history", () => {
    let state = initialState();
    for (let i = 0; i < 250; i++) state = markPosted(state, `c${i}`, `s${i}`);
    const posted = planIngest([], state, now, QUIET).nextState.posted;
    expect(Object.keys(posted)).toHaveLength(200);
    expect(posted.c249).toBe("s249");
    expect(posted.c0).toBeUndefined();
  });

  describe("two loggers of the same raid", () => {
    // Mirrors guild 811975 on 2026-10-25: a full-night log (Hyjal then ZA) and a
    // second raider's Hyjal-only log with the same 7 pulls, a few seconds apart.
    const hyjal = (offsetMs: number) => [601, 602, 603, 604, 605, 605, 605].map((id, i) =>
      ({ encounterID: id, kill: true, startTime: offsetMs + i * 10 * MIN }));
    const za = [1189, 1190, 1191, 1192, 1193, 1194].map((id, i) =>
      ({ encounterID: id, kill: true, startTime: 90 * MIN + i * 10 * MIN }));
    const full = report({ code: "full", startTime: T0, endTime: T0 + 176 * MIN, fights: [...hyjal(30 * MIN), ...za] });
    const part = report({ code: "part", startTime: T0 + 18 * MIN, endTime: T0 + 104 * MIN,
      fights: hyjal(12 * MIN + 5_000) });

    it("waits while any overlapping log is still growing", () => {
      expect(planIngest([full, part], initialState(), T0 + 180 * MIN, QUIET).toPost).toEqual([]);
    });

    it("posts only the log with the most boss fights and marks the other as a duplicate", () => {
      const { toPost, nextState } = planIngest([full, part], initialState(), now, QUIET);
      expect(toPost.map((x) => x.code)).toEqual(["full"]);
      expect(nextState.posted.part).toBeNull();
    });

    it("marks a later-uploaded log of an already-posted raid as a duplicate", () => {
      const { toPost, nextState } = planIngest([full, part], markPosted(initialState(), "full", "share1"), now, QUIET);
      expect(toPost).toEqual([]);
      expect(nextState.posted.part).toBeNull();
    });

    it("treats overlapping logs with different boss pulls as separate raids", () => {
      const other = report({ code: "other", startTime: T0 + 18 * MIN, endTime: T0 + 104 * MIN,
        fights: [{ encounterID: 601, kill: true, startTime: 40 * MIN }] });
      expect(planIngest([full, other], initialState(), now, QUIET).toPost.map((x) => x.code)).toEqual(["full", "other"]);
    });
  });
});

describe("unchanged", () => {
  it("keeps reports whose endTime and fight count didn't move between two listings", () => {
    const a = report({ code: "a" });
    const b = report({ code: "b" });
    const bGrew = { ...b, endTime: b.endTime + MIN, fights: [...b.fights, { encounterID: 602, kill: true, startTime: 1 }] };
    expect(unchanged([a, b], [a, bGrew]).map((r) => r.code)).toEqual(["a"]);
  });

  it("drops reports missing from the later listing", () => {
    expect(unchanged([report({ code: "a" })], [])).toEqual([]);
  });
});
