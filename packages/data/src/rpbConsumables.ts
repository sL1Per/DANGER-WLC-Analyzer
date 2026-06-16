// packages/data/src/rpbConsumables.ts

/** A combat-consumable whose per-player *use count* on boss fights is shown in the
 *  RPB General tab. `spellIds` lists every cast id that counts toward the row;
 *  "grouped" rows (equivalents / all ranks) sum naturally because the core counts
 *  any cast whose id is in the set. */
export interface RpbConsumable {
  key: string;        // stable slug
  name: string;       // display label
  spellIds: number[]; // all ids that count toward this row (grouped rows sum)
  verified?: boolean; // true once confirmed against TBC 2.5.4
}

// All ids below verified against the TBC 2.5.4 client DB on 2026-06-16 by resolving
// each id on the Wowhead TBC database (wowhead.com/tbc/spell=ID): every id returned
// the named spell (or, for grouped rows, a same-effect spell — e.g. mana gems all
// resolve to "Replenish Mana", potions to "Restore Mana"/"Healing Potion"). Bogus
// rank guesses (6264 → "Nimble Reflexes", 17354/17359/11731 → 404) were dropped
// during verification. Re-verify any future additions the same way.
//
// NOTE: "temporary weapon enhancement" (oils/sharpening stones) is intentionally NOT
// here. Those are pre-pull weapon buffs, not in-combat casts, so they don't appear in
// playerCasts; the original tracks them as a separate buff-*uptime* metric (see the
// RPB "temporary weapon enhancement uptime" row), out of scope for this cast-count
// subsystem.
export const rpbConsumables: RpbConsumable[] = [
  { key: "drums-of-battle", name: "Drums of Battle", spellIds: [35476], verified: true },
  { key: "flame-cap", name: "Flame Cap", spellIds: [28714], verified: true },
  { key: "destruction-potion", name: "Destruction Potion", spellIds: [28508], verified: true },
  { key: "haste-potion", name: "Haste Potion", spellIds: [28507], verified: true },
  { key: "insane-strength-potion", name: "Insane Strength Potion", spellIds: [28494], verified: true },
  // Free Action Potion (6615) + Living Action Potion (24364, "Living Free Action").
  { key: "free-action-potion", name: "Free Action Potion", spellIds: [6615, 24364], verified: true },
  // Super Mana Potion (28499 "Restore Mana") + Super Healing Potion (28495 "Healing Potion").
  { key: "super-potion", name: "Super Mana/Healing Potion", spellIds: [28499, 28495], verified: true },
  // Major Mana Potion (17531 "Restore Mana") + Major Healing Potion (17534 "Healing Potion").
  { key: "major-potion", name: "Major Mana/Healing Potion", spellIds: [17531, 17534], verified: true },
  // Demonic Rune (16666) + Dark Rune (27869).
  { key: "rune", name: "Demonic / Dark Rune", spellIds: [16666, 27869], verified: true },
  // Mana Tide Totem rank 1 (16190) + rank 2 (39609).
  { key: "mana-tide-totem", name: "Mana Tide Totem", spellIds: [16190, 39609], verified: true },
  { key: "innervate", name: "Innervate", spellIds: [29166], verified: true },
  // Mage mana gems, all ranks — every id resolves to "Replenish Mana":
  // Mana Agate (5405), Mana Jade (10052), Mana Citrine (10057), Mana Ruby (10058), Mana Emerald (27103).
  { key: "mana-gems", name: "Mana Gems", spellIds: [5405, 10052, 10057, 10058, 27103], verified: true },
  { key: "thistle-tea", name: "Thistle Tea", spellIds: [9512], verified: true },
  // Healthstone use spells: Minor (6262), Lesser (6263), Major (11732), Master (27235).
  { key: "healthstone", name: "Healthstone", spellIds: [6262, 6263, 11732, 27235], verified: true },
];
