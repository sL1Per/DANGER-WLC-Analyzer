/** WoW inventory slot ids as used by WCL combatantInfo and the original CLA. */
export const SLOT_NAMES: Record<number, string> = {
  0: "Head", 1: "Neck", 2: "Shoulders", 3: "Shirt", 4: "Chest", 5: "Waist",
  6: "Legs", 7: "Feet", 8: "Bracers", 9: "Hands", 10: "Ring1", 11: "Ring2",
  12: "Trinket1", 13: "Trinket2", 14: "Cloak", 15: "Weapon", 16: "Off-Hand",
  17: "Wand/Idol/Relic", 18: "Tabard",
};

/** Display order of the original CLA "gear listing" tab (17 columns). */
export const LISTING_SLOTS = [0, 1, 2, 14, 4, 8, 9, 5, 6, 7, 10, 11, 12, 13, 15, 16, 17];

/**
 * Slots that always take a permanent enchant in TBC.
 * Excluded: rings (enchanter-only), off-hand (held-in-hand items can't be
 * enchanted and we can't tell shields apart), neck/trinkets/waist (no enchants).
 */
export const ENCHANTABLE_SLOTS = new Set([0, 2, 4, 6, 7, 8, 9, 14, 15]);

/** Slots every raider must have filled; off-hand/ranged are class-dependent. */
export const REQUIRED_SLOTS = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export const QUALITY_NAMES: Record<number, string> = {
  1: "common", 2: "uncommon", 3: "rare", 4: "epic",
};
