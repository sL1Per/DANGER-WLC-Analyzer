/**
 * Shadow Resistance from permanent enchants and from buff auras, for the
 * `shadow resi` tab. NOT in the xlsx (the original kept these in Apps Script).
 * Item innate SR lives in json/item-shadow-res.json. Every id below verified
 * against wowhead.com/tbc on 2026-06-13, except lines marked UNVERIFIED.
 */

/**
 * Permanent-enchant spell id → Shadow Resistance granted.
 *
 * Verified ids:
 *   13522  Enchant Cloak - Lesser Shadow Resistance (+10) — confirmed on
 *          wowhead.com/tbc/spell=13522; effect "Enchant Item: +10 Shadow
 *          Resistance (804)".
 *   27101  Enchant Cloak - Greater Shadow Resistance (+15) — UNVERIFIED on
 *          Wowhead TBC (the URL redirects to an unrelated spell); id is the
 *          commonly-cited value in multiple WoW Classic databases and the
 *          task description's "Greater Shadow Resistance +15" anchor. Mark as
 *          uncertain until confirmed in-game or via another source.
 */
export const shadowResEnchants: Record<string, number> = {
  "13522": 10, // Enchant Cloak - Lesser Shadow Resistance; verified wowhead.com/tbc/spell=13522
  "27101": 15, // Enchant Cloak - Greater Shadow Resistance; UNVERIFIED (Wowhead TBC redirects)
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
