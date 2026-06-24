import { describe, expect, it } from "vitest";
import { avoidableAbilities, avoidableAbilityIds, avoidableDebuffIds } from "./avoidableAbilities";

describe("avoidableAbilities", () => {
  it("each entry has an abilityId and name", () => {
    for (const a of avoidableAbilities) {
      expect(Number.isInteger(a.abilityId)).toBe(true);
      expect(a.name.length).toBeGreaterThan(0);
    }
  });
  it("avoidableAbilityIds is a set of the ability ids", () => {
    for (const a of avoidableAbilities) expect(avoidableAbilityIds.has(a.abilityId)).toBe(true);
  });
});

it("avoidableDebuffIds are unique and named", () => {
  const ids = avoidableDebuffIds.map((d) => d.spellId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(avoidableDebuffIds.every((d) => d.name.length > 0)).toBe(true);
});
