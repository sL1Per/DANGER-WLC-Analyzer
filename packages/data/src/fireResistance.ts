/**
 * Fire Resistance from permanent enchants, socketed gems, and buff auras, for
 * the Resistances tab on Illidan (the Flame of Azzinoth tanks stack FR). Item
 * innate FR lives in json/item-fire-res.json (scripts/extract_fire_res.py).
 * Ids and values read from the TBC Anniversary DB2 tables on wago.tools
 * (build 2.5.6.70577: SpellItemEnchantment, SpellEffect) on 2026-10-30.
 */

/**
 * Permanent-enchant ENCHANTMENT id → Fire Resistance granted (same id space as
 * combatantInfo.permanentEnchantId — see shadowResEnchants for why not spell ids).
 *   256   Enchant Cloak - Lesser Fire Resistance (+5)  — spell 7861
 *   2463  Enchant Cloak - Fire Resistance (+7)         — spell 13657
 *   2619  Enchant Cloak - Greater Fire Resistance (+15) — spell 25081
 *   3007  Glyph of Fire Warding (+20, head)
 *   1505  Lesser Arcanum of Resilience (+20, head/legs)
 *   2985  Flame Armor Kit (+8, chest/legs/hands/feet)
 *   2664  Enchant Cloak - Major Resistance (+7 all)
 *   2998  Inscription of Endurance (+7 all, shoulder)
 */
export const fireResEnchants: Record<string, number> = {
  "256":  5,  // Enchant Cloak - Lesser Fire Resistance
  "2463": 7,  // Enchant Cloak - Fire Resistance
  "2619": 15, // Enchant Cloak - Greater Fire Resistance
  "3007": 20, // Glyph of Fire Warding (head)
  "1505": 20, // Lesser Arcanum of Resilience (head/legs)
  "2985": 8,  // Flame Armor Kit (chest/legs/hands/feet)
  "2664": 7,  // Enchant Cloak - Major Resistance (+7 all)
  "2998": 7,  // Inscription of Endurance (+7 all, shoulder)
};

/** Socketed-gem itemId → Fire Resistance granted. */
export const fireResGems: Record<string, number> = {
  "22459": 4, // Void Sphere (+4 all resist)
};

/**
 * Buff aura spell id → Fire Resistance granted (SpellEffect base points + 1).
 * Fire Resistance Aura (paladin): 19891 / 19899 / 19900 / 27153 → 30/45/60/70.
 * Fire Resistance Totem (shaman) — the aura the totem applies, not the totem
 * cast (8184/10537/10538/25563): 8185 / 10534 / 10535 / 25562 → 30/45/60/70.
 * Chromatic flasks (all-resist pull aura): 17638 (+25), 42736 (+35).
 */
export const fireResBuffs: Record<string, number> = {
  "19891": 30, "19899": 45, "19900": 60, "27153": 70, // Fire Resistance Aura
  "8185":  30, "10534": 45, "10535": 60, "25562": 70, // Fire Resistance Totem
  "17638": 25, // Flask of Chromatic Resistance
  "42736": 35, // Flask of Chromatic Wonder
};

/**
 * Advisory soft target for colouring a Flame tank's TOTAL FR. NOT an official
 * threshold — 365 is the level-73 resist cap; tanks commonly aim for 300+.
 */
export const FR_SOFT_TARGET = 300;
