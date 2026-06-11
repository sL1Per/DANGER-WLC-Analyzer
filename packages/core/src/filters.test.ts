import { describe, expect, it } from "vitest";
import { filterFights, validateFilter } from "./filters";
import { reportFixture } from "./fixtures/report.fixture";

const fights = reportFixture.fights;
const ids = (f: ReturnType<typeof filterFights>) => f.map((x) => x.id);

describe("filterFights", () => {
  it("returns everything in 'all' mode", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: false }))).toEqual([1, 2, 3, 4, 5]);
  });
  it("filters bosses only", () => {
    expect(ids(filterFights(fights, { mode: "bosses", excludeWipes: false }))).toEqual([2, 3, 5]);
  });
  it("filters trash only", () => {
    expect(ids(filterFights(fights, { mode: "trash", excludeWipes: false }))).toEqual([1, 4]);
  });
  it("excludes wipes (trash unaffected)", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: true }))).toEqual([1, 3, 4, 5]);
  });
  it("selects a single fight id", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: false, fightId: 2 }))).toEqual([2]);
  });
  it("'last' selects the final fight matching the mode", () => {
    expect(ids(filterFights(fights, { mode: "bosses", excludeWipes: false, fightId: "last" }))).toEqual([5]);
  });
  it("selects by time range overlap", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: false, range: { start: 0, end: 100_000 } })))
      .toEqual([1, 2]);
  });
  it("returns empty when fightId matches nothing", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: false, fightId: 99 }))).toEqual([]);
  });
  it("'last' on an empty filtered set returns empty", () => {
    const allWipes = fights.map((f) => (f.isBoss ? { ...f, kill: false } : f));
    expect(ids(filterFights(allWipes, { mode: "bosses", excludeWipes: true, fightId: "last" }))).toEqual([]);
  });
  it("range endpoints are exclusive (touching fights excluded)", () => {
    expect(ids(filterFights(fights, { mode: "all", excludeWipes: false, range: { start: 60_000, end: 70_000 } }))).toEqual([]);
  });
});

describe("validateFilter", () => {
  it("rejects fightId and range together", () => {
    expect(validateFilter({ mode: "all", excludeWipes: false, fightId: 2, range: { start: 0, end: 1 } }))
      .toMatch(/fight id OR a start and end/i);
  });
  it("accepts either alone", () => {
    expect(validateFilter({ mode: "all", excludeWipes: false, fightId: 2 })).toBeNull();
    expect(validateFilter({ mode: "all", excludeWipes: false })).toBeNull();
  });
});
