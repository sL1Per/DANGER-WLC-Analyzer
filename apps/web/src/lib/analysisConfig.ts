import type { RpbConfig, ConsumableConfig, DrumConfig, GearIssueConfig } from "@wcl/core";
import {
  spellCastTimes, roleSignals, casterClasses, hasteBuffs,
  engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
  rpbConsumables as rpbConsumableSpecsData,
  consumableBuffs, jcNecks, suboptimalConsumables, weaponEnhancementEnchantIds,
  drumSpells,
  badEnchants, excludedItems, gemQuality, itemShadowRes, itemSockets,
} from "@wcl/data";

/** RPB config — identical to the object RpbView built inline; centralised so the
 *  Performance view, By-Player profile, and per-fight scoped runs share one source. */
export function buildRpbConfig(): RpbConfig {
  return {
    roles: { signals: roleSignals, casterClasses },
    activity: { castTimes: spellCastTimes, hasteBuffs, aoeWindowMs: 500 },
    engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
    classAbilities, avoidableAbilityIds,
  };
}

export const consumablesConfig: ConsumableConfig = {
  buffs: consumableBuffs,
  jcNecks,
  suboptimal: suboptimalConsumables,
  weaponEnhancements: weaponEnhancementEnchantIds,
};

export const drumConfig: DrumConfig = { drums: drumSpells };

export const rpbConsumableSpecs = rpbConsumableSpecsData;

/** Default gear-issue config, matching GearIssuesView's inline settings. */
export const gearIssueConfig: GearIssueConfig = {
  minGemQuality: 3, excludeShahraz: false, listNoIssues: false,
  itemSockets, gemQuality, itemShadowRes, badEnchants, excludedItems,
};
