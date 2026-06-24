// packages/data/src/classAbilityCatalog.ts
//
// Full per-class ability catalog for the RPB casts sheets.
// Sources:
//   - Seed: packages/data/src/classAbilities.ts (verified: true, ids confirmed TBC 2.5.4)
//   - Reference: .superpowers/sdd/task-9-catalog-reference.txt (sheet column lists)
//
// ID HONESTY RULE (see classAbilities.ts header):
//   verified: true  => id carried from classAbilities.ts seed only
//   verified: false => best-guess from WoW TBC knowledge; needs Wowhead re-check
//
// Cooldown attribution:
//   The reference dump groups cooldowns incorrectly (they appear under every class).
//   Blessing of Protection -> Paladin only
//   Bloodlust -> Shaman only
//   Innervate -> Druid only
//   Power Infusion -> Priest only
//   Each "X on trash" / "X on bosses" / "X total" triple -> ONE entry, category "cooldown".
//
// Category key:
//   single    = targeted ability / debuff / self-buff
//   aoe       = area effect
//   cooldown  = major cooldown (timed, usually 2-min+)
//   heal      = healing spell (overheal% tracked)
//
// uptimeAnnotated: true => the reference sheet shows "(uptime% - overall: N%)" suffix.
// Heal entries with rank buckets are kept as separate CatalogAbility entries (distinct rows).

import type { Role } from "@wcl/core";

export type CastCategory = "single" | "aoe" | "cooldown" | "heal";

export interface CatalogAbility {
  className: string;
  key: string;
  name: string;
  category: CastCategory;
  spellIds: number[];
  ranks?: { spellId: number; rank: number }[];
  uptimeAnnotated?: boolean;
  appliesToRole?: Role;
  tracked?: boolean;
  verified?: boolean;
}

