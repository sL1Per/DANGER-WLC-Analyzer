import { describe, expect, it } from "vitest";
import { roleSignals, hasteBuffs, engineeringDamageIds } from "./rpb";
import { itemSockets, itemShadowRes, spellHaste, badEnchants, excludedItems, gemQuality } from "./index";
import { spellCastTimes } from "./index";
import { consumableBuffs, drumSpells, jcNecks, suboptimalConsumables, weaponEnhancementEnchantIds } from "./index";
import { shadowResEnchants, shadowResBuffs, SR_SOFT_TARGET } from "./index";
import { classAbilities } from "./classAbilities";

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
    // The three jewelcrafter on-use *stat* necks (Braided Eternium Chain,
    // Eye of the Night, Chain of the Twilight Owl). Regression guard for the
    // detection fix that replaced the wrong on-use *absorb* pendants.
    expect(jcNecks.map((n) => n.itemId).sort()).toEqual([24114, 24116, 24121]);
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
      expect(new Set<unknown>(ids).size).toBe(ids.length);
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

describe("classAbilities (M7: verified against TBC 2.5.4 client DB)", () => {
  it("flags every ability verified after the M7 id audit", () => {
    expect(classAbilities.length).toBeGreaterThan(0);
    for (const a of classAbilities) {
      expect(a.verified, `${a.key} should be verified`).toBe(true);
    }
  });

  it("uses the Judgement (not Seal) of the Crusader debuff ids", () => {
    const joc = classAbilities.find((a) => a.key === "judgement-of-the-crusader")!;
    // 27159 is the TBC max-rank Judgement debuff; 20303 is its base rank.
    expect(joc.spellIds).toContain(27159);
    expect(joc.spellIds).toContain(20303);
    // must NOT include the Seal of the Crusader self-buff ids, nor the nonexistent 20304.
    for (const sealId of [20304, 20305, 20306, 20307, 20308]) {
      expect(joc.spellIds, `${sealId} is Seal/invalid, not the debuff`).not.toContain(sealId);
    }
  });

  it("assigns each rank-checked ability's highest rank to a listed spell id", () => {
    for (const a of classAbilities) {
      if (!a.ranks || a.optimalRank !== "max") continue;
      const maxRank = Math.max(...a.ranks.map((r) => r.rank));
      const maxIds = a.ranks.filter((r) => r.rank === maxRank).map((r) => r.spellId);
      for (const id of maxIds) expect(a.spellIds).toContain(id);
    }
  });
});
