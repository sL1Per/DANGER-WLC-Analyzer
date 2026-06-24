import itemSocketsJson from "../json/item-sockets.json";
import itemShadowResJson from "../json/item-shadow-res.json";
import spellHasteJson from "../json/spell-haste.json";
import badEnchantsJson from "../json/bad-enchants.json";
import excludedItemsJson from "../json/excluded-items.json";
import gemQualityJson from "../json/gem-quality.json";
import spellCastTimesJson from "../json/spell-cast-times.json";

export interface BadEnchant { enchantId: number; slot: number | null; name: string; }
export interface ExcludedItem { itemId: number; name: string; }

export const itemSockets: Record<string, number> = itemSocketsJson;
export const itemShadowRes: Record<string, number> = itemShadowResJson;
export const spellHaste: Record<string, number> = spellHasteJson;
/** spell id -> base cast time in deci-seconds (Base ms / 100), from wago.tools
 *  SpellMisc x SpellCastTimes for TBC 2.5.4. Used by activity() for active-time. */
export const spellCastTimes: Record<string, number> = spellCastTimesJson;
/** gem itemId → quality (1 common … 4 epic); WCL exposes no gem quality, so this
 *  static table (extracted from Wowhead's TBC gem list) backs the gear-issues check. */
export const gemQuality: Record<string, number> = gemQualityJson;
export const badEnchants: BadEnchant[] = badEnchantsJson as BadEnchant[];
export const excludedItems: ExcludedItem[] = excludedItemsJson;

export * from "./consumables";
export * from "./shadowResistance";
export * from "./rpb";
export * from "./classAbilities";
export * from "./classAbilityCatalog";
export * from "./avoidableAbilities";
export * from "./rpbConsumables";
export * from "./trinketRacials";
