import { describe, expect, it } from "vitest";
import { classAbilities } from "./classAbilities";

describe("classAbilities", () => {
  it("every ability has a class, key, name and at least one spell id", () => {
    for (const a of classAbilities) {
      expect(a.className.length).toBeGreaterThan(0);
      expect(a.key.length).toBeGreaterThan(0);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.spellIds.length).toBeGreaterThan(0);
    }
  });

  it("keys are unique", () => {
    const keys = classAbilities.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("rank-checked abilities list a rank for every rank-checked spell id", () => {
    for (const a of classAbilities) {
      if (!a.ranks) continue;
      const ranked = new Set(a.ranks.map((r) => r.spellId));
      for (const r of a.ranks) expect(typeof r.rank).toBe("number");
      for (const id of ranked) expect(a.spellIds).toContain(id);
    }
  });

  it("covers all nine TBC classes", () => {
    const classes = new Set(classAbilities.map((a) => a.className));
    for (const c of ["Warrior","Paladin","Hunter","Rogue","Priest","Shaman","Mage","Warlock","Druid"]) {
      expect(classes.has(c)).toBe(true);
    }
  });
});
