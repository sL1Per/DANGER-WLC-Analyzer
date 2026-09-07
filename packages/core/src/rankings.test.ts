import { describe, expect, it } from "vitest";
import { buildRankingsGrid } from "./rankings";
import { reportFixture } from "./fixtures/report.fixture";

describe("buildRankingsGrid", () => {
  it("returns null when there is no rankings data", () => {
    expect(buildRankingsGrid(undefined)).toBeNull();
    expect(buildRankingsGrid([])).toBeNull();
  });

  it("lists bosses in fight order", () => {
    const grid = buildRankingsGrid(reportFixture.rankings)!;
    expect(grid.bosses.map((b) => b.name)).toEqual([
      "Hydross the Unstable",
      "The Lurker Below",
    ]);
  });

  it("groups players into dps/healers/tanks sections in order", () => {
    const grid = buildRankingsGrid(reportFixture.rankings)!;
    expect(grid.sections.map((s) => s.role)).toEqual(["dps", "healers", "tanks"]);
  });

  it("pivots each player's parses keyed by fightID", () => {
    const grid = buildRankingsGrid(reportFixture.rankings)!;
    const dps = grid.sections.find((s) => s.role === "dps")!;
    const playerone = dps.players.find((p) => p.name === "Playerone")!;
    expect(playerone.perBoss[3]!.rankPercent).toBe(95);
    expect(playerone.perBoss[5]!.rankPercent).toBe(99);
    expect(playerone.overall).toBe(97); // (95 + 99) / 2
  });

  it("omits bosses a player has no parse for (sparse perBoss)", () => {
    const grid = buildRankingsGrid(reportFixture.rankings)!;
    const tanks = grid.sections.find((s) => s.role === "tanks")!;
    const tank = tanks.players.find((p) => p.name === "Playertwo")!;
    expect(tank.perBoss[3]!.rankPercent).toBe(40);
    expect(tank.perBoss[5]).toBeUndefined(); // no Lurker tank entry
  });

  it("excludes a boss entry whose rankPercent is NaN (WCL had no percentile for that character)", () => {
    const rankings = [
      {
        fightID: 3, encounterId: 623, encounterName: "Hydross",
        dps: [
          { name: "Neyyd", class: "Druid", rankPercent: NaN, bracketPercent: 0, parse: 678 },
          { name: "High", class: "Mage", rankPercent: 90, bracketPercent: 90, parse: 900 },
        ],
        healers: [], tanks: [],
      },
    ];
    const grid = buildRankingsGrid(rankings)!;
    const dps = grid.sections.find((s) => s.role === "dps")!;
    const neyyd = dps.players.find((p) => p.name === "Neyyd")!;
    expect(neyyd.perBoss[3]).toBeUndefined();
    expect(neyyd.overall).toBe(0);
  });

  it("still returns a grid (roster with dashes) when every character's rankPercent is NaN — a fresh report WCL hasn't ranked yet is not the same as no kills", () => {
    const rankings = [
      {
        fightID: 3, encounterId: 623, encounterName: "Hydross",
        dps: [{ name: "Neyyd", class: "Druid", rankPercent: NaN, bracketPercent: 0, parse: 678 }],
        healers: [], tanks: [],
      },
    ];
    const grid = buildRankingsGrid(rankings);
    expect(grid).not.toBeNull();
    const dps = grid!.sections.find((s) => s.role === "dps")!;
    expect(dps.players.map((p) => p.name)).toEqual(["Neyyd"]);
    expect(dps.players[0]!.perBoss[3]).toBeUndefined();
  });

  it("sorts players within a section by overall parse descending", () => {
    const rankings = [
      {
        fightID: 3, encounterId: 623, encounterName: "Hydross",
        dps: [
          { name: "Low", class: "Mage", rankPercent: 30, bracketPercent: 30, parse: 300 },
          { name: "High", class: "Mage", rankPercent: 90, bracketPercent: 90, parse: 900 },
        ],
        healers: [], tanks: [],
      },
    ];
    const grid = buildRankingsGrid(rankings)!;
    expect(grid.sections[0]!.players.map((p) => p.name)).toEqual(["High", "Low"]);
  });
});
