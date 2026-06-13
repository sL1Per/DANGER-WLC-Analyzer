/**
 * Shadow Resistance from permanent enchants and from buff auras, for the
 * `shadow resi` tab. NOT in the xlsx (the original kept these in Apps Script).
 * Item innate SR lives in json/item-shadow-res.json. Every id below verified
 * against wowhead.com/tbc on 2026-06-13, except lines marked UNVERIFIED.
 */

/**
 * Permanent-enchant ENCHANTMENT id → Shadow Resistance granted.
 *
 * Keyed by enchantment id = what combatantInfo.permanentEnchantId reports,
 * the same id space as bad-enchants.json (small integers like 804, 927, 856).
 * NOT spell ids (which are the larger ids used to cast the enchant, e.g.
 * 13522 or 34006). Using spell ids here would never match real gear data.
 *
 * Verified ids:
 *   804   Enchant Cloak - Lesser Shadow Resistance (+10) — spell 13522;
 *         confirmed on wowhead.com/tbc/spell=13522; effect
 *         "Enchant Item: +10 Shadow Resistance (804)".
 *   1441  Enchant Cloak - Greater Shadow Resistance (+15) — spell 34006;
 *         confirmed on wowhead.com/tbc/spell=34006; effect
 *         "Enchant Item: +15 Shadow Resistance (1441)".
 */
export const shadowResEnchants: Record<string, number> = {
  "804":  10, // Enchant Cloak - Lesser Shadow Resistance; spell 13522, verified wowhead.com/tbc/spell=13522
  "1441": 15, // Enchant Cloak - Greater Shadow Resistance; spell 34006, verified wowhead.com/tbc/spell=34006
};

/**
 * Buff aura spell id → Shadow Resistance granted.
 *
 * Shadow Protection (priest, all 4 ranks — applies to one target):
 *   976    Rank 1 +30 SR — verified wowhead.com/tbc/spell=976
 *   10957  Rank 2 +45 SR — verified wowhead.com/tbc/spell=10957
 *   10958  Rank 3 +60 SR — verified wowhead.com/tbc/spell=10958
 *   25433  Rank 4 +70 SR — verified wowhead.com/tbc/spell=25433
 *
 * Shadow Resistance Aura (paladin, area aura, 4 ranks found in TBC):
 *   19876  Rank 1 +30 SR — verified wowhead.com/tbc/spell=19876
 *   19895  Rank 2 +45 SR — verified wowhead.com/tbc/spell=19895
 *   19896  Rank 3 +60 SR — verified wowhead.com/tbc/spell=19896
 *   27151  Rank 4 +70 SR — verified wowhead.com/tbc/spell=27151
 *
 * Note: Shadow Protection Potion grants an absorb (e.g. 1950 shadow absorb)
 * rather than a flat SR stat; excluded here because it does not show up as
 * Shadow Resistance in WCL combatantInfo.
 */
export const shadowResBuffs: Record<string, number> = {
  // Shadow Protection (priest)
  "976":   30, // Rank 1 — verified
  "10957": 45, // Rank 2 — verified
  "10958": 60, // Rank 3 — verified
  "25433": 70, // Rank 4 (max) — verified

  // Shadow Resistance Aura (paladin)
  "19876": 30, // Rank 1 — verified
  "19895": 45, // Rank 2 — verified
  "19896": 60, // Rank 3 — verified
  "27151": 70, // Rank 4 (max in TBC) — verified
};

/**
 * Advisory soft target for colouring a player's TOTAL SR. NOT an official
 * threshold — Shahraz/Kaz'rogal/Azgalor have no hard SR gate; this is guidance.
 */
export const SR_SOFT_TARGET = 100;
