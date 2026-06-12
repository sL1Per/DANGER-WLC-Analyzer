/**
 * TBC consumable buff (aura) spell ids, hand-curated for the consumables tab.
 * NOT extracted from the xlsx (the original kept these in its Apps Script).
 * Every id verified against wowhead.com (TBC Classic) / tbc.cavernoftime.com
 * on 2026-06-12, except lines marked UNVERIFIED.
 *
 * Note: buff (aura) names on Wowhead often differ from the item name
 * (e.g. item "Elixir of Major Strength" applies aura "Major Strength");
 * the `name` field below uses the item-style name raiders know.
 */
export type ConsumableCategory = "battleElixir" | "guardianElixir" | "flask" | "food" | "scroll";
export type ScrollType = "Agi" | "Int" | "Prot" | "Spi" | "Sta" | "Str";

export interface ConsumableBuff {
  spellId: number;
  name: string;
  category: ConsumableCategory;
  scroll?: { type: ScrollType; level: number };
}

export const consumableBuffs: ConsumableBuff[] = [
  // --- battle elixirs ---
  { spellId: 28490, name: "Elixir of Major Strength", category: "battleElixir" },
  { spellId: 28491, name: "Elixir of Healing Power", category: "battleElixir" },
  { spellId: 28493, name: "Elixir of Major Frost Power", category: "battleElixir" },
  { spellId: 28497, name: "Elixir of Major Agility", category: "battleElixir" },
  { spellId: 28501, name: "Elixir of Major Firepower", category: "battleElixir" },
  { spellId: 28503, name: "Elixir of Major Shadow Power", category: "battleElixir" },
  { spellId: 33720, name: "Onslaught Elixir", category: "battleElixir" },
  { spellId: 33721, name: "Adept's Elixir", category: "battleElixir" },
  { spellId: 33726, name: "Elixir of Mastery", category: "battleElixir" },
  { spellId: 38954, name: "Fel Strength Elixir", category: "battleElixir" },
  { spellId: 17539, name: "Greater Arcane Elixir", category: "battleElixir" },
  { spellId: 11406, name: "Elixir of Demonslaying", category: "battleElixir" },
  // --- guardian elixirs ---
  { spellId: 28502, name: "Elixir of Major Defense", category: "guardianElixir" },
  { spellId: 28509, name: "Elixir of Major Mageblood", category: "guardianElixir" },
  { spellId: 39625, name: "Elixir of Major Fortitude", category: "guardianElixir" },
  { spellId: 39626, name: "Earthen Elixir", category: "guardianElixir" },
  { spellId: 39627, name: "Elixir of Draenic Wisdom", category: "guardianElixir" },
  { spellId: 39628, name: "Elixir of Ironskin", category: "guardianElixir" },
  // --- flasks (TBC + Shattrath + Unstable + usable vanilla) ---
  { spellId: 28518, name: "Flask of Fortification", category: "flask" },
  { spellId: 28519, name: "Flask of Mighty Restoration", category: "flask" },
  { spellId: 28520, name: "Flask of Relentless Assault", category: "flask" },
  { spellId: 28521, name: "Flask of Blinding Light", category: "flask" },
  { spellId: 28540, name: "Flask of Pure Death", category: "flask" },
  { spellId: 42735, name: "Flask of Chromatic Wonder", category: "flask" },
  { spellId: 41609, name: "Shattrath Flask of Fortification", category: "flask" },
  { spellId: 41610, name: "Shattrath Flask of Mighty Restoration", category: "flask" },
  { spellId: 41611, name: "Shattrath Flask of Supreme Power", category: "flask" },
  { spellId: 41608, name: "Shattrath Flask of Relentless Assault", category: "flask" },
  { spellId: 46837, name: "Shattrath Flask of Pure Death", category: "flask" },
  { spellId: 46839, name: "Shattrath Flask of Blinding Light", category: "flask" },
  { spellId: 40567, name: "Unstable Flask of the Bandit", category: "flask" },
  { spellId: 40568, name: "Unstable Flask of the Elder", category: "flask" },
  { spellId: 40572, name: "Unstable Flask of the Beast", category: "flask" },
  { spellId: 40573, name: "Unstable Flask of the Physician", category: "flask" },
  { spellId: 40575, name: "Unstable Flask of the Soldier", category: "flask" },
  { spellId: 40576, name: "Unstable Flask of the Sorcerer", category: "flask" },
  { spellId: 17626, name: "Flask of the Titans", category: "flask" },
  { spellId: 17627, name: "Flask of Distilled Wisdom", category: "flask" },
  { spellId: 17628, name: "Flask of Supreme Power", category: "flask" },
  { spellId: 17629, name: "Flask of Chromatic Resistance", category: "flask" },
  // --- food (Well Fed variants; one aura is often shared by several foods) ---
  { spellId: 33256, name: "Well Fed (Roasted Clefthoof, +20 Str)", category: "food" },
  { spellId: 33259, name: "Well Fed (Ravager Dog, +40 AP)", category: "food" },
  { spellId: 33261, name: "Well Fed (Warp Burger/Grilled Mudfish, +20 Agi)", category: "food" },
  { spellId: 33263, name: "Well Fed (Blackened Basilisk/Poached Bluefish, +23 spell dmg)", category: "food" },
  { spellId: 33265, name: "Well Fed (Blackened Sporefish, +20 Sta/8 mp5)", category: "food" },
  { spellId: 33268, name: "Well Fed (Golden Fish Sticks, +44 healing)", category: "food" },
  { spellId: 33257, name: "Well Fed (Spicy Crawdad/Fisherman's Feast, +30 Sta)", category: "food" },
  { spellId: 43722, name: "Enlightened (Skullfish Soup, +20 spell crit rating)", category: "food" },
  { spellId: 43764, name: "Well Fed (Spicy Hot Talbuk, +20 hit rating)", category: "food" },
  { spellId: 35272, name: "Well Fed (generic, +20 Sta/Spi)", category: "food" },
  // --- scrolls (level 5 = TBC; lower levels get the * flag in the UI) ---
  { spellId: 33077, name: "Scroll of Agility V", category: "scroll", scroll: { type: "Agi", level: 5 } },
  { spellId: 33078, name: "Scroll of Intellect V", category: "scroll", scroll: { type: "Int", level: 5 } },
  { spellId: 33079, name: "Scroll of Protection V", category: "scroll", scroll: { type: "Prot", level: 5 } },
  { spellId: 33080, name: "Scroll of Spirit V", category: "scroll", scroll: { type: "Spi", level: 5 } },
  { spellId: 33081, name: "Scroll of Stamina V", category: "scroll", scroll: { type: "Sta", level: 5 } },
  { spellId: 33082, name: "Scroll of Strength V", category: "scroll", scroll: { type: "Str", level: 5 } },
  { spellId: 12174, name: "Scroll of Agility IV", category: "scroll", scroll: { type: "Agi", level: 4 } },
  { spellId: 12176, name: "Scroll of Intellect IV", category: "scroll", scroll: { type: "Int", level: 4 } },
  { spellId: 12175, name: "Scroll of Protection IV", category: "scroll", scroll: { type: "Prot", level: 4 } },
  { spellId: 12177, name: "Scroll of Spirit IV", category: "scroll", scroll: { type: "Spi", level: 4 } },
  { spellId: 12178, name: "Scroll of Stamina IV", category: "scroll", scroll: { type: "Sta", level: 4 } },
  { spellId: 12179, name: "Scroll of Strength IV", category: "scroll", scroll: { type: "Str", level: 4 } },
];

