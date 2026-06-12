import type { ReportData } from "../types";

export const reportFixture: ReportData = {
  reportId: "a1B2c3D4e5F6g7H8",
  title: "T5 fun",
  zoneName: "Serpentshrine Cavern",
  startTime: 1_700_000_000_000,
  endTime: 1_700_000_400_000,
  fights: [
    { id: 1, name: "Underbog Colossus", encounterId: 0, isBoss: false, startTime: 0, endTime: 60_000 },
    { id: 2, name: "Hydross the Unstable", encounterId: 623, isBoss: true, kill: false, startTime: 70_000, endTime: 130_000 },
    { id: 3, name: "Hydross the Unstable", encounterId: 623, isBoss: true, kill: true, startTime: 150_000, endTime: 250_000 },
    { id: 4, name: "Coilfang Shatterer", encounterId: 0, isBoss: false, startTime: 260_000, endTime: 290_000 },
    { id: 5, name: "The Lurker Below", encounterId: 624, isBoss: true, kill: true, startTime: 300_000, endTime: 380_000 },
  ],
  players: [
    { id: 1, name: "Playerone", class: "Mage" },
    { id: 2, name: "Playertwo", class: "Warrior" },
  ],
  gear: [
    {
      fightId: 3, playerId: 1, items: [
        { slot: 0, itemId: 24266, gemIds: [24030, 24030, 31867], permanentEnchantId: 29191 }, // Spellstrike Hood: 3 sockets filled (one uncommon), enchanted
        { slot: 4, itemId: 21848, gemIds: [24030], permanentEnchantId: 1144 },                // Spellfire Robe: 1 of 2 sockets filled, cheap enchant
        { slot: 8, itemId: 24250, gemIds: [] },                                               // Bracers of Havok: no enchant, 0 of 1 socket filled
        { slot: 14, itemId: 15138, gemIds: [], permanentEnchantId: 368 },                     // Onyxia Scale Cloak: excluded/fun item
        { slot: 10, itemId: 28227, gemIds: [] },                                              // Sha'tari ring (no enchant required)
      ],
    },
    {
      fightId: 3, playerId: 2, items: [
        { slot: 0, itemId: 30973, gemIds: [], permanentEnchantId: 29192 },   // no sockets in DB, enchanted: clean
        { slot: 4, itemId: 28781, gemIds: [], permanentEnchantId: 1891 },    // no sockets in DB
        { slot: 15, itemId: 28767, gemIds: [], permanentEnchantId: 2669 },   // no sockets in DB
        { slot: 6, itemId: 30528, gemIds: [], permanentEnchantId: 3010 },    // no sockets in DB
        { slot: 5, itemId: 29992, gemIds: [] },                              // no sockets in DB (waist — no enchant required)
      ],
    },
  ],
  buffs: [
    { fightId: 3, targetId: 1, spellId: 28520, startTime: 150_000, endTime: 250_000 }, // Flask of Relentless Assault: whole fight
    { fightId: 3, targetId: 1, spellId: 33256, startTime: 150_000, endTime: 200_000 }, // Well Fed (+20 Str): first half only
    { fightId: 3, targetId: 2, spellId: 28497, startTime: 150_000, endTime: 250_000 }, // Elixir of Major Agility: whole fight
    { fightId: 3, targetId: 2, spellId: 39627, startTime: 150_000, endTime: 250_000 }, // Elixir of Draenic Wisdom: whole fight
  ],
  drumCasts: [
    { fightId: 3, sourceId: 1, spellId: 35476, timestamp: 151_000 }, // Drums of Battle: 3 buffs applied
    { fightId: 3, sourceId: 1, spellId: 35476, timestamp: 211_000 }, // Drums of Battle: wasted (no applications)
  ],
  drumApplications: [
    { fightId: 3, sourceId: 1, targetId: 1, spellId: 35476, timestamp: 151_100 },
    { fightId: 3, sourceId: 1, targetId: 2, spellId: 35476, timestamp: 151_200 },
    { fightId: 3, sourceId: 1, targetId: 2, spellId: 35476, timestamp: 151_300 },
  ],
  itemMeta: {
    "24266": { name: "Spellstrike Hood", quality: 4 },
    "21848": { name: "Spellfire Robe", quality: 4 },
    "24250": { name: "Bracers of Havok", quality: 3 },
    "15138": { name: "Onyxia Scale Cloak", quality: 4 },
    "28227": { name: "Sha'tari Vengeance Ring", quality: 3 },
    "30973": { name: "Destroyer Helmet", quality: 4 },
    "28781": { name: "Chestplate of Stoicism", quality: 4 },
    "28767": { name: "The Decapitator", quality: 4 },
    "30528": { name: "Legguards of the Shattered Hand", quality: 4 },
    "29992": { name: "Belt of the Guardian", quality: 4 },
    "24030": { name: "Runed Living Ruby", quality: 3 },
    "31867": { name: "Great Golden Draenite", quality: 2 },
  },
};
