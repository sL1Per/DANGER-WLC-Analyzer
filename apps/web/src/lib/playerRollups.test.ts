import { describe, expect, it } from "vitest";
import type { ConsumableRow, RpbRow } from "@wcl/core";
import { consumablesStatus, statusHeat, verdict } from "./playerRollups";

const cons = (o: Partial<ConsumableRow>): ConsumableRow => ({
  playerId: 1, playerName: "P", elixirOrFlask: 0, battleElixir: 0, guardianElixir: 0,
  flask: 0, food: 0, scrolls: "", scrollUptime: 0, weaponEnhancement: 0,
  jcNeck: { usedOnFights: 0, inactiveOnFights: 0, equipped: false },
  suboptimal: [], totalAverage: 0, ...o,
} as ConsumableRow);

const rpbRow = (o: Partial<RpbRow>): RpbRow => ({
  playerId: 1, playerName: "P", className: "Mage", role: "caster", deaths: 0,
  interruptedSpells: 0, interruptSources: [], totalAbsorbed: 0, friendlyFire: 0,
  damageReflected: 0, damageToHostilePlayers: 0, totalAvoidableDamageTaken: 0,
  totalPartlyAvoidable: 0, classRows: [], engineeringDamage: 0, oilOfImmolationDamage: 0,
  battleShoutUptime: 0, activity: null, severity: "ok", ...o,
} as RpbRow);

describe("consumablesStatus", () => {
  it("missing when nothing was consumed", () => {
    expect(consumablesStatus(cons({}))).toBe("missing");
    expect(consumablesStatus(undefined)).toBe("missing");
  });
  it("full when elixir/flask, food and weapon are all high", () => {
    expect(consumablesStatus(cons({ elixirOrFlask: 1, food: 0.95, weaponEnhancement: 1 }))).toBe("full");
  });
  it("full ignores weapon enhancement when there is no gear snapshot (null)", () => {
    expect(consumablesStatus(cons({ elixirOrFlask: 0.95, food: 0.95, weaponEnhancement: null }))).toBe("full");
  });
  it("partial when some but not all disciplines are kept", () => {
    expect(consumablesStatus(cons({ elixirOrFlask: 1, food: 0, weaponEnhancement: 0 }))).toBe("partial");
  });
});

describe("statusHeat", () => {
  it("maps statuses to heat buckets", () => {
    expect(statusHeat("full")).toBe("good");
    expect(statusHeat("partial")).toBe("watch");
    expect(statusHeat("missing")).toBe("bad");
  });
});

describe("verdict", () => {
  it("concern on a death", () => {
    expect(verdict(rpbRow({ deaths: 2, severity: "major" }), 0).key).toBe("concern");
  });
  it("attention on a moderate severity or gear flags", () => {
    expect(verdict(rpbRow({ severity: "moderate" }), 0).key).toBe("attention");
    expect(verdict(rpbRow({ severity: "ok" }), 3).key).toBe("attention");
  });
  it("exemplary when clean", () => {
    expect(verdict(rpbRow({ severity: "ok" }), 0).key).toBe("exemplary");
  });
});
