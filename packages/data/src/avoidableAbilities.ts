// packages/data/src/avoidableAbilities.ts
/** An ability whose damage is considered avoidable (stand-out-of, dodge, environmental).
 *  encounterId omitted = treated as globally avoidable — which is safe here because each
 *  id below is boss-unique (it only ever appears on its own encounter's events).
 *
 *  M7 (2026-06-15): ids name-verified against the TBC 2.5.4.44833 client DB (wago.tools
 *  SpellName). Still `verified:false` because (a) which exact same-named id lands as the
 *  DamageTaken event and (b) per-boss completeness must be confirmed against real logs —
 *  do that during the live-E2E pass with probe-damage.ts, then flip verified + extend. */
export interface AvoidableAbility {
  abilityId: number;
  name: string;
  /** WCL encounter id this applies to; omit for global (safe for boss-unique ids). */
  encounterId?: number;
  verified?: boolean;
}

// Canonical "stand-out-of / dodge" TBC raid mechanics. Multiple ids per ability cover
// the cast/missile + damage variants; only ids that actually appear as DamageTaken events
// contribute, so over-listing same-named ranks is harmless. Extend per boss during E2E.
export const avoidableAbilities: AvoidableAbility[] = [
  // Gruul's Lair — Gruul: confirmed present as real DamageTaken events in report on 2026-06-15
  // (Cave In 132k/75 hits, Shatter 105k/64 hits) — id + name + mechanic verified.
  { abilityId: 36240, name: "Cave In", verified: true },   // falling rocks — move out of the marked zone
  { abilityId: 33671, name: "Shatter", verified: true },   // proximity AoE — reduced by spreading
  // Tempest Keep — Void Reaver: Arcane Orb (must physically dodge the orb).
  { abilityId: 34172, name: "Arcane Orb", verified: false },
  { abilityId: 34190, name: "Arcane Orb", verified: false },
  // Tempest Keep — Kael'thas: Flame Strike (stand out of the patch).
  { abilityId: 36730, name: "Flame Strike", verified: false },
  { abilityId: 36731, name: "Flame Strike", verified: false },
  { abilityId: 36735, name: "Flame Strike", verified: false },
  // Black Temple — Mother Shahraz: Fatal Attraction (move apart; shadow damage if close).
  { abilityId: 40869, name: "Fatal Attraction", verified: false },
  { abilityId: 40870, name: "Fatal Attraction", verified: false },
  { abilityId: 40871, name: "Fatal Attraction", verified: false },
  { abilityId: 41001, name: "Fatal Attraction", verified: false },
  // Black Temple — Illidan: Flame Crash (fire patch under the boss).
  { abilityId: 40832, name: "Flame Crash", verified: false },
  // Serpentshrine Cavern — High Warlord Naj'entus: Needle Spine (spread / impale AoE).
  { abilityId: 39835, name: "Needle Spine", verified: false },
];

export const avoidableAbilityIds: Set<number> = new Set(avoidableAbilities.map((a) => a.abilityId));

/** Avoidable ability NAMES the role sheet matches against. WCL resolves every
 *  DamageTaken event's name from masterData, so matching by name (case-insensitive,
 *  parentheticals stripped) is robust to the unverified ids above. Covers the
 *  existing curated abilities plus the SSC/TK + environment hazards confirmed in
 *  reference logs. Extend per zone — each name is enemy/environment damage taken,
 *  so generic names (Whirlwind, Rebirth, Burn) can't collide with friendly casts. */
export const avoidableAbilityNames: string[] = [
  ...new Set(avoidableAbilities.map((a) => a.name)),
  // environmental hazards
  "Falling", "Scalding Water", "Flame Patch", "Toxic Spores",
  // Serpentshrine Cavern
  "Whirlwind",   // Leotheras the Blind
  "Spout",       // The Lurker Below
  // Tempest Keep
  "Burn",        // Al'ar (Phoenix)
  "Rebirth",     // Al'ar
];

/** Avoidable enemy debuffs whose APPLICATION COUNT the RPB role sheet reports
 *  (distinct from avoidable-damage ids above). Unverified until wago-checked. */
export const avoidableDebuffIds: { spellId: number; name: string; verified?: boolean }[] = [
  // Tempest Keep — Kael'thas: Nether Vapor (debuff applied by add, must be avoided). TODO verify
  { spellId: 35013, name: "Nether Vapor", verified: false },
  // Tempest Keep — Thaladred the Darkener (Kael add): Silence (look-away mechanic). TODO verify
  { spellId: 29914, name: "Silence (Thaladred the Darkener)", verified: false },
];
