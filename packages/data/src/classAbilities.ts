// packages/data/src/classAbilities.ts
import type { Role } from "@wcl/core";

export type ClassAbilityMeasure = "enemy-debuff-uptime" | "self-buff-uptime" | "cast-count";

/** A class-specific RPB metric row. `measure` decides how it's computed:
 *  - enemy-debuff-uptime: % of boss time the player's debuff was on an enemy
 *  - self-buff-uptime: % of boss time the player had the buff
 *  - cast-count: number of casts (effective usage of an active ability) */
export interface ClassAbility {
  className: string;          // matches Player.class
  key: string;                // stable slug
  name: string;               // display name
  measure: ClassAbilityMeasure;
  spellIds: number[];         // all ranks that count
  ranks?: { spellId: number; rank: number }[];  // rank per id (rank-checked only)
  optimalRank?: "max" | number;                  // flag if a lower rank dominates
  appliesToRole?: Role;       // optional UI hint
  verified?: boolean;         // false = ids not yet Wowhead-confirmed
}

// All ids below verified against the TBC 2.5.4.44833 client DB (wago.tools SpellName)
// during M7 (2026-06-15): every id resolves to the named spell, and each rank-checked
// ability's max-rank id is the genuine TBC top rank. Re-verify any future additions.
export const classAbilities: ClassAbility[] = [
  // ---- Warrior ----
  { className: "Warrior", key: "sunder-armor", name: "Sunder Armor", measure: "enemy-debuff-uptime",
    spellIds: [7386, 7405, 8380, 11596, 11597, 25225],
    ranks: [{spellId:7386,rank:1},{spellId:7405,rank:2},{spellId:8380,rank:3},{spellId:11596,rank:4},{spellId:11597,rank:5},{spellId:25225,rank:6}],
    optimalRank: "max", verified: true },
  { className: "Warrior", key: "demoralizing-shout", name: "Demoralizing Shout", measure: "enemy-debuff-uptime",
    spellIds: [1160, 6190, 11554, 11555, 11556, 25202], verified: true },

  // ---- Paladin ----
  { className: "Paladin", key: "judgement-of-wisdom", name: "Judgement of Wisdom", measure: "enemy-debuff-uptime",
    spellIds: [20354, 20355, 27164], verified: true },
  // NOTE: the enemy debuff is "Judgement of the Crusader" — NOT "Seal of the Crusader"
  // (the paladin self-buff, ids 20305-20308). 20304 doesn't exist in TBC 2.5.4.
  { className: "Paladin", key: "judgement-of-the-crusader", name: "Judgement of the Crusader", measure: "enemy-debuff-uptime",
    spellIds: [20188, 20300, 20301, 20302, 20303, 21183, 27159], verified: true },

  // ---- Hunter ----
  { className: "Hunter", key: "hunters-mark", name: "Hunter's Mark", measure: "enemy-debuff-uptime",
    spellIds: [1130, 14323, 14324, 14325],
    ranks: [{spellId:1130,rank:1},{spellId:14323,rank:2},{spellId:14324,rank:3},{spellId:14325,rank:4}],
    optimalRank: "max", verified: true },
  { className: "Hunter", key: "expose-weakness", name: "Expose Weakness", measure: "enemy-debuff-uptime",
    spellIds: [23577], verified: true },

  // ---- Rogue ----
  { className: "Rogue", key: "expose-armor", name: "Expose Armor", measure: "enemy-debuff-uptime",
    spellIds: [8647, 8649, 8650, 11197, 11198, 26866],
    ranks: [{spellId:8647,rank:1},{spellId:8649,rank:2},{spellId:8650,rank:3},{spellId:11197,rank:4},{spellId:11198,rank:5},{spellId:26866,rank:6}],
    optimalRank: "max", verified: true },
  { className: "Rogue", key: "slice-and-dice", name: "Slice and Dice", measure: "self-buff-uptime",
    spellIds: [5171, 6774], verified: true },

  // ---- Priest ----
  { className: "Priest", key: "misery", name: "Misery", measure: "enemy-debuff-uptime",
    spellIds: [33196, 33197, 33198, 33199, 33200], verified: true },
  // The enemy debuff is "Shadow Vulnerability" (15258), applied by the Shadow Weaving
  // talent — NOT the talent ranks themselves (15257/15331-15334), which never land on a
  // target. (Warlock Improved Shadow Bolt uses the distinct 17794-17800.) M7-confirmed:
  // 15258 appeared 72× player-sourced in the Gruul E2E; 15334 read 0%.
  { className: "Priest", key: "shadow-weaving", name: "Shadow Weaving", measure: "enemy-debuff-uptime",
    spellIds: [15258], verified: true },
  { className: "Priest", key: "inner-fire", name: "Inner Fire", measure: "self-buff-uptime",
    spellIds: [588, 7128, 602, 1006, 10951, 10952, 25431], verified: true },

  // ---- Shaman ----
  { className: "Shaman", key: "flame-shock", name: "Flame Shock", measure: "enemy-debuff-uptime",
    spellIds: [8050, 8052, 8053, 10447, 10448, 29228, 25457], verified: true },

  // ---- Mage ----
  { className: "Mage", key: "winters-chill", name: "Winter's Chill", measure: "enemy-debuff-uptime",
    spellIds: [12579], verified: true },
  { className: "Mage", key: "improved-scorch", name: "Improved Scorch (Fire Vulnerability)", measure: "enemy-debuff-uptime",
    spellIds: [22959], verified: true },
  { className: "Mage", key: "molten-armor", name: "Molten Armor", measure: "self-buff-uptime",
    spellIds: [30482], verified: true },

  // ---- Warlock ----
  { className: "Warlock", key: "curse-of-the-elements", name: "Curse of the Elements", measure: "enemy-debuff-uptime",
    spellIds: [1490, 11721, 11722, 27228],
    ranks: [{spellId:1490,rank:1},{spellId:11721,rank:2},{spellId:11722,rank:3},{spellId:27228,rank:4}],
    optimalRank: "max", verified: true },
  { className: "Warlock", key: "curse-of-shadow", name: "Curse of Shadow", measure: "enemy-debuff-uptime",
    spellIds: [17862, 17937, 27229],
    ranks: [{spellId:17862,rank:1},{spellId:17937,rank:2},{spellId:27229,rank:3}],
    optimalRank: "max", verified: true },
  { className: "Warlock", key: "curse-of-recklessness", name: "Curse of Recklessness", measure: "enemy-debuff-uptime",
    spellIds: [704, 7658, 7659, 11717, 27226], verified: true },

  // ---- Druid ----
  { className: "Druid", key: "faerie-fire", name: "Faerie Fire", measure: "enemy-debuff-uptime",
    spellIds: [770, 778, 9749, 9907, 26993], verified: true },
  { className: "Druid", key: "faerie-fire-feral", name: "Faerie Fire (Feral)", measure: "enemy-debuff-uptime",
    spellIds: [16857, 17390, 17391, 17392, 27011], verified: true },
];
