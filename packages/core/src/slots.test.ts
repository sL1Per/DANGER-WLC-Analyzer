import { describe, expect, it } from "vitest";
import { SLOT_NAMES, LISTING_SLOTS, ENCHANTABLE_SLOTS, REQUIRED_SLOTS } from "./slots";

describe("slot constants", () => {
  it("names match the original spreadsheet layout", () => {
    expect(SLOT_NAMES[8]).toBe("Bracers");
    expect(SLOT_NAMES[14]).toBe("Cloak");
    expect(SLOT_NAMES[17]).toBe("Wand/Idol/Relic");
  });
  it("listing shows 17 slots, no shirt/tabard", () => {
    expect(LISTING_SLOTS).toHaveLength(17);
    expect(LISTING_SLOTS).not.toContain(3);
    expect(LISTING_SLOTS).not.toContain(18);
  });
  it("enchantable slots exclude rings, neck, trinkets, off-hand", () => {
    for (const s of [1, 10, 11, 12, 13, 16]) expect(ENCHANTABLE_SLOTS.has(s)).toBe(false);
    for (const s of [0, 2, 4, 6, 7, 8, 9, 14, 15]) expect(ENCHANTABLE_SLOTS.has(s)).toBe(true);
  });
  it("required slots exclude off-hand and ranged (class-dependent)", () => {
    expect(REQUIRED_SLOTS).not.toContain(16);
    expect(REQUIRED_SLOTS).not.toContain(17);
    expect(REQUIRED_SLOTS).toContain(15);
  });
});
