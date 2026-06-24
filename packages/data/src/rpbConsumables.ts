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
  /** buff-uptime row: spellIds are aura ids resolved against report.buffs, and the
   *  row reports an uptime% next to the application count (see core rpbConsumables). */
  buffUptime?: boolean;
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
// Row order and grouping mirror the original RPB "Consumables" block exactly
// (verified against an RPB export, 2026-06-23). The original splits potions by
// effect (healing vs mana), pulls Mana Emerald out from the other mana gems, and
// keeps only the top three Healthstone ranks — so the grouping here intentionally
// differs from the simpler combined rows used before.
export const rpbConsumables: RpbConsumable[] = [
  { key: "drums-of-battle", name: "Drums of Battle", spellIds: [35476], verified: true },
  { key: "flame-cap", name: "Flame Cap", spellIds: [28714], verified: true },
  { key: "destruction-potion", name: "Destruction Potion", spellIds: [28508], verified: true },
  { key: "haste-potion", name: "Haste Potion", spellIds: [28507], verified: true },
  { key: "insane-strength-potion", name: "Insane Strength Potion", spellIds: [28494], verified: true },
  // Ironshield Potion: applies the "Ironshield" effect (28515, +2500 armor); WCL
  // logs the potion use under its effect id, as every other potion row here does.
  // UNVERIFIED against a live report's casts — confirm via E2E.
  { key: "ironshield-potion", name: "Ironshield Potion", spellIds: [28515] },
  // Free Action Potion (6615) + Living Action Potion (24364, "Living Free Action").
  { key: "free-action-potion", name: "Living/Free Action Potion", spellIds: [6615, 24364], verified: true },
  // "equivalents" = Super (28495 "Healing Potion") + Major (17534) healing ranks.
  { key: "super-healing-potion", name: "Super Healing Potion equivalents", spellIds: [28495, 17534], verified: true },
  // "equivalents" = Super (28499 "Restore Mana") + Major (17531) mana ranks.
  { key: "super-mana-potion", name: "Super Mana Potion equivalents", spellIds: [28499, 17531], verified: true },
  // Demonic Rune (16666) + Dark Rune (27869).
  { key: "rune", name: "Demonic / Dark Rune", spellIds: [16666, 27869], verified: true },
  // Top Healthstone ranks only (Minor 6262 / Lesser 6263 are excluded by the original):
  // Greater (11732) + Major/Master (27235).
  { key: "healthstone", name: "Master/Major/Greater Healthstone", spellIds: [11732, 27235], verified: true },
  // Mana Emerald is broken out on its own row; the lesser gems (Agate 5405, Jade
  // 10052, Citrine 10057, Ruby 10058) share the "all other Mana Gems" row. All
  // resolve to "Replenish Mana".
  { key: "mana-emerald", name: "Mana Emerald", spellIds: [27103], verified: true },
  { key: "mana-gems", name: "all other Mana Gems", spellIds: [5405, 10052, 10057, 10058], verified: true },
  { key: "thistle-tea", name: "Thistle Tea", spellIds: [9512], verified: true },
  // Heavy Netherweave Bandage — First Aid channel logged under spell 27033.
  { key: "heavy-netherweave-bandage", name: "Heavy Netherweave Bandage", spellIds: [27033], verified: true },
  // Gift of Arthas (guardian elixir): no in-combat cast, so it's a buff-uptime row.
  // 11371 is the self-buff aura (already fetched via consumableBuffs); the count is
  // the number of buff applications. (The original's larger number is the on-hit
  // proc count from debuff 11374, which our merged buff intervals don't reproduce.)
  { key: "gift-of-arthas", name: "Gift of Arthas", spellIds: [11371], verified: true, buffUptime: true },
];
