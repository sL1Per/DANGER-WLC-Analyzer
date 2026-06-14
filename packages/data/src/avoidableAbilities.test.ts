import { describe, expect, it } from "vitest";
import { avoidableAbilities, avoidableAbilityIds } from "./avoidableAbilities";

describe("avoidableAbilities", () => {
  it("each entry has an abilityId and name", () => {
    for (const a of avoidableAbilities) {
      expect(Number.isInteger(a.abilityId)).toBe(true);
      expect(a.name.length).toBeGreaterThan(0);
    }
  });
  it("avoidableAbilityIds is a set of the ability ids", () => {
    expect(avoidableAbilityIds.has(avoidableAbilities[0].abilityId)).toBe(true);
  });
});
