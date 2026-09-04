// packages/data/src/rpb.ts
import type { RoleSignal } from "@wcl/core";

export type { RoleSignal };

/** Classes whose DPS spec is spell-based → "caster"; every other DPS class
 *  defaults to "physical". Used by detectRole for the caster/physical split,
 *  since WCL summary tables expose no damage-school breakdown. Hybrid edge
 *  cases (enhancement shaman, balance vs feral druid) are corrected via
 *  physicalSpecs/casterSpecs (from a ranking spec) or physicalSpecCastNames
 *  (a signature-ability fallback for reports with no ranked kill at all — there
 *  is no manual per-character override anymore, it was retired with the old
 *  RPB view). Druid defaults to physical (feral); Shaman to caster
 *  (elemental); Priest to caster (shadow); Paladin/Warrior/Rogue/Hunter physical. */
export const casterClasses = ["Mage", "Warlock", "Priest", "Shaman"];

/** WCL spec names that are physical DPS even though their class defaults to
 *  caster — resolved from rankings spec by detectRole. Enhancement shaman is the
 *  classic case (dual-wield melee on the otherwise spell-based Shaman class). */
export const physicalSpecs = ["Enhancement"];

/** WCL spec names that are caster DPS even though their class defaults to
 *  physical — resolved from rankings spec by detectRole. Balance (boomkin) druid
 *  is the classic case (spell DPS on the otherwise feral-default Druid class). */
export const casterSpecs = ["Balance"];

/** Signature-ability names that flag a physical spec on a caster-default class
 *  when there is no ranking spec at all to consult (a report with no ranked
 *  kill — WCL only publishes rankings for kills). Stormstrike is a deep
 *  Enhancement talent; casting it at all is a reliable melee-shaman signal.
 *  Name-matched (not a curated spell id) — see detectRole. */
export const physicalSpecCastNames = ["Stormstrike"];

/** Auras/casts that disambiguate specs sharing a class (e.g. feral tank vs cat). */
export const roleSignals: RoleSignal[] = [
  { spellId: 71, role: "tank", name: "Defensive Stance" },
  { spellId: 25780, role: "tank", name: "Righteous Fury" },
  { spellId: 9634, role: "tank", name: "Dire Bear Form" },
  { spellId: 5487, role: "tank", name: "Bear Form" },
];

/** Haste buffs and the cast-speed bonus they grant, used to subtract spell-haste
 *  seconds in activity(). pct = fractional haste (0.3 = 30% faster casts). */
export interface HasteBuff { spellId: number; pct: number; name: string; }
export const hasteBuffs: HasteBuff[] = [
  { spellId: 2825, pct: 0.3, name: "Bloodlust" },
  { spellId: 32182, pct: 0.3, name: "Heroism" },
  { spellId: 10060, pct: 0.2, name: "Power Infusion" },
];

/** Battle Shout buff ids (max ranks); uptime "on you" is tracked in RPB. */
export const battleShoutBuffIds = [2048, 25289]; // top TBC Battle Shout ranks (extend during E2E)

/** Oil of Immolation proc damage spell id. */
export const oilOfImmolationSpellId = 11350;

/** Engineering damage ability ids (bombs/grenades/sappers). Starter set;
 *  extend during E2E. */
export const engineeringDamageIds = [
  30461, // The Bigger One
  30217, // Adamantite Grenade
  19821, // Arcane Bomb
  13241, // Goblin Sapper Charge
  30486, // Super Sapper Charge
];

/** Absorb spell ids excluded from "total absorbed" (e.g. self/raid shields the
 *  original does not attribute). Starter set; extend during E2E. */
export const absorbExcludedSpellIds: number[] = [];
