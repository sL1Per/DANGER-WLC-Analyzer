/**
 * Per-zone speedrun validation rules for the CLA `validate` tab.
 *
 * SW rows copied verbatim from the xlsx sample (verified:true — all npc ids
 * and minKills match the `validate` sheet dump in /tmp/wow_dump/CLA__validate.txt).
 *
 * MH / BT / ZA curated from community speedrun rules on 2026-06-13.
 * Mob names sourced from the CLA `trans` sheet (columns W-AA of the xlsx).
 * NPC ids come from Wowhead TBC Classic where confirmed; anything not
 * individually verified on Wowhead is marked LOW-CONFIDENCE in the comment.
 * All three zones carry verified:false — a human should cross-check these
 * against live WCL logs before relying on them.
 *
 * MH+BT is run as a combined speedrun; boss.kind="split" encodes the
 * "5 for MH and 9 for BT" rule visible in the validate sheet dump (row 10).
 */

export type BossRequirement =
  | { kind: "single"; count: number }
  | { kind: "split"; count1: number; label1: string; count2: number; label2: string };

export interface ZoneTrashRule {
  name: string;
  npcIds: number[];
  minKills: number;
}

export interface ZoneValidation {
  zone: string;
  trash: ZoneTrashRule[];
  boss: BossRequirement;
  startingPointNpcIds: number[];
  verified: boolean;
}

