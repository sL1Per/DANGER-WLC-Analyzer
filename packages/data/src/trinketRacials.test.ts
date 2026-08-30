import { describe, it, expect } from "vitest";
import { trinketRacials } from "./trinketRacials";

describe("trinketRacials", () => {
  it("has unique spell ids and non-empty names", () => {
    const ids = trinketRacials.map((t) => t.spellId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(trinketRacials.every((t) => t.name.length > 0)).toBe(true);
  });
});
