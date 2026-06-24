// packages/data/src/trinketRacials.ts
//
// On-use trinket/racial spell ids for RPB role sheet tracking.
//
// IMPORTANT — id verification policy (mirrors classAbilities.ts):
//   The id here is the ON-USE SPELL id (the cast/buff activation id WCL records),
//   NOT the item id.  Every id must be verified against the TBC 2.5.4 client DB
//   (wago.tools SpellName) before being marked `verified: true`.
//   Entries added before verification carry `verified: false` and a `// TODO verify`
//   comment.  Do not remove or silence these flags without an explicit wago.tools check.

export interface TrinketRacial {
  spellId: number;
  name: string;
  verified?: boolean;
}

/** On-use trinkets and racial abilities whose activation WCL logs as a cast or buff event.
 *  All ids below are UNVERIFIED best-guess on-use spell ids — each marked accordingly.
 *  Verify each against wago.tools SpellName for TBC 2.5.4.44833 before marking verified. */
export const trinketRacials: TrinketRacial[] = [

  // ── Racial abilities ──────────────────────────────────────────────────────────

  // Blood Fury (Orc racial, melee variant). There are separate melee/spell-power
  // versions; WCL typically sees the buff id. Rank varies by level; the rank-10
  // variant (level 60) is ~33697 in vanilla but TBC uses a separate id.
  { spellId: 33697, name: "Blood Fury (melee)", verified: false },        // TODO verify
  // Blood Fury (Orc racial, spell-power variant, same buff icon, different id in TBC)
  { spellId: 33702, name: "Blood Fury (spell power)", verified: false },  // TODO verify

  // Berserking (Troll racial). TBC on-use buff. Classic/TBC id varies between
  // 20554 (old) and 26296/26297 (TBC re-implementation).
  { spellId: 26297, name: "Berserking", verified: false },                // TODO verify

  // Fear Ward (Dwarf racial in vanilla; in TBC it became a baseline Priest ability
  // available to all races. Tracked here as a racial-origin on-use buff.)
  { spellId: 6346, name: "Fear Ward", verified: false },                  // TODO verify

  // ── On-use trinkets (TBC raid tier) ─────────────────────────────────────────

  // Icon of the Silver Crescent — Vendor (Sha'tari Skyguard), +155 spell damage on use.
  // On-use spell id is uncertain; item id is 29376.
  { spellId: 35163, name: "Icon of the Silver Crescent", verified: false }, // TODO verify

  // Scarab of Displacement — Moroes loot (Karazhan), +150 melee AP on use.
  // Item id 27896.
  { spellId: 33507, name: "Scarab of Displacement", verified: false },   // TODO verify

  // Badge of Tenacity — Leotheras loot (SSC), +150 dodge rating on use.
  // Item id 28604. Note: different from Badge of the Swarmguard.
  { spellId: 35164, name: "Badge of Tenacity", verified: false },        // TODO verify

  // Bloodlust Brooch — Gruul/Rep reward, +278 AP on use (2 min cd).
  // Item id 29383.
  { spellId: 35166, name: "Bloodlust Brooch", verified: false },         // TODO verify

  // Moroes' Lucky Pocket Watch — Moroes loot (Karazhan), +320 dodge rating on use.
  // Item id 23557.
  { spellId: 29060, name: "Moroes' Lucky Pocket Watch", verified: false }, // TODO verify

  // Abacus of Violent Odds — Mechanar boss (The Mechanar), +260 haste rating on use.
  // Item id 28288.
  { spellId: 35165, name: "Abacus of Violent Odds", verified: false },   // TODO verify

  // Badge of the Swarmguard — AQ40 drop, on use: reduces armor of target by 200
  // per stack. Notably used in T6 content for armor pen.
  // Item id 21670.
  { spellId: 26481, name: "Badge of the Swarmguard", verified: false },  // TODO verify

  // Bangle of Endless Blessings — Terestian Illhoof loot (Karazhan), proc/on-use
  // spell power increase for healers. Item id 32486.
  { spellId: 40371, name: "Bangle of Endless Blessings", verified: false }, // TODO verify

  // Essence of the Martyr — Badge vendor (Lower City), +297 healing / +99 SP on use.
  // Item id 29376. (Note: may share item with Icon of the Silver Crescent in some lists—
  // Essence of the Martyr is 30720.)
  { spellId: 37660, name: "Essence of the Martyr", verified: false },    // TODO verify

  // Ribbon of Sacrifice — Karazhan drop, on-use healing for self.
  // Item id 28190. On-use buff spell id uncertain; placeholder used.
  { spellId: 34836, name: "Ribbon of Sacrifice", verified: false }, // TODO verify

  // Vengeance of the Illidari — Gurtogg Bloodboil loot (Black Temple),
  // on-use +202 spell damage. Item id 32483.
  { spellId: 40450, name: "Vengeance of the Illidari", verified: false }, // TODO verify

  // ── Scryer / Aldor on-use neck/item trinkets ─────────────────────────────────

  // Spell Power — generic on-use buff name used by both Scryer's Bloodgem and
  // Xi'ri's Gift. WCL logs these as a buff named "Spell Power" (or similar).
  // Scryer's Bloodgem (item 29132) on-use ~+150 spell damage.
  { spellId: 37447, name: "Spell Power (Scryer's Bloodgem)", verified: false }, // TODO verify
  // Xi'ri's Gift (item 32483 / 33508) — similar Aldor-faction on-use spell power.
  { spellId: 38338, name: "Spell Power (Xi'ri's Gift)", verified: false },       // TODO verify
];

/** Extra Windfury proc spell id (Enhancement Shaman Windfury Totem extra attack).
 *  This is the proc/extra-attack spell id WCL attributes, NOT the totem aura id.
 *  Verify against Task-1 report and wago.tools. */
export const extraWindfurySpellId = 33010; // TODO verify

/** Battle Squawk buff id (Cenarion War Hippogryph trinket / similar battle-squawk
 *  effect). Verify the correct TBC buff id against wago.tools. */
export const battleSquawkBuffId = 23060; // TODO verify
