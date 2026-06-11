import { describe, expect, it } from "vitest";
import { itemSockets, itemShadowRes, spellHaste, badEnchants, excludedItems, trashRequirements } from "./index";

describe("reference data", () => {
  it("loads item sockets with plausible volume and values", () => {
    expect(Object.keys(itemSockets).length).toBeGreaterThan(1000);
    expect(itemSockets["21865"]).toBe(3); // Soulcloth Vest, visible in xlsx dump
  });
  it("loads shadow res data", () => {
    expect(Object.keys(itemShadowRes).length).toBeGreaterThan(1000);
  });
  it("loads spell haste data", () => {
    // Only 143 rows survive the Google-Sheets export (rest were IMPORTRANGE-linked);
    // revisit in M5 if more spell-haste data is needed.
    expect(Object.keys(spellHaste).length).toBeGreaterThan(100);
    expect(spellHaste["34340"]).toBe(30); // first row of the config sheet
  });
  it("loads enchant/item/trash lists", () => {
    expect(badEnchants.find((e) => e.enchantId === 927)).toMatchObject({ slot: 8, name: "Bracers - 7 Str" });
    expect(badEnchants.some((e) => e.slot === null)).toBe(true); // slot-agnostic enchants exist
    expect(excludedItems.find((i) => i.itemId === 15138)?.name).toBe("Onyxia Scale Cloak");
    expect(trashRequirements.find((t) => t.name === "Sunblade Scout")?.minKills).toBe(4);
  });
});
