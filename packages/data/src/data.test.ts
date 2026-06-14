import { describe, expect, it } from "vitest";
import { roleSignals, hasteBuffs, engineeringDamageIds } from "./rpb";
import { itemSockets, itemShadowRes, spellHaste, badEnchants, excludedItems, gemQuality } from "./index";
import { spellCastTimes } from "./index";
import { consumableBuffs, drumSpells, jcNecks, suboptimalConsumables, weaponEnhancementEnchantIds } from "./index";
import { validateRules, zoneCodeByName } from "./index";
import { shadowResEnchants, shadowResBuffs, SR_SOFT_TARGET } from "./index";

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
  it("loads gem quality with plausible volume and known values", () => {
    // full TBC gem set extracted from Wowhead's gem listing
    expect(Object.keys(gemQuality).length).toBeGreaterThan(250);
    for (const q of Object.values(gemQuality)) expect(q).toBeGreaterThanOrEqual(1);
    for (const q of Object.values(gemQuality)) expect(q).toBeLessThanOrEqual(4);
    expect(gemQuality["23097"]).toBe(2); // Delicate Blood Garnet — uncommon (XML-verified)
    expect(gemQuality["24030"]).toBe(3); // Runed Living Ruby — rare
    expect(gemQuality["30553"]).toBe(4); // Pristine Fire Opal — epic
  });
  it("loads enchant/item/trash lists", () => {
    expect(badEnchants.find((e) => e.enchantId === 927)).toMatchObject({ slot: 8, name: "Bracers - 7 Str" });
    expect(badEnchants.some((e) => e.slot === null)).toBe(true); // slot-agnostic enchants exist
    expect(excludedItems.find((i) => i.itemId === 15138)?.name).toBe("Onyxia Scale Cloak");
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
  it("has a deduped whitelist of consumable weapon-enhancement enchant ids", () => {
    expect(weaponEnhancementEnchantIds.length).toBeGreaterThan(20);
    expect(new Set(weaponEnhancementEnchantIds).size).toBe(weaponEnhancementEnchantIds.length);
    // includes the data-confirmed consumables, excludes shaman imbue / Windfury Totem
    expect(weaponEnhancementEnchantIds).toContain(2678); // Superior Wizard Oil
    expect(weaponEnhancementEnchantIds).toContain(2955); // Adamantite Weightstone
    expect(weaponEnhancementEnchantIds).not.toContain(2636); // Windfury (shaman imbue)
    expect(weaponEnhancementEnchantIds).not.toContain(2639); // Windfury Totem (ally buff)
  });
});

describe("speedrun validation rules", () => {
  it("covers the curated speedrun zones", () => {
    const zones = new Set(validateRules.map((r) => r.zone));
    expect(zones).toEqual(new Set(["SW", "MH", "BT", "ZA"]));
  });
  it("keeps the xlsx-verified SW rules intact", () => {
    const sw = validateRules.find((r) => r.zone === "SW")!;
    expect(sw.verified).toBe(true);
    const protector = sw.trash.find((t) => t.npcIds.includes(25507))!;
    expect(protector.minKills).toBe(5);
    const archmage = sw.trash.find((t) => t.npcIds.includes(25363))!;
    expect(archmage.minKills).toBe(65);
    expect(sw.boss).toEqual({ kind: "single", count: 6 });
  });
  it("uses the split boss rule where two zones are combined", () => {
    const splits = validateRules.filter((r) => r.boss.kind === "split");
    expect(splits.length).toBe(1); // exactly the MH+BT combined run
  });
  it("flags every non-SW zone as unverified until a human checks it", () => {
    for (const r of validateRules) {
      if (r.zone !== "SW") expect(r.verified).toBe(false);
      expect(r.startingPointNpcIds.length).toBeGreaterThan(0);
      for (const t of r.trash) { expect(t.npcIds.length).toBeGreaterThan(0); expect(t.minKills).toBeGreaterThan(0); }
    }
  });
  it("maps full WCL zone names to short codes", () => {
    expect(zoneCodeByName["Sunwell Plateau"]).toBe("SW");
    expect(zoneCodeByName["Black Temple"]).toBe("BT");
    expect(zoneCodeByName["Mount Hyjal"]).toBe("MH");
    expect(zoneCodeByName["Zul'Aman"]).toBe("ZA");
  });
});

describe("spellCastTimes", () => {
  it("has many rows and known cast times in deci-seconds", () => {
    expect(Object.keys(spellCastTimes).length).toBeGreaterThan(1000);
    expect(spellCastTimes["30451"]).toBe(25); // Arcane Blast = 2.5s
  });
});

describe("shadow resistance reference data", () => {
  it("maps SR permanent enchants by ENCHANTMENT id (not spell id)", () => {
    expect(Object.keys(shadowResEnchants).length).toBeGreaterThan(0);
    for (const v of Object.values(shadowResEnchants)) expect(v).toBeGreaterThan(0);
    expect(shadowResEnchants["804"]).toBe(10); // Lesser Shadow Resistance (cloak)
    expect(shadowResEnchants["1441"]).toBe(15); // Greater Shadow Resistance (cloak)
    // regression guard: combatantInfo reports enchantment ids, never the casting spell ids
    expect(shadowResEnchants["13522"]).toBeUndefined();
    expect(shadowResEnchants["27101"]).toBeUndefined();
    expect(shadowResEnchants["34006"]).toBeUndefined();
  });
  it("maps SR buff auras by spell id (Shadow Protection / Resistance Aura)", () => {
    expect(Object.values(shadowResBuffs)).toContain(70);
    expect(shadowResBuffs["25433"]).toBe(70); // Shadow Protection (max rank)
    expect(shadowResBuffs["27151"]).toBe(70); // Shadow Resistance Aura (max rank)
  });
  it("exposes an advisory soft target", () => {
    expect(SR_SOFT_TARGET).toBeGreaterThan(0);
  });
});

describe("rpb curated data", () => {
  it("has role signals, haste buffs, and engineering ids", () => {
    expect(roleSignals.some((s) => s.spellId === 71 && s.role === "tank")).toBe(true);
    expect(hasteBuffs.find((h) => h.spellId === 2825)?.pct).toBe(0.3);
    expect(engineeringDamageIds.length).toBeGreaterThan(0);
  });
});