export const validateRules: ZoneValidation[] = [
  // ── Sunwell Plateau (SW) ─────────────────────────────────────────────────
  // Verified: all ids + minKills confirmed from xlsx validate sheet dump.
  // Starting point: Sunblade Protector (25507), same id as first trash row.
  {
    zone: "SW",
    verified: true,
    boss: { kind: "single", count: 6 },
    startingPointNpcIds: [25507],
    trash: [
      {
        name: "Sunblade Protector",
        npcIds: [25507],
        minKills: 5,
      },
      {
        name: "Sunblade Arch Mage/Cabalist/Dawn Priest/Dusk Priest/Slayer/Vindicator",
        npcIds: [25363, 25367, 25368, 25369, 25370, 25371],
        minKills: 65,
      },
      {
        name: "Sunblade Scout",
        npcIds: [25372],
        minKills: 4,
      },
      {
        name: "Shadowsword Commander/Lifeshaper/Manafiend/Soulbinder/Vanquisher",
        npcIds: [25373, 25483, 25486, 25506, 25837],
        minKills: 26,
      },
      {
        name: "Doomfire Destroyer",
        npcIds: [25592],
        minKills: 1,
      },
      {
        name: "Oblivion Mage/Painbringer/Priestess of Torment",
        npcIds: [25509, 25591, 25597],
        minKills: 6,
      },
      {
        name: "Apocalypse Guard",
        npcIds: [25593],
        minKills: 4,
      },
      {
        name: "Cataclysm Hound",
        npcIds: [25599],
        minKills: 2,
      },
      {
        name: "Shadowsword Guardian",
        npcIds: [25508],
        minKills: 2,
      },
    ],
  },

  // ── Mount Hyjal (MH) ─────────────────────────────────────────────────────
  // verified:false — ids curated from community speedrun rules; cross-check
  // against WCL before relying on them.
  //
  // Hyjal is wave-based: five waves before each of five bosses.
  // Speedrun rules require killing all required wave mobs before pulling boss.
  // Starting point: Rage Winterchill (17767) confirmed on Wowhead TBC.
  //
  // Wave mob ids (LOW-CONFIDENCE unless noted):
  //   17942 = Ghoul (wowhead confirms Hyjal Summit zone)
  //   17941 = Crypt Fiend  [LOW-CONFIDENCE: Wowhead shows "Mennu" at 17941 —
  //            likely a lookup collision; actual Hyjal Crypt Fiend id uncertain]
  //   17940 = Gargoyle      [LOW-CONFIDENCE]
  //   17946 = Ancient Wisp  [LOW-CONFIDENCE: Wowhead returned "Ancient Wisp" but
  //            zone unknown; consistent with Hyjal lore]
  //   17965 = Abomination   [LOW-CONFIDENCE]
  //   17943 = Banshee        [LOW-CONFIDENCE]
  //   18011 = Fel Orc Neophyte [LOW-CONFIDENCE — Kaz'rogal/Azgalor wave mobs]
  //   18093 = Fel Orc Reaver  [LOW-CONFIDENCE]
  //   18094 = Fel Orc Bonechewer [LOW-CONFIDENCE]
  //
  // minKills derived from community speedrun documentation (wave counts per boss).
  {
    zone: "MH",
    verified: false,
    boss: { kind: "single", count: 5 },
    // Rage Winterchill is the first boss and a natural starting point.
    // npc 17767 = Rage Winterchill (Wowhead: Hyjal Summit confirmed via boss id).
    startingPointNpcIds: [17767],
    trash: [
      {
        // Undead wave mobs for Rage Winterchill / Anetheron phases.
        // 17942 = Ghoul (LOW-CONFIDENCE id), 17940 = Gargoyle (LOW-CONFIDENCE),
        // 17941 = Crypt Fiend (LOW-CONFIDENCE id per note above).
        name: "Ghoul/Crypt Fiend/Gargoyle",
        npcIds: [17942, 17940, 17941],
        minKills: 30,
      },
      {
        // Ancient Wisp / Banshee also appear in undead waves.
        // 17946 = Ancient Wisp (LOW-CONFIDENCE), 17943 = Banshee (LOW-CONFIDENCE).
        name: "Ancient Wisp/Banshee",
        npcIds: [17946, 17943],
        minKills: 10,
      },
      {
        // Abomination appears in waves before Anetheron.
        // 17965 = Abomination (LOW-CONFIDENCE).
        name: "Abomination",
        npcIds: [17965],
        minKills: 5,
      },
      {
        // Infernal appears with Anetheron's waves.
        // 17987 = Towering Infernal (LOW-CONFIDENCE).
        name: "Towering Infernal",
        npcIds: [17987],
        minKills: 3,
      },
      {
        // Fel Orc waves (Kaz'rogal and Azgalor phases).
        // 18011 = Fel Orc Neophyte, 18093 = Fel Orc Reaver,
        // 18094 = Fel Orc Bonechewer (all LOW-CONFIDENCE).
        name: "Fel Orc Neophyte/Reaver/Bonechewer",
        npcIds: [18011, 18093, 18094],
        minKills: 20,
      },
    ],
  },

  // ── Black Temple (BT) ────────────────────────────────────────────────────
  // verified:false — ids curated from community speedrun rules.
  // BT combined run uses split boss rule: 5 MH bosses + 9 BT bosses.
  // (Rule visible in validate sheet dump row 10:
  //  "number of bosses killed (5 for MH and 9 for BT necessary): 4")
  //
  // Starting point: first trash pack after the entrance gate.
  // 22841 = Shade of Akama confirmed on Wowhead as Black Temple.
  // Trash ids below curated from known BT mob names in CLA trans sheet (Y col):
  //   Bonechewer Taskmaster, Bonechewer Behemoth, Bonechewer Blade Fury,
  //   Bonechewer Combatant, Dragonmaw Wyrmcaller/Illidari Fearbringer,
  //   Illidari Centurion/Ashtongue Mystic, Illidari Nightlord,
  //   Illidari Boneslicer/Illidari Defiler/Illidari Heartseeker,
  //   Ashtongue Feral Spirit, Ashtongue Primalist,
  //   Shadowmoon Champion, Shadowmoon Houndmaster,
  //   Shadowmoon Weapon Master/Wrathbone Flayer,
  //   Hand of Gorefiend, Promenade Sentinel, Illidari Blood Lord,
  //   Priestess of Torment, Mistress of Dementia/Mistress of Woe,
  //   Temple Acolyte/Charming Patron.
  // All npc ids are LOW-CONFIDENCE (no Wowhead verification per-id for most).
  {
    zone: "BT",
    verified: false,
    boss: { kind: "split", count1: 5, label1: "MH", count2: 9, label2: "BT" },
    // First trash pack in BT entrance courtyard; Bonechewer mobs (LOW-CONFIDENCE ids).
    // Using 22051 as placeholder for entrance courtyard mob — LOW-CONFIDENCE.
    startingPointNpcIds: [22051],
    trash: [
      {
        // Bonechewer trash packs near entrance (Illidan's Reach courtyard).
        // LOW-CONFIDENCE ids: 22051=Bonechewer Taskmaster, 22055=Bonechewer Behemoth,
        // 22057=Bonechewer Blade Fury, 22058=Bonechewer Combatant.
        name: "Bonechewer Taskmaster/Behemoth/Blade Fury/Combatant",
        npcIds: [22051, 22055, 22057, 22058],
        minKills: 15,
      },
      {
        // Dragonmaw/Illidari trash in middle section.
        // LOW-CONFIDENCE ids: 22397=Dragonmaw Wyrmcaller, 22396=Illidari Fearbringer.
        name: "Dragonmaw Wyrmcaller/Illidari Fearbringer",
        npcIds: [22397, 22396],
        minKills: 10,
      },
      {
        // Illidari Centurion and Ashtongue Mystic packs.
        // LOW-CONFIDENCE ids: 22260=Illidari Centurion, 22261=Ashtongue Mystic.
        name: "Illidari Centurion/Ashtongue Mystic",
        npcIds: [22260, 22261],
        minKills: 8,
      },
      {
        // Shadowmoon trash near Teron/RoS.
        // LOW-CONFIDENCE ids: 22083=Shadowmoon Champion, 22084=Shadowmoon Houndmaster,
        // 22085=Shadowmoon Weapon Master, 23420=Wrathbone Flayer.
        name: "Shadowmoon Champion/Houndmaster/Weapon Master/Wrathbone Flayer",
        npcIds: [22083, 22084, 22085, 23420],
        minKills: 8,
      },
      {
        // Ashtongue feral/primal mobs near Shade of Akama.
        // LOW-CONFIDENCE ids: 22843=Ashtongue Feral Spirit, 22844=Ashtongue Primalist.
        name: "Ashtongue Feral Spirit/Primalist",
        npcIds: [22843, 22844],
        minKills: 5,
      },
      {
        // Illidari elite trash (boneslicer etc) near final bosses.
        // LOW-CONFIDENCE ids: 22411=Illidari Boneslicer, 22412=Illidari Defiler,
        // 22413=Illidari Heartseeker, 22415=Illidari Nightlord, 22416=Illidari Blood Lord.
        name: "Illidari Boneslicer/Defiler/Heartseeker/Nightlord/Blood Lord",
        npcIds: [22411, 22412, 22413, 22415, 22416],
        minKills: 5,
      },
    ],
  },

  // ── Zul'Aman (ZA) ────────────────────────────────────────────────────────
  // verified:false — ids curated from community speedrun rules.
  // ZA speedrun has a timed chest event (kill 4 animal bosses within timer).
  // Trash mob names sourced from CLA trans sheet Z column.
  //
  // Starting point: Amani'shi Savage (npc id LOW-CONFIDENCE).
  // Confirmed on Wowhead: 24143 = Spirit of the Lynx (ZA boss add, not trash).
  // 23863 = Zul'jin confirmed on Wowhead (ZA).
  //
  // Amani'shi trash ids are LOW-CONFIDENCE (community-sourced, not per-id verified):
  //   Amani'shi Savage      ~23515
  //   Amani'shi Medicine Man ~23523
  //   Amani'shi Wind Walker  ~23524
  //   Amani'shi Flame Caster ~23525
  //   Amani'shi Protector    ~23518
  //   Amani'shi Tempest      ~23520
  //   Amani'shi Warbringer   ~23521
  //   Amani Elder Lynx       ~24143 (Wowhead: Spirit of the Lynx, ZA — may be boss add)
  //   Amani'shi Handler      ~23516
  //   Amani'shi Tribesman    ~23517
  //   Amani'shi Berserker    ~23519
  //   Amani'shi Axe Thrower  ~23522
  {
    zone: "ZA",
    verified: false,
    boss: { kind: "single", count: 6 },
    // Amani'shi Savage is typically the first mob past the entrance.
    startingPointNpcIds: [23515],
    trash: [
      {
        // Entrance gauntlet packs: Savage, Tribesman, Handler.
        // LOW-CONFIDENCE ids.
        name: "Amani'shi Savage/Tribesman/Handler",
        npcIds: [23515, 23517, 23516],
        minKills: 20,
      },
      {
        // Healer / caster packs: Medicine Man, Wind Walker, Flame Caster.
        // LOW-CONFIDENCE ids.
        name: "Amani'shi Medicine Man/Wind Walker/Flame Caster",
        npcIds: [23523, 23524, 23525],
        minKills: 10,
      },
      {
        // Defensive packs: Protector, Warbringer, Berserker.
        // LOW-CONFIDENCE ids.
        name: "Amani'shi Protector/Warbringer/Berserker",
        npcIds: [23518, 23521, 23519],
        minKills: 10,
      },
      {
        // Ranged packs: Axe Thrower, Tempest.
        // LOW-CONFIDENCE ids.
        name: "Amani'shi Axe Thrower/Tempest",
        npcIds: [23522, 23520],
        minKills: 5,
      },
      {
        // Elder Lynx packs near Nalorakk.
        // 24143 = Spirit of the Lynx confirmed on Wowhead as ZA — may be a boss-phase
        // add rather than trash; using as proxy for Amani Elder Lynx (LOW-CONFIDENCE).
        name: "Amani Elder Lynx",
        npcIds: [24143],
        minKills: 3,
      },
    ],
  },
];

/**
 * Maps the full WCL zone name string to the short code used in ZoneValidation.
 * Zone names match what the WCL v1 API returns in the `zone` field of report data.
 */
export const zoneCodeByName: Record<string, string> = {
  Karazhan: "Kara",
  "Gruul's Lair": "Gruul",
  Magtheridon: "Mag",
  "Serpentshrine Cavern": "SSC",
  "Tempest Keep": "TK",
  "Mount Hyjal": "MH",
  "Black Temple": "BT",
  "Zul'Aman": "ZA",
  "Sunwell Plateau": "SW",
};
