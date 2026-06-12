import { describe, expect, it } from "vitest";
import { itemSockets, itemShadowRes, spellHaste, badEnchants, excludedItems, trashRequirements } from "./index";
import { consumableBuffs, drumSpells, jcNecks, suboptimalConsumables } from "./index";

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

describe("consumable reference data", () => {
  it("classifies buffs into the CLA categories", () => {
    const categories = new Set(consumableBuffs.map((b) => b.category));
    expect(categories).toEqual(new Set(["battleElixir", "guardianElixir", "flask", "food", "scroll"]));
    expect(consumableBuffs.find((b) => b.spellId === 28497)?.category).toBe("battleElixir"); // Elixir of Major Agility
    expect(consumableBuffs.find((b) => b.spellId === 28520)?.category).toBe("flask"); // Relentless Assault
  });
  it("scroll entries carry type and level", () => {
    const agi5 = consumableBuffs.find((b) => b.scroll?.type === "Agi" && b.scroll.level === 5);
    expect(agi5).toBeDefined();
  });
  it("drum spells distinguish greater/lesser and map cast->buff", () => {
    expect(drumSpells.some((d) => d.kind === "battle" && d.greater)).toBe(true);
    expect(drumSpells.some((d) => d.kind === "battle" && !d.greater)).toBe(true);
    for (const d of drumSpells) expect(d.buffId).toBeGreaterThan(0);
  });
  it("JC necks map item id to on-use buff id", () => {
    expect(jcNecks.length).toBeGreaterThanOrEqual(4);
    for (const n of jcNecks) {
      expect(n.itemId).toBeGreaterThan(0);
      expect(n.buffId).toBeGreaterThan(0);
    }
  });
  it("lists suboptimal consumables with buff and temp-enchant kinds", () => {
    const kinds = new Set(suboptimalConsumables.map((s) => s.kind));
    expect(kinds).toEqual(new Set(["buff", "tempEnchant"]));
  });
  it("has no duplicate ids in any curated table", () => {
    for (const ids of [
      consumableBuffs.map((b) => b.spellId),
      drumSpells.map((d) => d.castId),
      jcNecks.map((n) => n.itemId),
      suboptimalConsumables.map((s) => `${s.kind}|${s.id}`),
    ]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
