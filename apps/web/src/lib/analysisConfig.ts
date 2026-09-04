import type { RpbConfig, ConsumableConfig, DrumConfig, GearIssueConfig, RoleSheetConfig, RoleCastsConfig } from "@wcl/core";
import {
  spellCastTimes, roleSignals, casterClasses, physicalSpecs, casterSpecs, physicalSpecCastNames, hasteBuffs,
  engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
  rpbConsumables as rpbConsumableSpecsData,
  consumableBuffs, jcNecks, suboptimalConsumables, weaponEnhancementEnchantIds,
  drumSpells,
  badEnchants, excludedItems, gemQuality, itemShadowRes, itemSockets,
  classAbilityCatalog, avoidableDebuffIds, trinketRacials, avoidableAbilityNames,
} from "@wcl/data";

/** RPB config — centralised so the role-breakdown views, player profile, and
 *  per-fight scoped runs share one source. */
export function buildRpbConfig(): RpbConfig {
  return {
    roles: { signals: roleSignals, casterClasses, physicalSpecs, casterSpecs, physicalSpecCastNames },
    activity: { castTimes: spellCastTimes, hasteBuffs, aoeWindowMs: 500 },
    engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
    classAbilities, avoidableAbilityIds,
  };
}

export const consumablesConfig: ConsumableConfig = {
  buffs: consumableBuffs,
  jcNecks,
  suboptimal: suboptimalConsumables,
  roles: { signals: roleSignals, casterClasses, physicalSpecs, casterSpecs, physicalSpecCastNames },
  weaponEnhancements: weaponEnhancementEnchantIds,
};

export const drumConfig: DrumConfig = { drums: drumSpells };

export const rpbConsumableSpecs = rpbConsumableSpecsData;

export function roleCastsConfig(): RoleCastsConfig {
  const base = buildRpbConfig();
  return {
    catalog: classAbilityCatalog,
    activity: base.activity,
    roles: base.roles,
    cooldownKeys: classAbilityCatalog.filter((a) => a.category === "cooldown").map((a) => a.key),
  };
}

export function roleSheetConfig(): RoleSheetConfig {
  const base = buildRpbConfig();
  return { roles: base.roles, rpb: base, avoidableDebuffIds, trinketRacials, avoidableAbilityNames };
}

/** Default gear-issue config, matching GearIssuesView's inline settings. */
export const gearIssueConfig: GearIssueConfig = {
  minGemQuality: 3, excludeShahraz: false, listNoIssues: false,
  itemSockets, gemQuality, itemShadowRes, badEnchants, excludedItems,
};