/**
 * Drums: cast spell id -> buff id. For all TBC drums (classic and the
 * TBC-Classic Greater versions added in 2.5.2) the item's use spell applies
 * the aura directly, so castId === buffId.
 */
export interface DrumSpell {
  castId: number;
  buffId: number;
  kind: "battle" | "war" | "restoration" | "speed";
  greater: boolean;
  name: string;
}
export const drumSpells: DrumSpell[] = [
  { castId: 35476, buffId: 35476, kind: "battle", greater: false, name: "Drums of Battle" },
  { castId: 35475, buffId: 35475, kind: "war", greater: false, name: "Drums of War" },
  { castId: 35478, buffId: 35478, kind: "restoration", greater: false, name: "Drums of Restoration" },
  { castId: 35477, buffId: 35477, kind: "speed", greater: false, name: "Drums of Speed" },
  { castId: 351355, buffId: 351355, kind: "battle", greater: true, name: "Greater Drums of Battle" },
  { castId: 351360, buffId: 351360, kind: "war", greater: true, name: "Greater Drums of War" },
  { castId: 351358, buffId: 351358, kind: "restoration", greater: true, name: "Greater Drums of Restoration" },
  { castId: 351359, buffId: 351359, kind: "speed", greater: true, name: "Greater Drums of Speed" },
];

/**
 * Tinnitus debuff (cannot receive drums again while active).
 * 51120 verified on wowhead.com/tbc (2-min Tinnitus, triggered by the classic
 * drums). 369770 is listed by Wowhead as triggered by the Greater versions but
 * sits outside typical TBC-Classic id ranges — UNVERIFIED beyond that relation.
 * Currently unused: wasted-drum detection counts casts with zero buff
 * applications instead of reading the debuff; kept as reference data.
 */
export const tinnitusSpellIds: number[] = [51120, 369770];

/**
 * TBC JC on-use absorb pendants: equipped neck item id -> on-use buff id.
 * The use spell applies the school-absorb aura directly (e.g. 30997
 * "Fire Absorption"), so the buff id equals the item's use spell id.
 */
export interface JcNeck {
  itemId: number;
  buffId: number;
  name: string;
}
export const jcNecks: JcNeck[] = [
  { itemId: 24092, buffId: 30997, name: "Pendant of Frozen Flame" }, // fire absorb
  { itemId: 24093, buffId: 30994, name: "Pendant of Thawing" }, // frost absorb
  { itemId: 24095, buffId: 30999, name: "Pendant of Withering" }, // nature absorb
  { itemId: 24097, buffId: 31000, name: "Pendant of Shadow's End" }, // shadow absorb
  { itemId: 24098, buffId: 31002, name: "Pendant of the Null Rune" }, // arcane absorb
];

/**
 * Suboptimal consumables the original calls out by name.
 * tempEnchant ids are weapon temp-enchant ids (WCL combatantInfo
 * `temporaryEnchant`), not spell ids.
 */
export interface SuboptimalConsumable {
  kind: "buff" | "tempEnchant";
  id: number;
  name: string;
}
export const suboptimalConsumables: SuboptimalConsumable[] = [
  { kind: "buff", id: 28519, name: "Flask of Mighty Restoration" },
  { kind: "buff", id: 35272, name: "Well Fed (generic, +20 Sta/Spi)" },
  { kind: "buff", id: 3166, name: "Elixir of Wisdom" }, // UNVERIFIED: original flags "Increased Intellect"; exact buff id it meant is unclear
  { kind: "buff", id: 11396, name: "Elixir of Greater Intellect" },
  { kind: "tempEnchant", id: 2678, name: "Superior Wizard Oil" },
  { kind: "tempEnchant", id: 2677, name: "Superior Mana Oil" },
];
