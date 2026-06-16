import { describe, expect, it } from "vitest";
import type { RpbRow } from "@wcl/core";
import { groupByClass } from "./rpbGrouping";

const mk = (name: string, className: string): RpbRow => ({
  playerId: name.length,
  playerName: name,
  className,
  role: "caster",
  deaths: 0,
  interruptedSpells: 0,
  interruptSources: [],
  totalAbsorbed: 0,
  friendlyFire: 0,
  damageReflected: 0,
  damageToHostilePlayers: 0,
  totalAvoidableDamageTaken: 0,
  totalPartlyAvoidable: 0,
  classRows: [],
  engineeringDamage: 0,
  oilOfImmolationDamage: 0,
  battleShoutUptime: 0,
  activity: null,
  severity: "ok",
});

describe("groupByClass", () => {
  it("orders classes canonically and sorts players by name within a class", () => {
    const groups = groupByClass([mk("Zed", "Mage"), mk("Ana", "Warrior"), mk("Bob", "Mage")]);
    expect(groups.map((g) => g.className)).toEqual(["Warrior", "Mage"]);
    expect(groups[1]!.rows.map((r) => r.playerName)).toEqual(["Bob", "Zed"]);
  });
  it("appends unknown classes after the known canonical ones", () => {
    const groups = groupByClass([mk("X", "Tinker"), mk("Y", "Priest")]);
    expect(groups.map((g) => g.className)).toEqual(["Priest", "Tinker"]);
  });
  it("sorts multiple unknown classes by name among themselves", () => {
    const groups = groupByClass([mk("X", "Wizard"), mk("Y", "Tinker"), mk("Z", "Priest")]);
    expect(groups.map((g) => g.className)).toEqual(["Priest", "Tinker", "Wizard"]);
  });
  it("returns an empty list for no rows", () => {
    expect(groupByClass([])).toEqual([]);
  });
});
