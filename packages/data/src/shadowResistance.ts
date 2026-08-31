/**
 * Shadow Resistance from permanent enchants, socketed gems, and buff auras, for
 * the `shadow resi` tab. NOT in the xlsx (the original kept these in Apps
 * Script). Item innate SR lives in json/item-shadow-res.json. Ids verified
 * against wowhead.com/tbc + tbc.cavernoftime.com; see per-table dates.
 */

/**
 * Permanent-enchant ENCHANTMENT id → Shadow Resistance granted.
 *
 * Keyed by enchantment id = what combatantInfo.permanentEnchantId reports,
 * the same id space as bad-enchants.json (small integers like 804, 927, 856).
 * NOT spell ids (which are the larger ids used to cast the enchant, e.g.
 * 13522 or 34006). Using spell ids here would never match real gear data.
 *
 * Shadow-specific enchants (verified 2026-06-13):
 *   804   Enchant Cloak - Lesser Shadow Resistance (+10) — spell 13522;
 *         confirmed on wowhead.com/tbc/spell=13522; effect
 *         "Enchant Item: +10 Shadow Resistance (804)".
 *   1441  Enchant Cloak - Greater Shadow Resistance (+15) — spell 34006;
 *         confirmed on wowhead.com/tbc/spell=34006; effect
 *         "Enchant Item: +15 Shadow Resistance (1441)".
 *
 * Head / leg / hands / feet SR enchants — armour kits & glyphs also land in the
 * permanentEnchantId field. Enchant ids read from the SpellEnchantment linked
 * on each spell's "Enchant Item Permanent" effect (tbc.cavernoftime.com),
 * cross-checked 2026-08-31:
 *   3009  Glyph of Shadow Warding (+20, head)   — spell 35458
 *   2683  Shadow Guard (+10, head or legs)      — spell 28165
 *   2984  Shadow Armor Kit (+8, chest/legs/hands/feet) — spell 35415
 *
 * All-resistance enchants (each contributes its full value to Shadow):
 *   2664  Enchant Cloak - Major Resistance (+7 all, cloak) — spell 27962
 *   2998  Inscription of Endurance (+7 all, shoulder)      — spell 35441
 */
export const shadowResEnchants: Record<string, number> = {
  "804":  10, // Enchant Cloak - Lesser Shadow Resistance; spell 13522
  "1441": 15, // Enchant Cloak - Greater Shadow Resistance; spell 34006
  "3009": 20, // Glyph of Shadow Warding (head); spell 35458
  "2683": 10, // Shadow Guard (head/legs); spell 28165
  "2984": 8,  // Shadow Armor Kit (chest/legs/hands/feet); spell 35415
  "2664": 7,  // Enchant Cloak - Major Resistance (+7 all); spell 27962
  "2998": 7,  // Inscription of Endurance (+7 all, shoulder); spell 35441
};

/**
 * Socketed-gem itemId → Shadow Resistance granted. WCL combatantInfo reports
 * each socket's gem itemId in `gems[].id`; only Void Sphere carries resistance
 * among gems raiders actually slot for Shahraz/Kaz'rogal/Azgalor.
 *   22459  Void Sphere — epic prismatic gem, "+4 Resist All" (full value counts
 *          toward Shadow); verified wowhead.com/tbc/item=22459 on 2026-08-31.
 */
export const shadowResGems: Record<string, number> = {
  "22459": 4, // Void Sphere (+4 all resist)
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
 *
 * Chromatic flasks give "+N resistance to all magic schools" and persist as a
 * pull aura, so the full value counts toward Shadow (verified 2026-08-31):
 *   17638  Flask of Chromatic Resistance (+25 all) — wowhead.com/tbc/spell=17638
 *   42736  Flask of Chromatic Wonder (+35 all)     — wowhead.com/tbc/spell=42736
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

  // Chromatic flasks (all-resist, count fully toward Shadow)
  "17638": 25, // Flask of Chromatic Resistance
  "42736": 35, // Flask of Chromatic Wonder
};

/**
 * Advisory soft target for colouring a player's TOTAL SR. NOT an official
 * threshold — Shahraz/Kaz'rogal/Azgalor have no hard SR gate; this is guidance.
 */
export const SR_SOFT_TARGET = 100;
