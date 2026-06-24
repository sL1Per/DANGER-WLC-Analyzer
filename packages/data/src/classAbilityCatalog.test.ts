import { describe, it, expect } from "vitest";
import { classAbilityCatalog } from "./classAbilityCatalog";
import { classAbilities } from "./classAbilities";

describe("classAbilityCatalog", () => {
  it("has unique (className,key) and valid categories", () => {
    const seen = new Set<string>();
    for (const a of classAbilityCatalog) {
      const k = `${a.className}:${a.key}`;
      expect(seen.has(k)).toBe(false); seen.add(k);
      expect(["single", "aoe", "cooldown", "heal"]).toContain(a.category);
      expect(a.spellIds.length).toBeGreaterThan(0);
    }
  });
  it("covers every tracked classAbilities entry", () => {
    for (const t of classAbilities) {
      expect(classAbilityCatalog.some((c) => c.className === t.className && c.key === t.key)).toBe(true);
    }
  });
  it("groups by the eight raid classes", () => {
    const classes = new Set(classAbilityCatalog.map((a) => a.className));
    for (const c of ["Warrior","Paladin","Hunter","Rogue","Priest","Shaman","Mage","Warlock","Druid"]) {
      expect(classes.has(c)).toBe(true);
    }
  });
});
