import itemSocketsJson from "../json/item-sockets.json";
import itemShadowResJson from "../json/item-shadow-res.json";
import spellHasteJson from "../json/spell-haste.json";
import badEnchantsJson from "../json/bad-enchants.json";
import excludedItemsJson from "../json/excluded-items.json";

export interface BadEnchant { enchantId: number; slot: number | null; name: string; }
export interface ExcludedItem { itemId: number; name: string; }

export const itemSockets: Record<string, number> = itemSocketsJson;
export const itemShadowRes: Record<string, number> = itemShadowResJson;
export const spellHaste: Record<string, number> = spellHasteJson;
export const badEnchants: BadEnchant[] = badEnchantsJson as BadEnchant[];
export const excludedItems: ExcludedItem[] = excludedItemsJson;

export * from "./consumables";
export * from "./validateRules";