export const classAbilityCatalog: CatalogAbility[] = [

  // ============================================================
  // ---- Warrior ----
  // ============================================================

  // -- single (from seed) --
  { className: "Warrior", key: "sunder-armor", name: "Sunder Armor", category: "single",
    spellIds: [7386, 7405, 8380, 11596, 11597, 25225],
    ranks: [{spellId:7386,rank:1},{spellId:7405,rank:2},{spellId:8380,rank:3},{spellId:11596,rank:4},{spellId:11597,rank:5},{spellId:25225,rank:6}],
    uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Warrior", key: "demoralizing-shout", name: "Demoralizing Shout", category: "single",
    spellIds: [1160, 6190, 11554, 11555, 11556, 25202],
    uptimeAnnotated: true, tracked: true, verified: true },

  // -- single (from reference sheet, not in seed) --
  { className: "Warrior", key: "battle-shout", name: "Battle Shout", category: "single",
    spellIds: [6673, 5242, 6192, 11549, 11550, 11551, 25289],
    uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Warrior", key: "berserker-stance", name: "Berserker Stance", category: "single",
    spellIds: [2458], verified: false }, // TODO verify
  { className: "Warrior", key: "bloodthirst", name: "Bloodthirst", category: "single",
    spellIds: [23881, 23892, 23893, 23894, 23895, 25251], verified: false }, // TODO verify
  { className: "Warrior", key: "charge", name: "Charge", category: "single",
    spellIds: [100, 6178, 11578], verified: false }, // TODO verify
  { className: "Warrior", key: "commanding-shout", name: "Commanding Shout", category: "single",
    spellIds: [469, 23460], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Warrior", key: "concussion-blow", name: "Concussion Blow", category: "single",
    spellIds: [12809], verified: false }, // TODO verify
  { className: "Warrior", key: "defensive-stance", name: "Defensive Stance", category: "single",
    spellIds: [71], verified: false }, // TODO verify
  { className: "Warrior", key: "devastate", name: "Devastate", category: "single",
    spellIds: [20243, 30016, 30022], verified: false }, // TODO verify
  { className: "Warrior", key: "disarm", name: "Disarm", category: "single",
    spellIds: [676], verified: false }, // TODO verify
  { className: "Warrior", key: "execute", name: "Execute", category: "single",
    spellIds: [5308, 20658, 20660, 20661, 20662, 25236], verified: false }, // TODO verify
  { className: "Warrior", key: "hamstring", name: "Hamstring", category: "single",
    spellIds: [1715, 7372, 7373, 25212], uptimeAnnotated: true, verified: false }, // TODO verify (Flurry uptime)
  { className: "Warrior", key: "heroic-strike", name: "Heroic Strike", category: "single",
    spellIds: [78, 284, 285, 1608, 11564, 11565, 11566, 25286, 29707], verified: false }, // TODO verify
  { className: "Warrior", key: "intercept", name: "Intercept", category: "single",
    spellIds: [20252, 20616, 20617], verified: false }, // TODO verify
  { className: "Warrior", key: "intimidating-shout", name: "Intimidating Shout", category: "single",
    spellIds: [5246], verified: false }, // TODO verify
  { className: "Warrior", key: "intervene", name: "Intervene", category: "single",
    spellIds: [3411], verified: false }, // TODO verify
  { className: "Warrior", key: "mocking-blow", name: "Mocking Blow", category: "single",
    spellIds: [694, 7400, 7402, 7403, 11580, 25266], verified: false }, // TODO verify
  { className: "Warrior", key: "mortal-strike", name: "Mortal Strike", category: "single",
    spellIds: [12294, 21551, 21552, 21553, 25248], verified: false }, // TODO verify
  { className: "Warrior", key: "overpower", name: "Overpower", category: "single",
    spellIds: [7384, 7887, 11584, 11585], verified: false }, // TODO verify
  { className: "Warrior", key: "pummel", name: "Pummel", category: "single",
    spellIds: [6552, 6554], verified: false }, // TODO verify
  { className: "Warrior", key: "rampage", name: "Rampage", category: "single",
    spellIds: [29801], verified: false }, // TODO verify
  { className: "Warrior", key: "rend", name: "Rend", category: "single",
    spellIds: [772, 6546, 6547, 6548, 11572, 11574, 25208], verified: false }, // TODO verify
  { className: "Warrior", key: "revenge", name: "Revenge", category: "single",
    spellIds: [6572, 6574, 7379, 11600, 11601, 25288], verified: false }, // TODO verify
  { className: "Warrior", key: "shield-bash", name: "Shield Bash", category: "single",
    spellIds: [72, 1671, 1672, 29704], verified: false }, // TODO verify
  { className: "Warrior", key: "shield-block", name: "Shield Block", category: "single",
    spellIds: [2565], verified: false }, // TODO verify
  { className: "Warrior", key: "shield-slam", name: "Shield Slam", category: "single",
    spellIds: [23922, 23923, 23924, 23925, 25258], verified: false }, // TODO verify
  { className: "Warrior", key: "slam", name: "Slam", category: "single",
    spellIds: [1464, 8820, 11604, 11605, 25241], verified: false }, // TODO verify
  { className: "Warrior", key: "spell-reflection", name: "Spell Reflection", category: "single",
    spellIds: [23920], verified: false }, // TODO verify
  { className: "Warrior", key: "sunder-armor-sub5", name: "Sunder Armor% on targets < 5 stacks", category: "single",
    spellIds: [7386, 7405, 8380, 11596, 11597, 25225], verified: true }, // same ids as sunder-armor
  { className: "Warrior", key: "sweeping-strikes", name: "Sweeping Strikes", category: "single",
    spellIds: [12328], verified: false }, // TODO verify
  { className: "Warrior", key: "taunt", name: "Taunt", category: "single",
    spellIds: [355], verified: false }, // TODO verify
  { className: "Warrior", key: "thunder-clap", name: "Thunder Clap", category: "single",
    spellIds: [6343, 8198, 8204, 8205, 11580, 25264], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Warrior", key: "victory-rush", name: "Victory Rush", category: "single",
    spellIds: [34428], verified: false }, // TODO verify
  { className: "Warrior", key: "melee", name: "Melee (Deep Wounds)", category: "single",
    spellIds: [12162, 12850, 12868], uptimeAnnotated: true, verified: false }, // TODO verify (Deep Wounds debuff)

  // -- aoe --
  { className: "Warrior", key: "cleave", name: "Cleave", category: "aoe",
    spellIds: [845, 7369, 11608, 11609, 25231, 47519], verified: false }, // TODO verify
  { className: "Warrior", key: "whirlwind", name: "Whirlwind", category: "aoe",
    spellIds: [1680, 25207], verified: false }, // TODO verify

  // -- cooldowns (Warrior-specific) --
  { className: "Warrior", key: "berserker-rage", name: "Berserker Rage", category: "cooldown",
    spellIds: [18499], verified: false }, // TODO verify
  { className: "Warrior", key: "bloodrage", name: "Bloodrage", category: "cooldown",
    spellIds: [2687], verified: false }, // TODO verify
  { className: "Warrior", key: "challenging-shout", name: "Challenging Shout", category: "cooldown",
    spellIds: [1161], verified: false }, // TODO verify
  { className: "Warrior", key: "death-wish", name: "Death Wish", category: "cooldown",
    spellIds: [12292], verified: false }, // TODO verify
  { className: "Warrior", key: "last-stand", name: "Last Stand", category: "cooldown",
    spellIds: [12975], verified: false }, // TODO verify
  { className: "Warrior", key: "recklessness", name: "Recklessness", category: "cooldown",
    spellIds: [1719], verified: false }, // TODO verify
  { className: "Warrior", key: "shield-wall", name: "Shield Wall", category: "cooldown",
    spellIds: [871], verified: false }, // TODO verify

  // ============================================================
  // ---- Paladin ----
  // ============================================================

  // -- single (from seed) --
  { className: "Paladin", key: "judgement-of-wisdom", name: "Judgement of Wisdom", category: "single",
    spellIds: [20354, 20355, 27164],
    uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Paladin", key: "judgement-of-the-crusader", name: "Judgement of the Crusader", category: "single",
    spellIds: [20188, 20300, 20301, 20302, 20303, 21183, 27159],
    uptimeAnnotated: true, tracked: true, verified: true },

  // -- single (from reference, not in seed) --
  { className: "Paladin", key: "cleanse", name: "Cleanse", category: "single",
    spellIds: [4987], verified: false }, // TODO verify
  { className: "Paladin", key: "holy-shield", name: "Holy Shield", category: "single",
    spellIds: [20925, 20927, 20928, 27179], verified: false }, // TODO verify
  { className: "Paladin", key: "purify", name: "Purify", category: "single",
    spellIds: [1152], verified: false }, // TODO verify
  { className: "Paladin", key: "sense-undead", name: "Sense Undead", category: "single",
    spellIds: [5502], verified: false }, // TODO verify
  { className: "Paladin", key: "turn-undead", name: "Turn Undead", category: "single",
    spellIds: [2878, 5627, 10326], verified: false }, // TODO verify
  { className: "Paladin", key: "blessing-of-freedom", name: "Blessing of Freedom", category: "single",
    spellIds: [1044], verified: false }, // TODO verify
  { className: "Paladin", key: "blessing-of-kings", name: "Blessing of Kings/Greater Blessing of Kings", category: "single",
    spellIds: [20217, 25898], verified: false }, // TODO verify
  { className: "Paladin", key: "blessing-of-light", name: "Blessing of Light/Greater Blessing of Light", category: "single",
    spellIds: [19977, 19978, 19979, 25890], verified: false }, // TODO verify
  { className: "Paladin", key: "blessing-of-might", name: "Blessing of Might/Greater Blessing of Might", category: "single",
    spellIds: [19740, 19834, 19835, 19836, 19837, 19838, 25291, 25782], verified: false }, // TODO verify
  { className: "Paladin", key: "blessing-of-sacrifice", name: "Blessing of Sacrifice", category: "single",
    spellIds: [6940, 20729], verified: false }, // TODO verify
  { className: "Paladin", key: "blessing-of-salvation", name: "Blessing of Salvation/Greater Blessing of Salvation", category: "single",
    spellIds: [1038, 25895], verified: false }, // TODO verify
  { className: "Paladin", key: "blessing-of-sanctuary", name: "Blessing of Sanctuary/Greater Blessing of Sanctuary", category: "single",
    spellIds: [20911, 20912, 20913, 20914, 25899], verified: false }, // TODO verify
  { className: "Paladin", key: "blessing-of-wisdom", name: "Blessing of Wisdom/Greater Blessing of Wisdom", category: "single",
    spellIds: [19742, 19850, 19852, 19853, 19854, 25290, 25894], verified: false }, // TODO verify
  { className: "Paladin", key: "concentration-aura", name: "Concentration Aura", category: "single",
    spellIds: [19746], verified: false }, // TODO verify
  { className: "Paladin", key: "crusader-aura", name: "Crusader Aura", category: "single",
    spellIds: [32223], verified: false }, // TODO verify
  { className: "Paladin", key: "devotion-aura", name: "Devotion Aura", category: "single",
    spellIds: [465, 10290, 643, 10291, 1032, 10292, 10293], verified: false }, // TODO verify
  { className: "Paladin", key: "retribution-aura", name: "Retribution Aura", category: "single",
    spellIds: [7294, 10298, 10299, 10300, 27150], verified: false }, // TODO verify
  { className: "Paladin", key: "fire-resistance-aura", name: "Fire Resistance Aura", category: "single",
    spellIds: [19891, 19899, 19900], verified: false }, // TODO verify
  { className: "Paladin", key: "frost-resistance-aura", name: "Frost Resistance Aura", category: "single",
    spellIds: [19888, 19897, 19898], verified: false }, // TODO verify
  { className: "Paladin", key: "shadow-resistance-aura", name: "Shadow Resistance Aura", category: "single",
    spellIds: [19876, 19895, 19896], verified: false }, // TODO verify
  { className: "Paladin", key: "avengers-shield", name: "Avenger's Shield", category: "single",
    spellIds: [31935, 32699, 32700], verified: false }, // TODO verify
  { className: "Paladin", key: "crusader-strike", name: "Crusader Strike", category: "single",
    spellIds: [35395], verified: false }, // TODO verify
  { className: "Paladin", key: "exorcism", name: "Exorcism", category: "single",
    spellIds: [879, 5614, 5615, 10312, 10313, 10314, 27138], verified: false }, // TODO verify
  { className: "Paladin", key: "hammer-of-justice", name: "Hammer of Justice", category: "single",
    spellIds: [853, 5588, 5589, 10308], verified: false }, // TODO verify
  { className: "Paladin", key: "hammer-of-wrath", name: "Hammer of Wrath", category: "single",
    spellIds: [24275, 24274, 24239, 27180], verified: false }, // TODO verify
  { className: "Paladin", key: "holy-shock", name: "Holy Shock", category: "single",
    spellIds: [20473, 20929, 20930, 27174, 33072], verified: false }, // TODO verify
  { className: "Paladin", key: "holy-wrath", name: "Holy Wrath", category: "single",
    spellIds: [2812, 10318], verified: false }, // TODO verify
  { className: "Paladin", key: "judgement", name: "Judgement", category: "single",
    spellIds: [20271], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Paladin", key: "righteous-defense", name: "Righteous Defense", category: "single",
    spellIds: [31789], verified: false }, // TODO verify
  { className: "Paladin", key: "righteous-fury", name: "Righteous Fury", category: "single",
    spellIds: [25780], verified: false }, // TODO verify
  { className: "Paladin", key: "seal-of-blood", name: "Seal of Blood", category: "single",
    spellIds: [31892], verified: false }, // TODO verify
  { className: "Paladin", key: "seal-of-command", name: "Seal of Command", category: "single",
    spellIds: [20375, 20915, 20918, 20919, 20920], uptimeAnnotated: true, verified: false }, // TODO verify (twisted swings %)
  { className: "Paladin", key: "seal-of-corruption", name: "Seal of Corruption", category: "single",
    spellIds: [348704], verified: false }, // TODO verify (TBC Anniversary)
  { className: "Paladin", key: "seal-of-justice", name: "Seal of Justice", category: "single",
    spellIds: [20164], verified: false }, // TODO verify
  { className: "Paladin", key: "seal-of-light", name: "Seal of Light", category: "single",
    spellIds: [20165, 20347, 20348, 20349, 27160], verified: false }, // TODO verify
  { className: "Paladin", key: "seal-of-righteousness", name: "Seal of Righteousness", category: "single",
    spellIds: [21084, 20287, 20288, 20289, 20290, 20291, 20292, 20293, 27155], verified: false }, // TODO verify
  { className: "Paladin", key: "seal-of-the-crusader", name: "Seal of the Crusader", category: "single",
    spellIds: [20305, 20306, 20307, 20308, 21082], verified: false }, // TODO verify
  { className: "Paladin", key: "seal-of-the-martyr", name: "Seal of the Martyr", category: "single",
    spellIds: [348700], verified: false }, // TODO verify (TBC Anniversary)
  { className: "Paladin", key: "seal-of-vengeance", name: "Seal of Vengeance", category: "single",
    spellIds: [31801], verified: false }, // TODO verify
  { className: "Paladin", key: "seal-of-wisdom", name: "Seal of Wisdom", category: "single",
    spellIds: [19742, 20166, 20167, 27166], verified: false }, // TODO verify
  { className: "Paladin", key: "melee", name: "Melee", category: "single",
    spellIds: [6603], verified: false }, // TODO verify (auto-attack placeholder)

  // -- heals --
  { className: "Paladin", key: "flash-of-light-r7", name: "Flash of Light (rank 7)", category: "heal",
    spellIds: [27137], verified: false }, // TODO verify
  { className: "Paladin", key: "flash-of-light-r6", name: "Flash of Light (rank 6)", category: "heal",
    spellIds: [19943], verified: false }, // TODO verify
  { className: "Paladin", key: "flash-of-light-r5", name: "Flash of Light (rank 5)", category: "heal",
    spellIds: [19942], verified: false }, // TODO verify
  { className: "Paladin", key: "flash-of-light-r4", name: "Flash of Light (rank 4)", category: "heal",
    spellIds: [19941], verified: false }, // TODO verify
  { className: "Paladin", key: "flash-of-light-r3", name: "Flash of Light (rank 3)", category: "heal",
    spellIds: [19940], verified: false }, // TODO verify
  { className: "Paladin", key: "flash-of-light-r2", name: "Flash of Light (rank 2)", category: "heal",
    spellIds: [19939], verified: false }, // TODO verify
  { className: "Paladin", key: "flash-of-light-r1", name: "Flash of Light (rank 1)", category: "heal",
    spellIds: [19750], verified: false }, // TODO verify
  { className: "Paladin", key: "holy-light-r11", name: "Holy Light (rank 11)", category: "heal",
    spellIds: [27136], verified: false }, // TODO verify
  { className: "Paladin", key: "holy-light-r6-10", name: "Holy Light (rank 6-10)", category: "heal",
    spellIds: [10328, 10329, 25292, 25263, 635], verified: false }, // TODO verify
  { className: "Paladin", key: "holy-light-r1-5", name: "Holy Light (rank 1-5)", category: "heal",
    spellIds: [635, 639, 647, 1026, 1042], verified: false }, // TODO verify

  // -- aoe --
  { className: "Paladin", key: "consecration", name: "Consecration", category: "aoe",
    spellIds: [26573, 20116, 20922, 20923, 20924, 27173], verified: false }, // TODO verify

  // -- cooldowns (Paladin-specific) --
  { className: "Paladin", key: "blessing-of-protection", name: "Blessing of Protection", category: "cooldown",
    spellIds: [1022, 5599, 10278], verified: false }, // TODO verify
  { className: "Paladin", key: "avenging-wrath", name: "Avenging Wrath", category: "cooldown",
    spellIds: [31884], verified: false }, // TODO verify
  { className: "Paladin", key: "divine-favor", name: "Divine Favor", category: "cooldown",
    spellIds: [20216], verified: false }, // TODO verify
  { className: "Paladin", key: "divine-illumination", name: "Divine Illumination", category: "cooldown",
    spellIds: [31842], verified: false }, // TODO verify
  { className: "Paladin", key: "divine-intervention", name: "Divine Intervention", category: "cooldown",
    spellIds: [19752], verified: false }, // TODO verify
  { className: "Paladin", key: "divine-protection", name: "Divine Protection", category: "cooldown",
    spellIds: [498, 5573], verified: false }, // TODO verify
  { className: "Paladin", key: "divine-shield", name: "Divine Shield", category: "cooldown",
    spellIds: [642, 1020], verified: false }, // TODO verify
  { className: "Paladin", key: "lay-on-hands", name: "Lay on Hands", category: "cooldown",
    spellIds: [633, 2800, 10310, 27154], verified: false }, // TODO verify

  // ============================================================
  // ---- Hunter ----
  // ============================================================

  // -- single (from seed) --
  { className: "Hunter", key: "hunters-mark", name: "Hunter's Mark", category: "single",
    spellIds: [1130, 14323, 14324, 14325],
    ranks: [{spellId:1130,rank:1},{spellId:14323,rank:2},{spellId:14324,rank:3},{spellId:14325,rank:4}],
    uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Hunter", key: "expose-weakness", name: "Auto Shot (Expose Weakness)", category: "single",
    spellIds: [23577], uptimeAnnotated: true, tracked: true, verified: true },

  // -- single (from reference, not in seed) --
  { className: "Hunter", key: "aimed-shot", name: "Aimed Shot", category: "single",
    spellIds: [19434, 20900, 20901, 20902, 20903, 27065], verified: false }, // TODO verify
  { className: "Hunter", key: "arcane-shot", name: "Arcane Shot", category: "single",
    spellIds: [3044, 14281, 14282, 14283, 14284, 14285, 27019, 25294], verified: false }, // TODO verify
  { className: "Hunter", key: "concussive-shot", name: "Concussive Shot", category: "single",
    spellIds: [5116], verified: false }, // TODO verify
  { className: "Hunter", key: "distracting-shot", name: "Distracting Shot", category: "single",
    spellIds: [20736], verified: false }, // TODO verify
  { className: "Hunter", key: "growl", name: "Growl", category: "single",
    spellIds: [2649], verified: false }, // TODO verify (pet ability)
  { className: "Hunter", key: "kill-command", name: "Kill Command", category: "single",
    spellIds: [34026], verified: false }, // TODO verify
  { className: "Hunter", key: "misdirection", name: "Misdirection", category: "single",
    spellIds: [34477], verified: false }, // TODO verify
  { className: "Hunter", key: "mongoose-bite", name: "Mongoose Bite", category: "single",
    spellIds: [1495, 14269, 14270], verified: false }, // TODO verify
  { className: "Hunter", key: "raptor-strike", name: "Raptor Strike", category: "single",
    spellIds: [2973, 14260, 14261, 14262, 14263, 14264, 27014], verified: false }, // TODO verify
  { className: "Hunter", key: "scorpid-sting", name: "Scorpid Sting", category: "single",
    spellIds: [3043], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Hunter", key: "serpent-sting", name: "Serpent Sting", category: "single",
    spellIds: [1978, 13549, 13550, 13551, 13552, 13553, 13554, 13555, 25295, 27016], verified: false }, // TODO verify
  { className: "Hunter", key: "silencing-shot", name: "Silencing Shot", category: "single",
    spellIds: [34490], verified: false }, // TODO verify
  { className: "Hunter", key: "steady-shot", name: "Steady Shot", category: "single",
    spellIds: [34120], verified: false }, // TODO verify
  { className: "Hunter", key: "tranquilizing-shot", name: "Tranquilizing Shot", category: "single",
    spellIds: [19801], verified: false }, // TODO verify
  { className: "Hunter", key: "viper-sting", name: "Viper Sting", category: "single",
    spellIds: [3034, 14279, 14280, 27018], verified: false }, // TODO verify
  { className: "Hunter", key: "wing-clip", name: "Wing Clip", category: "single",
    spellIds: [2974, 14267, 14268], verified: false }, // TODO verify
  { className: "Hunter", key: "wyvern-sting", name: "Wyvern Sting", category: "single",
    spellIds: [19386, 24132, 24133, 27068], verified: false }, // TODO verify
  { className: "Hunter", key: "aspect-of-the-beast", name: "Aspect of the Beast", category: "single",
    spellIds: [13161], verified: false }, // TODO verify
  { className: "Hunter", key: "aspect-of-the-cheetah", name: "Aspect of the Cheetah", category: "single",
    spellIds: [5118], verified: false }, // TODO verify
  { className: "Hunter", key: "aspect-of-the-hawk", name: "Aspect of the Hawk", category: "single",
    spellIds: [13165, 14318, 14319, 14320, 14321, 14322, 25296], verified: false }, // TODO verify
  { className: "Hunter", key: "aspect-of-the-monkey", name: "Aspect of the Monkey", category: "single",
    spellIds: [13163], verified: false }, // TODO verify
  { className: "Hunter", key: "aspect-of-the-pack", name: "Aspect of the Pack", category: "single",
    spellIds: [13159], verified: false }, // TODO verify
  { className: "Hunter", key: "aspect-of-the-viper", name: "Aspect of the Viper", category: "single",
    spellIds: [34074], verified: false }, // TODO verify
  { className: "Hunter", key: "aspect-of-the-wild", name: "Aspect of the Wild", category: "single",
    spellIds: [20043, 20190], verified: false }, // TODO verify
  { className: "Hunter", key: "disengage", name: "Disengage", category: "single",
    spellIds: [781], verified: false }, // TODO verify
  { className: "Hunter", key: "dismiss-pet", name: "Dismiss Pet", category: "single",
    spellIds: [2641], verified: false }, // TODO verify
  { className: "Hunter", key: "eagle-eye", name: "Eagle Eye", category: "single",
    spellIds: [6197], verified: false }, // TODO verify
  { className: "Hunter", key: "eyes-of-the-beast", name: "Eyes of the Beast", category: "single",
    spellIds: [1002], verified: false }, // TODO verify
  { className: "Hunter", key: "flare", name: "Flare", category: "single",
    spellIds: [1543], verified: false }, // TODO verify
  { className: "Hunter", key: "mend-pet", name: "Mend Pet", category: "single",
    spellIds: [136, 3111, 3661, 3662, 13543, 13544, 27046], verified: false }, // TODO verify
  { className: "Hunter", key: "revive-pet", name: "Revive Pet", category: "single",
    spellIds: [982], verified: false }, // TODO verify
  { className: "Hunter", key: "trueshot-aura", name: "Trueshot Aura", category: "single",
    spellIds: [19506], verified: false }, // TODO verify
  { className: "Hunter", key: "melee", name: "Melee", category: "single",
    spellIds: [6603], verified: false }, // TODO verify (auto-attack placeholder)

  // -- aoe --
  { className: "Hunter", key: "multi-shot", name: "Multi-Shot", category: "aoe",
    spellIds: [2643, 14288, 14289, 14290, 25294, 27021], verified: false }, // TODO verify
  { className: "Hunter", key: "volley", name: "Volley", category: "aoe",
    spellIds: [1510, 14294, 14295, 27022], verified: false }, // TODO verify
  { className: "Hunter", key: "explosive-trap", name: "Explosive Trap", category: "aoe",
    spellIds: [13813, 14316, 14317, 27025], verified: false }, // TODO verify
  { className: "Hunter", key: "freezing-trap", name: "Freezing Trap", category: "aoe",
    spellIds: [1499, 14310, 14311], verified: false }, // TODO verify
  { className: "Hunter", key: "frost-trap", name: "Frost Trap", category: "aoe",
    spellIds: [13809], verified: false }, // TODO verify
  { className: "Hunter", key: "immolation-trap", name: "Immolation Trap", category: "aoe",
    spellIds: [13795, 14298, 14299, 14300, 27023], verified: false }, // TODO verify
  { className: "Hunter", key: "snake-trap", name: "Snake Trap", category: "aoe",
    spellIds: [34600], verified: false }, // TODO verify

  // -- cooldowns (Hunter-specific) --
  { className: "Hunter", key: "bestial-wrath", name: "Bestial Wrath", category: "cooldown",
    spellIds: [19574], verified: false }, // TODO verify
  { className: "Hunter", key: "deterrence", name: "Deterrence", category: "cooldown",
    spellIds: [19263], verified: false }, // TODO verify
  { className: "Hunter", key: "rapid-fire", name: "Rapid Fire", category: "cooldown",
    spellIds: [3045], verified: false }, // TODO verify
  { className: "Hunter", key: "readiness", name: "Readiness", category: "cooldown",
    spellIds: [23989], verified: false }, // TODO verify

  // ============================================================
  // ---- Rogue ----
  // ============================================================

  // -- single (from seed) --
  { className: "Rogue", key: "expose-armor", name: "Expose Armor", category: "single",
    spellIds: [8647, 8649, 8650, 11197, 11198, 26866],
    ranks: [{spellId:8647,rank:1},{spellId:8649,rank:2},{spellId:8650,rank:3},{spellId:11197,rank:4},{spellId:11198,rank:5},{spellId:26866,rank:6}],
    uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Rogue", key: "slice-and-dice", name: "Slice and Dice", category: "single",
    spellIds: [5171, 6774], uptimeAnnotated: true, tracked: true, verified: true },

  // -- single (from reference, not in seed) --
  { className: "Rogue", key: "ambush", name: "Ambush", category: "single",
    spellIds: [8676, 8724, 8725, 11267, 11268, 27441], verified: false }, // TODO verify
  { className: "Rogue", key: "backstab", name: "Backstab", category: "single",
    spellIds: [53, 2589, 2590, 2591, 8721, 11279, 11280, 25300, 26863], verified: false }, // TODO verify
  { className: "Rogue", key: "cheap-shot", name: "Cheap Shot", category: "single",
    spellIds: [1833], verified: false }, // TODO verify
  { className: "Rogue", key: "deadly-throw", name: "Deadly Throw", category: "single",
    spellIds: [26679], verified: false }, // TODO verify
  { className: "Rogue", key: "disarm-trap", name: "Disarm Trap", category: "single",
    spellIds: [1842], verified: false }, // TODO verify
  { className: "Rogue", key: "distract", name: "Distract", category: "single",
    spellIds: [1725], verified: false }, // TODO verify
  { className: "Rogue", key: "envenom", name: "Envenom", category: "single",
    spellIds: [32645, 32684], verified: false }, // TODO verify
  { className: "Rogue", key: "eviscerate", name: "Eviscerate", category: "single",
    spellIds: [2098, 6760, 6761, 6762, 8623, 8624, 11299, 11300, 26865], verified: false }, // TODO verify
  { className: "Rogue", key: "feint", name: "Feint", category: "single",
    spellIds: [1966, 25302, 6768, 8637, 11303], verified: false }, // TODO verify
  { className: "Rogue", key: "garrote", name: "Garrote", category: "single",
    spellIds: [703, 8631, 8632, 8633, 11289, 11290, 26839], verified: false }, // TODO verify
  { className: "Rogue", key: "gouge", name: "Gouge", category: "single",
    spellIds: [1776, 1777, 8629, 11285, 11286, 25234], verified: false }, // TODO verify
  { className: "Rogue", key: "hemorrhage", name: "Hemorrhage", category: "single",
    spellIds: [16511, 17347, 17348, 26864], verified: false }, // TODO verify
  { className: "Rogue", key: "kick", name: "Kick", category: "single",
    spellIds: [1766, 1767, 1768, 1769], verified: false }, // TODO verify
  { className: "Rogue", key: "kidney-shot", name: "Kidney Shot", category: "single",
    spellIds: [408, 8643], verified: false }, // TODO verify
  { className: "Rogue", key: "mutilate", name: "Mutilate", category: "single",
    spellIds: [1329, 34413, 34414, 34415], verified: false }, // TODO verify
  { className: "Rogue", key: "rupture", name: "Rupture", category: "single",
    spellIds: [1943, 8639, 8640, 11273, 11274, 26867], verified: false }, // TODO verify
  { className: "Rogue", key: "shadowstep", name: "Shadowstep", category: "single",
    spellIds: [36554], verified: false }, // TODO verify
  { className: "Rogue", key: "shiv", name: "Shiv", category: "single",
    spellIds: [5938], verified: false }, // TODO verify
  { className: "Rogue", key: "sinister-strike", name: "Sinister Strike", category: "single",
    spellIds: [1752, 1757, 1758, 1759, 1760, 8621, 11293, 11294, 26861], verified: false }, // TODO verify
  { className: "Rogue", key: "melee", name: "Melee", category: "single",
    spellIds: [6603], verified: false }, // TODO verify (auto-attack placeholder)

  // -- aoe --
  { className: "Rogue", key: "blade-flurry", name: "Blade Flurry", category: "aoe",
    spellIds: [13877], verified: false }, // TODO verify

  // -- cooldowns (Rogue-specific) --
  { className: "Rogue", key: "adrenaline-rush", name: "Adrenaline Rush", category: "cooldown",
    spellIds: [13750], verified: false }, // TODO verify
  { className: "Rogue", key: "cloak-of-shadows", name: "Cloak of Shadows", category: "cooldown",
    spellIds: [31224], verified: false }, // TODO verify
  { className: "Rogue", key: "evasion", name: "Evasion", category: "cooldown",
    spellIds: [5277, 26669], verified: false }, // TODO verify
  { className: "Rogue", key: "vanish", name: "Vanish", category: "cooldown",
    spellIds: [1856, 1857], verified: false }, // TODO verify

  // ============================================================
  // ---- Priest ----
  // ============================================================

  // -- single (from seed) --
  { className: "Priest", key: "misery", name: "Misery", category: "single",
    spellIds: [33196, 33197, 33198, 33199, 33200], tracked: true, verified: true },
  { className: "Priest", key: "shadow-weaving", name: "Shadow Weaving", category: "single",
    spellIds: [15258], uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Priest", key: "inner-fire", name: "Inner Fire", category: "single",
    spellIds: [588, 7128, 602, 1006, 10951, 10952, 25431], tracked: true, verified: true },

  // -- single (from reference, not in seed) --
  { className: "Priest", key: "mana-burn", name: "Mana Burn", category: "single",
    spellIds: [8129, 25380], verified: false }, // TODO verify
  { className: "Priest", key: "mind-blast", name: "Mind Blast", category: "single",
    spellIds: [8092, 8102, 8103, 8104, 8105, 8106, 10945, 10946, 25375, 26048], verified: false }, // TODO verify
  { className: "Priest", key: "mind-flay", name: "Mind Flay", category: "single",
    spellIds: [15407, 17311, 17312, 17313, 17314, 18807, 25387], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Priest", key: "shadowform", name: "Shadowform", category: "single",
    spellIds: [15473], verified: false }, // TODO verify
  { className: "Priest", key: "shadow-word-death", name: "Shadow Word: Death", category: "single",
    spellIds: [32379, 32996], verified: false }, // TODO verify
  { className: "Priest", key: "shadow-word-pain", name: "Shadow Word: Pain", category: "single",
    spellIds: [589, 594, 970, 992, 2767, 10892, 10893, 25367, 25368], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Priest", key: "silence", name: "Silence", category: "single",
    spellIds: [15487], verified: false }, // TODO verify
  { className: "Priest", key: "vampiric-embrace", name: "Vampiric Embrace", category: "single",
    spellIds: [15286], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Priest", key: "vampiric-touch", name: "Vampiric Touch", category: "single",
    spellIds: [34914, 34916, 34917], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Priest", key: "holy-fire", name: "Holy Fire", category: "single",
    spellIds: [14914, 15262, 15263, 15264, 15265, 15266, 15267, 15261, 25384], verified: false }, // TODO verify
  { className: "Priest", key: "smite", name: "Smite", category: "single",
    spellIds: [585, 591, 598, 984, 1004, 6060, 10933, 10934, 25363], verified: false }, // TODO verify
  { className: "Priest", key: "starshards", name: "Starshards (nightelf only)", category: "single",
    spellIds: [10797], verified: false }, // TODO verify
  { className: "Priest", key: "shoot", name: "Shoot (wand)", category: "single",
    spellIds: [5019], verified: false }, // TODO verify
  { className: "Priest", key: "melee", name: "Melee", category: "single",
    spellIds: [6603], verified: false }, // TODO verify (auto-attack placeholder)
  { className: "Priest", key: "abolish-disease", name: "Abolish Disease", category: "single",
    spellIds: [552], verified: false }, // TODO verify
  { className: "Priest", key: "cure-disease", name: "Cure Disease", category: "single",
    spellIds: [528], verified: false }, // TODO verify
  { className: "Priest", key: "dispel-magic", name: "Dispel Magic", category: "single",
    spellIds: [527, 988], verified: false }, // TODO verify
  { className: "Priest", key: "mass-dispel", name: "Mass Dispel", category: "single",
    spellIds: [32375], verified: false }, // TODO verify
  { className: "Priest", key: "divine-spirit", name: "Divine Spirit/Prayer of Spirit", category: "single",
    spellIds: [14752, 14818, 14819, 27841, 27842, 25312], verified: false }, // TODO verify
  { className: "Priest", key: "power-word-fortitude", name: "Power Word: Fortitude/Prayer of Fortitude", category: "single",
    spellIds: [1243, 1244, 1245, 2791, 10937, 10938, 21562, 21564, 25389], verified: false }, // TODO verify
  { className: "Priest", key: "shadow-protection", name: "Shadow Protection/Prayer of Shadow Protection", category: "single",
    spellIds: [976, 10957, 10958, 25433, 39374], verified: false }, // TODO verify
  { className: "Priest", key: "chastise", name: "Chastise", category: "single",
    spellIds: [694], verified: false }, // TODO verify
  { className: "Priest", key: "fade", name: "Fade", category: "single",
    spellIds: [586, 9578], verified: false }, // TODO verify
  { className: "Priest", key: "levitate", name: "Levitate", category: "single",
    spellIds: [1706], verified: false }, // TODO verify
  { className: "Priest", key: "mind-control", name: "Mind Control", category: "single",
    spellIds: [605, 10911, 11442], verified: false }, // TODO verify
  { className: "Priest", key: "mind-soothe", name: "Mind Soothe", category: "single",
    spellIds: [453, 8192, 10953], verified: false }, // TODO verify
  { className: "Priest", key: "psychic-scream", name: "Psychic Scream", category: "single",
    spellIds: [8122, 8124, 10888, 10890], verified: false }, // TODO verify
  { className: "Priest", key: "shackle-undead", name: "Shackle Undead", category: "single",
    spellIds: [9484, 9485, 10955], verified: false }, // TODO verify
  { className: "Priest", key: "power-word-shield", name: "Power Word: Shield", category: "single",
    spellIds: [17, 592, 600, 3747, 6065, 6066, 10898, 10899, 10900, 10901, 25217, 25218], verified: false }, // TODO verify
  { className: "Priest", key: "prayer-of-mending", name: "Prayer of Mending", category: "single",
    spellIds: [33076], verified: false }, // TODO verify

  // -- heals --
  { className: "Priest", key: "binding-heal", name: "Binding Heal", category: "heal",
    spellIds: [32546], verified: false }, // TODO verify
  { className: "Priest", key: "flash-heal-r9", name: "Flash Heal (rank 9)", category: "heal",
    spellIds: [25235], verified: false }, // TODO verify
  { className: "Priest", key: "flash-heal-r8", name: "Flash Heal (rank 8)", category: "heal",
    spellIds: [10916], verified: false }, // TODO verify
  { className: "Priest", key: "flash-heal-r7", name: "Flash Heal (rank 7)", category: "heal",
    spellIds: [10915], verified: false }, // TODO verify
  { className: "Priest", key: "flash-heal-r6", name: "Flash Heal (rank 6)", category: "heal",
    spellIds: [10914], verified: false }, // TODO verify
  { className: "Priest", key: "flash-heal-r5", name: "Flash Heal (rank 5)", category: "heal",
    spellIds: [9474], verified: false }, // TODO verify
  { className: "Priest", key: "flash-heal-r4", name: "Flash Heal (rank 4)", category: "heal",
    spellIds: [9473], verified: false }, // TODO verify
  { className: "Priest", key: "flash-heal-r3", name: "Flash Heal (rank 3)", category: "heal",
    spellIds: [9472], verified: false }, // TODO verify
  { className: "Priest", key: "flash-heal-r2", name: "Flash Heal (rank 2)", category: "heal",
    spellIds: [9471], verified: false }, // TODO verify
  { className: "Priest", key: "flash-heal-r1", name: "Flash Heal (rank 1)", category: "heal",
    spellIds: [2061], verified: false }, // TODO verify
  { className: "Priest", key: "greater-heal-r7", name: "Greater Heal (rank 7)", category: "heal",
    spellIds: [25213], verified: false }, // TODO verify
  { className: "Priest", key: "greater-heal-r6", name: "Greater Heal (rank 6)", category: "heal",
    spellIds: [25210], verified: false }, // TODO verify
  { className: "Priest", key: "greater-heal-r5", name: "Greater Heal (rank 5)", category: "heal",
    spellIds: [10965], verified: false }, // TODO verify
  { className: "Priest", key: "greater-heal-r4", name: "Greater Heal (rank 4)", category: "heal",
    spellIds: [10964], verified: false }, // TODO verify
  { className: "Priest", key: "greater-heal-r3", name: "Greater Heal (rank 3)", category: "heal",
    spellIds: [10963], verified: false }, // TODO verify
  { className: "Priest", key: "greater-heal-r2", name: "Greater Heal (rank 2)", category: "heal",
    spellIds: [10962], verified: false }, // TODO verify
  { className: "Priest", key: "greater-heal-r1", name: "Greater Heal (rank 1)", category: "heal",
    spellIds: [2060], verified: false }, // TODO verify
  { className: "Priest", key: "heal-r4", name: "Heal (rank 4)", category: "heal",
    spellIds: [6064], verified: false }, // TODO verify
  { className: "Priest", key: "heal-r3", name: "Heal (rank 3)", category: "heal",
    spellIds: [6063], verified: false }, // TODO verify
  { className: "Priest", key: "heal-r2", name: "Heal (rank 2)", category: "heal",
    spellIds: [2055], verified: false }, // TODO verify
  { className: "Priest", key: "heal-r1", name: "Heal (rank 1)", category: "heal",
    spellIds: [2054], verified: false }, // TODO verify
  { className: "Priest", key: "lesser-heal", name: "Lesser Heal", category: "heal",
    spellIds: [2050, 2052, 2053], verified: false }, // TODO verify
  { className: "Priest", key: "renew-r12", name: "Renew (rank 12)", category: "heal",
    spellIds: [25222], verified: false }, // TODO verify
  { className: "Priest", key: "renew-r7-11", name: "Renew (rank 7-11)", category: "heal",
    spellIds: [10927, 10928, 25315, 6077, 6078], verified: false }, // TODO verify
  { className: "Priest", key: "renew-r1-6", name: "Renew (rank 1-6)", category: "heal",
    spellIds: [139, 6074, 6075, 6076, 10925, 10926], verified: false }, // TODO verify

  // -- aoe --
  { className: "Priest", key: "circle-of-healing-r5", name: "Circle of Healing (rank 5)", category: "aoe",
    spellIds: [34866], verified: false }, // TODO verify
  { className: "Priest", key: "circle-of-healing-r4", name: "Circle of Healing (rank 4)", category: "aoe",
    spellIds: [34865], verified: false }, // TODO verify
  { className: "Priest", key: "circle-of-healing-r3", name: "Circle of Healing (rank 3)", category: "aoe",
    spellIds: [34864], verified: false }, // TODO verify
  { className: "Priest", key: "circle-of-healing-r2", name: "Circle of Healing (rank 2)", category: "aoe",
    spellIds: [34863], verified: false }, // TODO verify
  { className: "Priest", key: "circle-of-healing-r1", name: "Circle of Healing (rank 1)", category: "aoe",
    spellIds: [34861], verified: false }, // TODO verify
  { className: "Priest", key: "holy-nova", name: "Holy Nova", category: "aoe",
    spellIds: [15237, 15430, 15431, 27799, 27800, 25331, 25329], verified: false }, // TODO verify
  { className: "Priest", key: "prayer-of-healing", name: "Prayer of Healing", category: "aoe",
    spellIds: [596, 996, 10960, 10961, 25308, 25316], verified: false }, // TODO verify

  // -- cooldowns (Priest-specific) --
  { className: "Priest", key: "power-infusion", name: "Power Infusion", category: "cooldown",
    spellIds: [10060], verified: false }, // TODO verify
  { className: "Priest", key: "desperate-prayer", name: "Desperate Prayer (dwarf/human only)", category: "cooldown",
    spellIds: [13908, 19238, 19240, 19241, 19242, 19243, 19244, 25437], verified: false }, // TODO verify
  { className: "Priest", key: "devouring-plague", name: "Devouring Plague (undead only)", category: "cooldown",
    spellIds: [2944, 19276, 19277, 19278, 19279, 19280, 25467], verified: false }, // TODO verify
  { className: "Priest", key: "inner-focus", name: "Inner Focus", category: "cooldown",
    spellIds: [14751], verified: false }, // TODO verify
  { className: "Priest", key: "pain-suppression", name: "Pain Suppression", category: "cooldown",
    spellIds: [33206], verified: false }, // TODO verify
  { className: "Priest", key: "shadowfiend", name: "Shadowfiend", category: "cooldown",
    spellIds: [34433], verified: false }, // TODO verify

  // ============================================================
  // ---- Shaman ----
  // ============================================================

  // -- single (from seed) --
  { className: "Shaman", key: "flame-shock", name: "Flame Shock", category: "single",
    spellIds: [8050, 8052, 8053, 10447, 10448, 29228, 25457],
    uptimeAnnotated: true, tracked: true, verified: true },

  // -- single (from reference, not in seed) --
  { className: "Shaman", key: "earth-shock", name: "Earth Shock", category: "single",
    spellIds: [8042, 8044, 8045, 8046, 10412, 10413, 10414, 25454], verified: false }, // TODO verify
  { className: "Shaman", key: "frost-shock", name: "Frost Shock", category: "single",
    spellIds: [8056, 8058, 10472, 10473, 25464], verified: false }, // TODO verify
  { className: "Shaman", key: "lightning-bolt-low", name: "Lightning Bolt (rank 1-4)", category: "single",
    spellIds: [403, 529, 548, 915], verified: false }, // TODO verify
  { className: "Shaman", key: "lightning-bolt-high", name: "Lightning Bolt (rank 5-12)", category: "single",
    spellIds: [943, 6041, 10391, 10392, 15207, 15208, 15234, 25449, 25450, 27763, 27764], verified: false }, // TODO verify
  { className: "Shaman", key: "lightning-shield", name: "Lightning Shield", category: "single",
    spellIds: [324, 325, 905, 945, 8134, 10431, 10432, 25469, 25472], verified: false }, // TODO verify
  { className: "Shaman", key: "purge", name: "Purge", category: "single",
    spellIds: [370, 8012], verified: false }, // TODO verify
  { className: "Shaman", key: "earth-elemental-totem", name: "Earth Elemental Totem", category: "single",
    spellIds: [2062], verified: false }, // TODO verify
  { className: "Shaman", key: "fire-elemental-totem", name: "Fire Elemental Totem", category: "single",
    spellIds: [2894], verified: false }, // TODO verify
  { className: "Shaman", key: "flametongue-totem", name: "Flametongue Totem", category: "single",
    spellIds: [8227, 8249, 10526, 16387, 25557], verified: false }, // TODO verify
  { className: "Shaman", key: "searing-totem", name: "Searing Totem", category: "single",
    spellIds: [3599, 6363, 6364, 6365, 10437, 10438, 25530], verified: false }, // TODO verify
  { className: "Shaman", key: "cure-disease", name: "Cure Disease", category: "single",
    spellIds: [2870], verified: false }, // TODO verify
  { className: "Shaman", key: "cure-poison", name: "Cure Poison", category: "single",
    spellIds: [526], verified: false }, // TODO verify
  { className: "Shaman", key: "disease-cleansing-totem", name: "Disease Cleansing Totem", category: "single",
    spellIds: [8170], verified: false }, // TODO verify
  { className: "Shaman", key: "poison-cleansing-totem", name: "Poison Cleansing Totem", category: "single",
    spellIds: [8166], verified: false }, // TODO verify
  { className: "Shaman", key: "fire-resistance-totem", name: "Fire Resistance Totem", category: "single",
    spellIds: [8184, 10537, 10538], verified: false }, // TODO verify
  { className: "Shaman", key: "frost-resistance-totem", name: "Frost Resistance Totem", category: "single",
    spellIds: [8181, 10478, 10479], verified: false }, // TODO verify
  { className: "Shaman", key: "nature-resistance-totem", name: "Nature Resistance Totem", category: "single",
    spellIds: [10595, 10600, 10601], verified: false }, // TODO verify
  { className: "Shaman", key: "grace-of-air-totem", name: "Grace of Air Totem", category: "single",
    spellIds: [8835, 10627, 25359], verified: false }, // TODO verify
  { className: "Shaman", key: "grounding-totem", name: "Grounding Totem", category: "single",
    spellIds: [8177], verified: false }, // TODO verify
  { className: "Shaman", key: "stoneclaw-totem", name: "Stoneclaw Totem", category: "single",
    spellIds: [5730, 6390, 6391, 6392, 10427, 10428], verified: false }, // TODO verify
  { className: "Shaman", key: "totem-of-wrath", name: "Totem of Wrath", category: "single",
    spellIds: [30706], verified: false }, // TODO verify
  { className: "Shaman", key: "tranquil-air-totem", name: "Tranquil Air Totem", category: "single",
    spellIds: [25908], verified: false }, // TODO verify
  { className: "Shaman", key: "windfury-totem-r5", name: "Windfury Totem (rank 5)", category: "single",
    spellIds: [27621], verified: false }, // TODO verify
  { className: "Shaman", key: "windfury-totem-low", name: "Windfury Totem (rank 1-4)", category: "single",
    spellIds: [8512, 10613, 10614, 25587], verified: false }, // TODO verify
  { className: "Shaman", key: "windwall-totem", name: "Windwall Totem", category: "single",
    spellIds: [15107, 15111, 15112], verified: false }, // TODO verify
  { className: "Shaman", key: "wrath-of-air-totem", name: "Wrath of Air Totem", category: "single",
    spellIds: [3738], verified: false }, // TODO verify
  { className: "Shaman", key: "earthbind-totem", name: "Earthbind Totem", category: "single",
    spellIds: [2484], verified: false }, // TODO verify
  { className: "Shaman", key: "stoneskin-totem", name: "Stoneskin Totem", category: "single",
    spellIds: [8071, 8154, 8155, 10406, 10407, 10408, 25508, 25509], verified: false }, // TODO verify
  { className: "Shaman", key: "strength-of-earth-totem", name: "Strength of Earth Totem", category: "single",
    spellIds: [8075, 8160, 8161, 10441, 25362, 25527], verified: false }, // TODO verify
  { className: "Shaman", key: "tremor-totem", name: "Tremor Totem", category: "single",
    spellIds: [8143], verified: false }, // TODO verify
  { className: "Shaman", key: "flametongue-weapon", name: "Flametongue Weapon", category: "single",
    spellIds: [8024, 8027, 8030, 16343, 16344, 16345, 25489], verified: false }, // TODO verify
  { className: "Shaman", key: "frostbrand-weapon", name: "Frostbrand Weapon", category: "single",
    spellIds: [8033, 8037, 10456, 16355, 25500], verified: false }, // TODO verify
  { className: "Shaman", key: "rockbiter-weapon", name: "Rockbiter Weapon", category: "single",
    spellIds: [8017, 8018, 8019, 10399, 16314, 16315, 25479, 25485], verified: false }, // TODO verify
  { className: "Shaman", key: "windfury-weapon", name: "Windfury Weapon", category: "single",
    spellIds: [8232, 8234, 10486, 16362, 16363, 25505], verified: false }, // TODO verify
  { className: "Shaman", key: "stormstrike", name: "Stormstrike", category: "single",
    spellIds: [17364], verified: false }, // TODO verify
  { className: "Shaman", key: "melee", name: "Melee", category: "single",
    spellIds: [6603], verified: false }, // TODO verify (auto-attack placeholder)
  { className: "Shaman", key: "earth-shield", name: "Earth Shield", category: "single",
    spellIds: [974, 32593, 32594, 32596, 32598, 32599, 32600, 32601], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Shaman", key: "water-shield", name: "Water Shield", category: "single",
    spellIds: [52127, 33736, 33737, 33738], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Shaman", key: "healing-stream-totem", name: "Healing Stream Totem", category: "single",
    spellIds: [5394, 6375, 6377, 10462, 25567, 25577], verified: false }, // TODO verify
  { className: "Shaman", key: "mana-spring-totem", name: "Mana Spring Totem", category: "single",
    spellIds: [5675, 10495, 10496, 10497, 25570, 25571], verified: false }, // TODO verify

  // -- heals --
  { className: "Shaman", key: "healing-wave-r12", name: "Healing Wave (rank 12)", category: "heal",
    spellIds: [25357], verified: false }, // TODO verify
  { className: "Shaman", key: "healing-wave-r7-11", name: "Healing Wave (rank 7-11)", category: "heal",
    spellIds: [10623, 10627, 25391, 25396, 547], verified: false }, // TODO verify
  { className: "Shaman", key: "healing-wave-r1-6", name: "Healing Wave (rank 1-6)", category: "heal",
    spellIds: [331, 332, 547, 913, 939, 959], verified: false }, // TODO verify
  { className: "Shaman", key: "lesser-healing-wave-r7", name: "Lesser Healing Wave (rank 7)", category: "heal",
    spellIds: [25420], verified: false }, // TODO verify
  { className: "Shaman", key: "lesser-healing-wave-r1-6", name: "Lesser Healing Wave (rank 1-6)", category: "heal",
    spellIds: [8004, 8008, 8010, 10466, 10467, 10468], verified: false }, // TODO verify

  // -- aoe --
  { className: "Shaman", key: "chain-heal-r5", name: "Chain Heal (rank 5)", category: "aoe",
    spellIds: [25423], verified: false }, // TODO verify
  { className: "Shaman", key: "chain-heal-r4", name: "Chain Heal (rank 4)", category: "aoe",
    spellIds: [10623], verified: false }, // TODO verify
  { className: "Shaman", key: "chain-heal-r3", name: "Chain Heal (rank 3)", category: "aoe",
    spellIds: [10622], verified: false }, // TODO verify
  { className: "Shaman", key: "chain-heal-r2", name: "Chain Heal (rank 2)", category: "aoe",
    spellIds: [10621], verified: false }, // TODO verify
  { className: "Shaman", key: "chain-heal-r1", name: "Chain Heal (rank 1)", category: "aoe",
    spellIds: [1064], verified: false }, // TODO verify
  { className: "Shaman", key: "chain-lightning", name: "Chain Lightning", category: "aoe",
    spellIds: [421, 930, 2860, 10605, 25439, 25442], verified: false }, // TODO verify
  { className: "Shaman", key: "fire-nova-totem", name: "Fire Nova Totem", category: "aoe",
    spellIds: [1535, 8498, 8499, 11314, 11315, 25546], verified: false }, // TODO verify
  { className: "Shaman", key: "magma-totem", name: "Magma Totem", category: "aoe",
    spellIds: [8190, 10585, 10586, 10587, 25550], verified: false }, // TODO verify

  // -- cooldowns (Shaman-specific) --
  { className: "Shaman", key: "bloodlust", name: "Bloodlust", category: "cooldown",
    spellIds: [2825], verified: false }, // TODO verify
  { className: "Shaman", key: "elemental-mastery", name: "Elemental Mastery", category: "cooldown",
    spellIds: [16166], verified: false }, // TODO verify
  { className: "Shaman", key: "mana-tide-totem", name: "Mana Tide Totem", category: "cooldown",
    spellIds: [16190], verified: false }, // TODO verify
  { className: "Shaman", key: "natures-swiftness-shaman", name: "Nature's Swiftness", category: "cooldown",
    spellIds: [17716], verified: false }, // TODO verify
  { className: "Shaman", key: "shamanistic-rage", name: "Shamanistic Rage", category: "cooldown",
    spellIds: [30823], verified: false }, // TODO verify

  // ============================================================
  // ---- Mage ----
  // ============================================================

  // -- single (from seed) --
  { className: "Mage", key: "winters-chill", name: "Winter's Chill", category: "single",
    spellIds: [12579], uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Mage", key: "improved-scorch", name: "Improved Scorch (Fire Vulnerability)", category: "single",
    spellIds: [22959], uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Mage", key: "molten-armor", name: "Molten Armor", category: "single",
    spellIds: [30482], tracked: true, verified: true },

  // -- single (from reference, not in seed) --
  { className: "Mage", key: "arcane-blast", name: "Arcane Blast", category: "single",
    spellIds: [30451, 42897, 42898], verified: false }, // TODO verify
  { className: "Mage", key: "arcane-brilliance", name: "Arcane Brilliance/Arcane Intellect", category: "single",
    spellIds: [23028, 1459, 1460, 1461, 10156, 10157, 27126], verified: false }, // TODO verify
  { className: "Mage", key: "arcane-missiles", name: "Arcane Missiles", category: "single",
    spellIds: [5143, 5144, 5145, 8416, 8417, 10211, 10212, 25345], verified: false }, // TODO verify
  { className: "Mage", key: "armor", name: "Armor", category: "single",
    spellIds: [6117, 22782, 22783, 7301, 7302, 7320, 10220, 27124, 30482], verified: false }, // TODO verify (Mage Armor/Ice Armor/Molten Armor)
  { className: "Mage", key: "blink", name: "Blink", category: "single",
    spellIds: [1953], verified: false }, // TODO verify
  { className: "Mage", key: "counterspell", name: "Counterspell", category: "single",
    spellIds: [2139], verified: false }, // TODO verify
  { className: "Mage", key: "fire-blast", name: "Fire Blast", category: "single",
    spellIds: [2136, 2137, 2138, 8412, 8413, 10197, 10199, 27079], verified: false }, // TODO verify
  { className: "Mage", key: "fireball", name: "Fireball", category: "single",
    spellIds: [133, 143, 145, 3140, 8400, 8401, 8402, 10148, 10149, 10150, 10151, 25306], verified: false }, // TODO verify
  { className: "Mage", key: "frostbolt-high", name: "Frostbolt (rank 2+)", category: "single",
    spellIds: [116, 205, 837, 7322, 8406, 8407, 8408, 10179, 10180, 10181, 25304], uptimeAnnotated: true, verified: false }, // TODO verify (WC uptime%)
  { className: "Mage", key: "frostbolt-r1", name: "Frostbolt (rank 1)", category: "single",
    spellIds: [116], verified: false }, // TODO verify
  { className: "Mage", key: "ice-barrier", name: "Ice Barrier", category: "single",
    spellIds: [11426, 13031, 13032, 13033, 27134, 33405], verified: false }, // TODO verify
  { className: "Mage", key: "ice-block", name: "Ice Block", category: "single",
    spellIds: [45438], verified: false }, // TODO verify
  { className: "Mage", key: "ice-lance", name: "Ice Lance", category: "single",
    spellIds: [30455], verified: false }, // TODO verify
  { className: "Mage", key: "mana-shield", name: "Mana Shield", category: "single",
    spellIds: [1463, 8494, 8495, 10191, 10192, 10193, 27131], verified: false }, // TODO verify
  { className: "Mage", key: "pyroblast", name: "Pyroblast", category: "single",
    spellIds: [11366, 12505, 12522, 12523, 12524, 12525, 12526, 18809, 27148], verified: false }, // TODO verify
  { className: "Mage", key: "polymorph", name: "Polymorph", category: "single",
    spellIds: [118, 12824, 12825, 12826, 28270, 28271, 28272], verified: false }, // TODO verify
  { className: "Mage", key: "remove-lesser-curse", name: "Remove Lesser Curse", category: "single",
    spellIds: [475], verified: false }, // TODO verify
  { className: "Mage", key: "scorch", name: "Scorch (Fire Vulnerability)", category: "single",
    spellIds: [2948, 8444, 8445, 8446, 10205, 10206, 27073], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Mage", key: "scorch-sub5", name: "Scorch% on targets <5 stacks", category: "single",
    spellIds: [2948, 8444, 8445, 8446, 10205, 10206, 27073], verified: false }, // TODO verify
  { className: "Mage", key: "shoot", name: "Shoot (wand)", category: "single",
    spellIds: [5019], verified: false }, // TODO verify
  { className: "Mage", key: "slow", name: "Slow", category: "single",
    spellIds: [31589], verified: false }, // TODO verify
  { className: "Mage", key: "spellsteal", name: "Spellsteal", category: "single",
    spellIds: [30449], verified: false }, // TODO verify
  { className: "Mage", key: "amplify-magic", name: "Amplify Magic", category: "single",
    spellIds: [1008, 8455, 10169, 10170, 27130], verified: false }, // TODO verify
  { className: "Mage", key: "dampen-magic", name: "Dampen Magic", category: "single",
    spellIds: [604, 8450, 8451, 10173, 10174, 27129], verified: false }, // TODO verify
  { className: "Mage", key: "melee", name: "Melee", category: "single",
    spellIds: [6603], verified: false }, // TODO verify (auto-attack placeholder)

  // -- aoe --
  { className: "Mage", key: "arcane-explosion-high", name: "Arcane Explosion (rank 2+)", category: "aoe",
    spellIds: [1449, 8437, 8438, 8439, 8440, 10202, 10203, 27082], verified: false }, // TODO verify
  { className: "Mage", key: "arcane-explosion-r1", name: "Arcane Explosion (rank 1)", category: "aoe",
    spellIds: [1449], verified: false }, // TODO verify
  { className: "Mage", key: "blast-wave", name: "Blast Wave", category: "aoe",
    spellIds: [11113, 13018, 13019, 13020, 13021, 27133], verified: false }, // TODO verify
  { className: "Mage", key: "blizzard", name: "Blizzard", category: "aoe",
    spellIds: [10, 6141, 8427, 10185, 10186, 10187, 27085], verified: false }, // TODO verify
  { className: "Mage", key: "dragons-breath", name: "Dragon's Breath", category: "aoe",
    spellIds: [31661, 33041, 33042, 33043], verified: false }, // TODO verify
  { className: "Mage", key: "cone-of-cold", name: "Cone of Cold", category: "aoe",
    spellIds: [120, 8492, 10159, 10160, 10161, 27087], verified: false }, // TODO verify
  { className: "Mage", key: "frost-nova", name: "Frost Nova", category: "aoe",
    spellIds: [122, 865, 6131, 10230, 27088], verified: false }, // TODO verify
  { className: "Mage", key: "flamestrike-r7", name: "Flamestrike (rank 7)", category: "aoe",
    spellIds: [27086], verified: false }, // TODO verify
  { className: "Mage", key: "flamestrike-r6", name: "Flamestrike (rank 6)", category: "aoe",
    spellIds: [10215], verified: false }, // TODO verify

  // -- cooldowns (Mage-specific) --
  { className: "Mage", key: "arcane-power", name: "Arcane Power/Combustion", category: "cooldown",
    spellIds: [12042, 11129], verified: false }, // TODO verify
  { className: "Mage", key: "cold-snap", name: "Cold Snap", category: "cooldown",
    spellIds: [11958], verified: false }, // TODO verify
  { className: "Mage", key: "evocation", name: "Evocation", category: "cooldown",
    spellIds: [12051], verified: false }, // TODO verify
  { className: "Mage", key: "icy-veins", name: "Icy Veins", category: "cooldown",
    spellIds: [12472], verified: false }, // TODO verify
  { className: "Mage", key: "invisibility", name: "Invisibility", category: "cooldown",
    spellIds: [66], verified: false }, // TODO verify
  { className: "Mage", key: "presence-of-mind", name: "Presence of Mind", category: "cooldown",
    spellIds: [12043], verified: false }, // TODO verify
  { className: "Mage", key: "summon-water-elemental", name: "Summon Water Elemental", category: "cooldown",
    spellIds: [31687], verified: false }, // TODO verify

  // ============================================================
  // ---- Warlock ----
  // ============================================================

  // -- single (from seed) --
  { className: "Warlock", key: "curse-of-the-elements", name: "Curse of the Elements", category: "single",
    spellIds: [1490, 11721, 11722, 27228],
    ranks: [{spellId:1490,rank:1},{spellId:11721,rank:2},{spellId:11722,rank:3},{spellId:27228,rank:4}],
    uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Warlock", key: "curse-of-shadow", name: "Curse of Shadow", category: "single",
    spellIds: [17862, 17937, 27229],
    ranks: [{spellId:17862,rank:1},{spellId:17937,rank:2},{spellId:27229,rank:3}],
    tracked: true, verified: true },
  { className: "Warlock", key: "curse-of-recklessness", name: "Curse of Recklessness", category: "single",
    spellIds: [704, 7658, 7659, 11717, 27226],
    uptimeAnnotated: true, tracked: true, verified: true },

  // -- single (from reference, not in seed) --
  { className: "Warlock", key: "armor", name: "Armor", category: "single",
    spellIds: [687, 696, 706, 1120, 7276, 7277, 7278, 11743, 28610, 28611], verified: false }, // TODO verify (Demon/Fel Armor)
  { className: "Warlock", key: "banish", name: "Banish", category: "single",
    spellIds: [710, 18647], verified: false }, // TODO verify
  { className: "Warlock", key: "conflagrate", name: "Conflagrate", category: "single",
    spellIds: [17962, 18930, 18931, 18932, 18933, 27266], verified: false }, // TODO verify
  { className: "Warlock", key: "corruption", name: "Corruption", category: "single",
    spellIds: [172, 6222, 6223, 7648, 11671, 11672, 25311], verified: false }, // TODO verify
  { className: "Warlock", key: "curse-of-agony", name: "Curse of Agony", category: "single",
    spellIds: [980, 1014, 6217, 11711, 11712, 11713, 27218], verified: false }, // TODO verify
  { className: "Warlock", key: "curse-of-doom", name: "Curse of Doom", category: "single",
    spellIds: [603, 30910], verified: false }, // TODO verify
  { className: "Warlock", key: "curse-of-tongues", name: "Curse of Tongues", category: "single",
    spellIds: [1714, 11719], verified: false }, // TODO verify
  { className: "Warlock", key: "curse-of-weakness", name: "Curse of Weakness", category: "single",
    spellIds: [702, 1108, 6205, 7646, 11707, 11708, 27224], verified: false }, // TODO verify
  { className: "Warlock", key: "dark-pact", name: "Dark Pact", category: "single",
    spellIds: [18220, 18937, 18938, 27265], verified: false }, // TODO verify
  { className: "Warlock", key: "death-coil", name: "Death Coil", category: "single",
    spellIds: [6789], verified: false }, // TODO verify
  { className: "Warlock", key: "drain-life", name: "Drain Life", category: "single",
    spellIds: [689, 699, 709, 7651, 11699, 11700, 27219], verified: false }, // TODO verify
  { className: "Warlock", key: "drain-mana", name: "Drain Mana", category: "single",
    spellIds: [5138, 6226, 11703, 11704, 27220], verified: false }, // TODO verify
  { className: "Warlock", key: "drain-soul", name: "Drain Soul", category: "single",
    spellIds: [1120, 8288, 8289, 11675, 27217], verified: false }, // TODO verify
  { className: "Warlock", key: "fear", name: "Fear", category: "single",
    spellIds: [5782, 6213, 6215], verified: false }, // TODO verify
  { className: "Warlock", key: "health-funnel", name: "Health Funnel", category: "single",
    spellIds: [755, 3698, 3699, 3700, 11693, 11694, 11695, 27259], verified: false }, // TODO verify
  { className: "Warlock", key: "immolate", name: "Immolate", category: "single",
    spellIds: [348, 707, 1094, 2941, 11665, 11667, 11668, 25309, 27215], verified: false }, // TODO verify
  { className: "Warlock", key: "incinerate", name: "Incinerate", category: "single",
    spellIds: [29722, 32231], verified: false }, // TODO verify
  { className: "Warlock", key: "life-tap", name: "Life Tap", category: "single",
    spellIds: [1454, 1455, 1456, 11687, 11688, 11689, 27222], verified: false }, // TODO verify
  { className: "Warlock", key: "searing-pain", name: "Searing Pain", category: "single",
    spellIds: [5676, 17919, 17920, 17921, 17922, 17923, 27210], verified: false }, // TODO verify
  { className: "Warlock", key: "shadow-bolt", name: "Shadow Bolt", category: "single",
    spellIds: [686, 695, 705, 1088, 1106, 7617, 11659, 11660, 25307, 27209], verified: false }, // TODO verify
  { className: "Warlock", key: "shadowburn", name: "Shadowburn", category: "single",
    spellIds: [17877, 18867, 18868, 18869, 18870, 18871, 27263], verified: false }, // TODO verify
  { className: "Warlock", key: "shadowfury", name: "Shadowfury", category: "aoe",
    spellIds: [30283, 30413, 30414], verified: false }, // TODO verify -- listed in single but is AoE stun
  { className: "Warlock", key: "siphon-life", name: "Siphon Life", category: "single",
    spellIds: [18265, 18879, 18880, 27264], verified: false }, // TODO verify
  { className: "Warlock", key: "soul-fire", name: "Soul Fire", category: "single",
    spellIds: [6353, 17924, 17925, 27211], verified: false }, // TODO verify
  { className: "Warlock", key: "soul-link", name: "Soul Link", category: "single",
    spellIds: [19028], verified: false }, // TODO verify
  { className: "Warlock", key: "unstable-affliction", name: "Unstable Affliction", category: "single",
    spellIds: [30108, 30404, 30405], verified: false }, // TODO verify
  { className: "Warlock", key: "melee", name: "Melee", category: "single",
    spellIds: [6603], verified: false }, // TODO verify (auto-attack placeholder)
  { className: "Warlock", key: "shoot", name: "Shoot (wand)", category: "single",
    spellIds: [5019], verified: false }, // TODO verify

  // -- aoe (non-shadowfury which was listed under single in reference) --
  { className: "Warlock", key: "hellfire", name: "Hellfire", category: "aoe",
    spellIds: [1949, 11683, 11684], verified: false }, // TODO verify
  { className: "Warlock", key: "rain-of-fire", name: "Rain of Fire", category: "aoe",
    spellIds: [5740, 6219, 11677, 11678, 25304], verified: false }, // TODO verify
  { className: "Warlock", key: "seed-of-corruption", name: "Seed of Corruption", category: "aoe",
    spellIds: [27243], verified: false }, // TODO verify

  // -- cooldowns (Warlock-specific) --
  { className: "Warlock", key: "amplify-curse", name: "Amplify Curse", category: "cooldown",
    spellIds: [18288], verified: false }, // TODO verify
  { className: "Warlock", key: "soulshatter", name: "Soulshatter", category: "cooldown",
    spellIds: [29858], verified: false }, // TODO verify

  // ============================================================
  // ---- Druid ----
  // ============================================================

  // -- single (from seed) --
  { className: "Druid", key: "faerie-fire", name: "Faerie Fire", category: "single",
    spellIds: [770, 778, 9749, 9907, 26993],
    uptimeAnnotated: true, tracked: true, verified: true },
  { className: "Druid", key: "faerie-fire-feral", name: "Faerie Fire (Feral)", category: "single",
    spellIds: [16857, 17390, 17391, 17392, 27011],
    uptimeAnnotated: true, tracked: true, verified: true },

  // -- single (from reference, not in seed) --
  { className: "Druid", key: "entangling-roots", name: "Entangling Roots", category: "single",
    spellIds: [339, 1062, 5195, 5196, 9852, 9853, 26989], verified: false }, // TODO verify
  { className: "Druid", key: "cyclone", name: "Cyclone", category: "single",
    spellIds: [33786], verified: false }, // TODO verify
  { className: "Druid", key: "insect-swarm", name: "Insect Swarm", category: "single",
    spellIds: [5570, 24974, 24975, 24976, 24977, 27013], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Druid", key: "moonfire", name: "Moonfire", category: "single",
    spellIds: [8921, 8924, 8925, 8926, 8927, 8928, 8929, 9833, 9834, 9835, 26987], uptimeAnnotated: true, verified: false }, // TODO verify
  { className: "Druid", key: "starfire", name: "Starfire", category: "single",
    spellIds: [2912, 8949, 8950, 8951, 9875, 9876, 25298], verified: false }, // TODO verify
  { className: "Druid", key: "thorns", name: "Thorns", category: "single",
    spellIds: [467, 782, 1075, 8914, 9756, 9910, 26992], verified: false }, // TODO verify
  { className: "Druid", key: "wrath", name: "Wrath", category: "single",
    spellIds: [5176, 5177, 5178, 5179, 5180, 6780, 8905, 9912, 25297], verified: false }, // TODO verify
  { className: "Druid", key: "hibernate", name: "Hibernate", category: "single",
    spellIds: [2637, 18658], verified: false }, // TODO verify
  { className: "Druid", key: "abolish-poison", name: "Abolish Poison", category: "single",
    spellIds: [2893], verified: false }, // TODO verify
  { className: "Druid", key: "cure-poison", name: "Cure Poison", category: "single",
    spellIds: [526], verified: false }, // TODO verify
  { className: "Druid", key: "remove-curse", name: "Remove Curse", category: "single",
    spellIds: [2782], verified: false }, // TODO verify
  { className: "Druid", key: "gift-of-the-wild", name: "Gift of the Wild/Mark of the Wild", category: "single",
    spellIds: [1126, 5232, 6756, 5234, 8907, 9884, 9885, 21849, 21850, 26990], verified: false }, // TODO verify
  { className: "Druid", key: "lifebloom", name: "Lifebloom", category: "single",
    spellIds: [33763], verified: false }, // TODO verify
  { className: "Druid", key: "swiftmend", name: "Swiftmend", category: "single",
    spellIds: [18562], verified: false }, // TODO verify
  { className: "Druid", key: "melee", name: "Melee", category: "single",
    spellIds: [6603], verified: false }, // TODO verify (auto-attack placeholder)
  { className: "Druid", key: "bear-form", name: "Bear Form", category: "single",
    spellIds: [5487], verified: false }, // TODO verify
  { className: "Druid", key: "cat-form", name: "Cat Form", category: "single",
    spellIds: [768], verified: false }, // TODO verify
  { className: "Druid", key: "dire-bear-form", name: "Dire Bear Form", category: "single",
    spellIds: [9634], verified: false }, // TODO verify
  { className: "Druid", key: "moonkin-form", name: "Moonkin Form", category: "single",
    spellIds: [24858], verified: false }, // TODO verify
  { className: "Druid", key: "tree-of-life", name: "Tree of Life", category: "single",
    spellIds: [33891], verified: false }, // TODO verify
  { className: "Druid", key: "bash", name: "Bash", category: "single",
    spellIds: [5211, 6798, 8983], verified: false }, // TODO verify
  { className: "Druid", key: "claw", name: "Claw", category: "single",
    spellIds: [1082, 3029, 3666], verified: false }, // TODO verify
  { className: "Druid", key: "cower", name: "Cower", category: "single",
    spellIds: [8998, 9000, 9892, 26999], verified: false }, // TODO verify
  { className: "Druid", key: "demoralizing-roar", name: "Demoralizing Roar", category: "single",
    spellIds: [99, 1735, 9490, 9747, 26998], verified: false }, // TODO verify
  { className: "Druid", key: "enrage", name: "Enrage", category: "single",
    spellIds: [5229], verified: false }, // TODO verify
  { className: "Druid", key: "ferocious-bite", name: "Ferocious Bite", category: "single",
    spellIds: [22568, 22827, 22828, 22829, 22830, 31018], verified: false }, // TODO verify
  { className: "Druid", key: "growl", name: "Growl", category: "single",
    spellIds: [6795], verified: false }, // TODO verify
  { className: "Druid", key: "lacerate", name: "Lacerate", category: "single",
    spellIds: [33745], verified: false }, // TODO verify
  { className: "Druid", key: "maim", name: "Maim", category: "single",
    spellIds: [22570], verified: false }, // TODO verify
  { className: "Druid", key: "mangle-bear", name: "Mangle (Bear)", category: "single",
    spellIds: [33878, 33986, 33987], verified: false }, // TODO verify
  { className: "Druid", key: "mangle-cat", name: "Mangle (Cat)", category: "single",
    spellIds: [33876, 33982, 33983], verified: false }, // TODO verify
  { className: "Druid", key: "maul", name: "Maul", category: "single",
    spellIds: [6807, 6808, 6809, 8972, 9745, 9880, 26996], verified: false }, // TODO verify
  { className: "Druid", key: "pounce", name: "Pounce", category: "single",
    spellIds: [9005, 9823, 9827], verified: false }, // TODO verify
  { className: "Druid", key: "prowl", name: "Prowl", category: "single",
    spellIds: [5215, 6783, 9913], verified: false }, // TODO verify
  { className: "Druid", key: "rake", name: "Rake", category: "single",
    spellIds: [1822, 1823, 1824, 9904], verified: false }, // TODO verify
  { className: "Druid", key: "ravage", name: "Ravage", category: "single",
    spellIds: [6785, 6787, 9866, 9867, 27005], verified: false }, // TODO verify
  { className: "Druid", key: "rip", name: "Rip", category: "single",
    spellIds: [1079, 9492, 9493, 9752, 9894, 9896, 27008], verified: false }, // TODO verify
  { className: "Druid", key: "shred", name: "Shred", category: "single",
    spellIds: [5221, 6800, 8992, 9829, 9830, 27002], verified: false }, // TODO verify
  { className: "Druid", key: "tigers-fury", name: "Tiger's Fury", category: "single",
    spellIds: [5217, 6793, 9845, 9846], verified: false }, // TODO verify

  // -- heals --
  { className: "Druid", key: "healing-touch-r13", name: "Healing Touch (rank 13)", category: "heal",
    spellIds: [25297], verified: false }, // TODO verify
  { className: "Druid", key: "healing-touch-r7-12", name: "Healing Touch (rank 7-12)", category: "heal",
    spellIds: [8903, 9758, 9888, 9889, 25297, 25431], verified: false }, // TODO verify
  { className: "Druid", key: "healing-touch-r1-6", name: "Healing Touch (rank 1-6)", category: "heal",
    spellIds: [5185, 5186, 5187, 5188, 5189, 6778], verified: false }, // TODO verify
  { className: "Druid", key: "regrowth-r10", name: "Regrowth (rank 10)", category: "heal",
    spellIds: [26980], verified: false }, // TODO verify
  { className: "Druid", key: "regrowth-r5-9", name: "Regrowth (rank 5-9)", category: "heal",
    spellIds: [9856, 9857, 9858, 9859, 9860], verified: false }, // TODO verify
  { className: "Druid", key: "regrowth-r1-4", name: "Regrowth (rank 1-4)", category: "heal",
    spellIds: [8936, 8938, 8939, 8940], verified: false }, // TODO verify
  { className: "Druid", key: "rejuvenation-r13", name: "Rejuvenation (rank 13)", category: "heal",
    spellIds: [26981], verified: false }, // TODO verify
  { className: "Druid", key: "rejuvenation-r7-12", name: "Rejuvenation (rank 7-12)", category: "heal",
    spellIds: [9841, 9908, 25299, 26982, 26983, 26984], verified: false }, // TODO verify
  { className: "Druid", key: "rejuvenation-r1-6", name: "Rejuvenation (rank 1-6)", category: "heal",
    spellIds: [774, 1058, 1430, 2090, 2091, 3627], verified: false }, // TODO verify

  // -- aoe --
  { className: "Druid", key: "hurricane", name: "Hurricane", category: "aoe",
    spellIds: [16914, 17401, 17402], verified: false }, // TODO verify
  { className: "Druid", key: "swipe", name: "Swipe", category: "aoe",
    spellIds: [779, 780, 769, 9754, 9908], verified: false }, // TODO verify
  { className: "Druid", key: "thrash-cat", name: "Thrash (Cat)", category: "aoe",
    spellIds: [779], verified: false }, // TODO verify (Thrash cat is from WotLK; listed in reference as feral)

  // -- cooldowns (Druid-specific) --
  { className: "Druid", key: "innervate", name: "Innervate", category: "cooldown",
    spellIds: [29166], verified: false }, // TODO verify
  { className: "Druid", key: "barkskin", name: "Barkskin", category: "cooldown",
    spellIds: [22812], verified: false }, // TODO verify
  { className: "Druid", key: "challenging-roar", name: "Challenging Roar", category: "cooldown",
    spellIds: [5209], verified: false }, // TODO verify
  { className: "Druid", key: "dash", name: "Dash", category: "cooldown",
    spellIds: [1850, 9821], verified: false }, // TODO verify
  { className: "Druid", key: "force-of-nature", name: "Force of Nature", category: "cooldown",
    spellIds: [33831], verified: false }, // TODO verify
  { className: "Druid", key: "frenzied-regeneration", name: "Frenzied Regeneration", category: "cooldown",
    spellIds: [22842, 22895, 22896], verified: false }, // TODO verify
  { className: "Druid", key: "natures-swiftness-druid", name: "Nature's Swiftness", category: "cooldown",
    spellIds: [17116], verified: false }, // TODO verify
  { className: "Druid", key: "rebirth", name: "Rebirth", category: "cooldown",
    spellIds: [20484, 20739, 20742, 20747, 20748, 26994], verified: false }, // TODO verify
  { className: "Druid", key: "tranquility", name: "Tranquility", category: "cooldown",
    spellIds: [740, 8918, 9862, 9863, 26983], verified: false }, // TODO verify
];
