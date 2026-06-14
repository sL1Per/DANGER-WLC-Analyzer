// packages/data/src/rpb.ts
import type { Role } from "@wcl/core";

/** A buff/cast id that strongly implies a role, used as a detection tiebreaker. */
export interface RoleSignal { spellId: number; role: Role; name: string; }

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
