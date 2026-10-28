import { describe, expect, it } from "vitest";
import type { GuildReport } from "../src/lib/wcl/wcl";
import { initialState, markPosted, planIngest, type IngestState } from "./ingestPlan";

const MIN = 60_000;
const SETTLE = 30 * MIN;
const T0 = 1_000_000_000_000;

const roster = (names: string) => ({ actors: names.split("").map((n) => ({ name: n })) });

function report(over: Partial<GuildReport> & { code: string }): GuildReport {
  return {
    title: over.code, startTime: T0, endTime: T0 + 120 * MIN, zone: { name: "BT / Hyjal" },
    fights: [{ encounterID: 601, kill: true }], masterData: roster("ABCDEFGHIJ"), ...over,
  };
}

/** state where `r` was first seen with its current endTime `ago` ms before `now` */
function seen(state: IngestState, r: GuildReport, at: number): IngestState {
  return { ...state, pending: { ...state.pending, [r.code]: { endTime: r.endTime, seenAt: at } } };
}

describe("planIngest", () => {
  const now = T0 + 300 * MIN;

  it("ignores reports that started before `since` (no backfill)", () => {
    const r = report({ code: "old", startTime: T0 - 1 });
    const { toPost, nextState } = planIngest([r], initialState(T0), now, SETTLE);
    expect(toPost).toEqual([]);
    expect(nextState.pending).toEqual({});
  });

  it("puts a newly seen report into pending without posting it", () => {
    const r = report({ code: "new" });
    const { toPost, nextState } = planIngest([r], initialState(T0), now, SETTLE);
    expect(toPost).toEqual([]);
    expect(nextState.pending.new).toEqual({ endTime: r.endTime, seenAt: now });
  });

  it("restarts the settle clock when the log is still growing", () => {
    const r = report({ code: "live" });
    const state = { ...initialState(T0), pending: { live: { endTime: r.endTime - MIN, seenAt: now - 60 * MIN } } };
    const { toPost, nextState } = planIngest([r], state, now, SETTLE);
    expect(toPost).toEqual([]);
    expect(nextState.pending.live).toEqual({ endTime: r.endTime, seenAt: now });
  });

  it("posts a report whose endTime has been unchanged for the settle period", () => {
    const r = report({ code: "done" });
    const { toPost } = planIngest([r], seen(initialState(T0), r, now - SETTLE), now, SETTLE);
    expect(toPost.map((x) => x.code)).toEqual(["done"]);
  });

  it("does not post a settled log that has no boss fights", () => {
    const r = report({ code: "trash", fights: [{ encounterID: 0, kill: null }] });
    const { toPost, nextState } = planIngest([r], seen(initialState(T0), r, now - SETTLE), now, SETTLE);
    expect(toPost).toEqual([]);
    expect(nextState.pending.trash).toBeDefined();
  });

  it("with a zero settle period, posts a finished log on first sight", () => {
    const r = report({ code: "now" });
    expect(planIngest([r], initialState(T0), now, 0).toPost.map((x) => x.code)).toEqual(["now"]);
  });

  it("never re-posts a report already marked posted", () => {
    const r = report({ code: "done" });
    const state = markPosted(seen(initialState(T0), r, now - SETTLE), "done", "share1");
    expect(planIngest([r], state, now, SETTLE).toPost).toEqual([]);
  });

  it("orders posts oldest first", () => {
    const a = report({ code: "a", startTime: T0 + 200 * MIN, endTime: T0 + 250 * MIN, masterData: roster("ABC") });
    const b = report({ code: "b", startTime: T0 + 10 * MIN, endTime: T0 + 60 * MIN, masterData: roster("XYZ") });
    let s = seen(initialState(T0), a, now - SETTLE);
    s = seen(s, b, now - SETTLE);
    expect(planIngest([a, b], s, now, SETTLE).toPost.map((x) => x.code)).toEqual(["b", "a"]);
  });

  it("prunes pending entries for codes WCL no longer lists", () => {
    const state = { ...initialState(T0), pending: { gone: { endTime: 1, seenAt: 1 } } };
    expect(planIngest([], state, now, SETTLE).nextState.pending).toEqual({});
  });

  it("caps the posted history", () => {
    let state = initialState(T0);
    for (let i = 0; i < 250; i++) state = markPosted(state, `c${i}`, `s${i}`);
    const posted = planIngest([], state, now, SETTLE).nextState.posted;
    expect(Object.keys(posted)).toHaveLength(200);
    expect(posted.c249).toBe("s249");
    expect(posted.c0).toBeUndefined();
  });

  describe("two loggers of the same raid", () => {
    // Mirrors guild 811975 on 2026-10-25: a full-night log and a shorter log of
    // the same raid by another raider, overlapping in time and roster.
    const full = report({ code: "full", startTime: T0, endTime: T0 + 176 * MIN,
      fights: Array.from({ length: 14 }, () => ({ encounterID: 601, kill: true })) });
    const part = report({ code: "part", startTime: T0 + 18 * MIN, endTime: T0 + 104 * MIN,
      fights: Array.from({ length: 7 }, () => ({ encounterID: 618, kill: true })),
      masterData: roster("ABCDEFGHIK") });

    it("waits while any overlapping log is still growing", () => {
      const s = seen(seen(initialState(T0), part, now - SETTLE), full, now - MIN);
      expect(planIngest([full, part], s, now, SETTLE).toPost).toEqual([]);
    });

    it("posts only the log with the most boss fights and marks the other as a duplicate", () => {
      const s = seen(seen(initialState(T0), part, now - SETTLE), full, now - SETTLE);
      const { toPost, nextState } = planIngest([full, part], s, now, SETTLE);
      expect(toPost.map((x) => x.code)).toEqual(["full"]);
      expect(nextState.posted.part).toBeNull();
      expect(nextState.pending.part).toBeUndefined();
    });

    it("marks a later log of an already-posted raid as a duplicate", () => {
      const s = seen(markPosted(initialState(T0), "full", "share1"), part, now - SETTLE);
      const { toPost, nextState } = planIngest([full, part], s, now, SETTLE);
      expect(toPost).toEqual([]);
      expect(nextState.posted.part).toBeNull();
    });

    it("treats overlapping logs with different rosters as separate raids", () => {
      const other = { ...part, code: "other", masterData: roster("PQRSTUVWXY") };
      const s = seen(seen(initialState(T0), other, now - SETTLE), full, now - SETTLE);
      expect(planIngest([full, other], s, now, SETTLE).toPost.map((x) => x.code)).toEqual(["full", "other"]);
    });
  });
});

describe("markPosted", () => {
  it("moves a code from pending to posted", () => {
    const state = { ...initialState(T0), pending: { a: { endTime: 1, seenAt: 1 } } };
    const next = markPosted(state, "a", "share1");
    expect(next.posted.a).toBe("share1");
    expect(next.pending.a).toBeUndefined();
  });
});
