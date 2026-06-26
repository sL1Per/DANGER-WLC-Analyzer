// packages/data/src/trinketRacials.ts
//
// On-use trinket/racial spell ids for RPB role sheet tracking.
//
// MATCHING MODEL (see rpbSheets.ts `roleSheet`):
//   WCL labels an on-use cast inconsistently — sometimes by the ITEM name
//   (e.g. "Abacus of Violent Odds"), sometimes by the BUFF/spell name
//   (e.g. Bloodlust Brooch's on-use is logged as "Lust for Battle"). Matching
//   purely by name therefore silently drops half the trinkets. So we match each
//   cast by its on-use SPELL id first, and fall back to the display name only as
//   a safety net (which also catches rank variants of the racials).
//
//   `spellId` is the ON-USE CAST spell id WCL records in cast events (its
//   abilityGameID), NOT the item id. `name` is the canonical display name shown
//   in the sheet (the item/racial name). Several effects have more than one
//   cast id (racials have per-rank ids), so multiple rows may share a `name`.
//
// VERIFICATION: ids marked `verified: true` were confirmed against a real WCL
// report (report GPAaJQBnF19VLft4 — SSC/TK) by correlating each on-use cast id
// with the equipped trinket (gear slots 12/13) that produces it, and against the
// TBC 2.5.4 client DB (wago.tools SpellName) + wowhead item tooltips.

export interface TrinketRacial {
  /** On-use cast spell id WCL logs (the abilityGameID in the cast event). */
  spellId: number;
  /** Canonical display name (item or racial name) shown in the RPB sheet. */
  name: string;
  verified?: boolean;
}

/** On-use trinkets and racial abilities whose activation WCL logs as a cast. */
export const trinketRacials: TrinketRacial[] = [

  // ── Racial abilities (WCL labels these by the racial/spell name) ───────────
  // Blood Fury (Orc) — separate melee/spell-power/base ranks; the name fallback
  // also catches any rank id not listed here.
  { spellId: 33697, name: "Blood Fury", verified: true },
  { spellId: 33702, name: "Blood Fury", verified: true },
  { spellId: 20572, name: "Blood Fury", verified: true },
  // Berserking (Troll). Name fallback catches the other rank ids.
  { spellId: 20554, name: "Berserking", verified: true },

  // ── On-use trinkets logged by the ITEM name ───────────────────────────────
  // Abacus of Violent Odds (item 28288) — +260 haste.
  { spellId: 33807, name: "Abacus of Violent Odds", verified: true },
  // Badge of the Swarmguard (item 21670) — armor-pen stacks.
  { spellId: 26480, name: "Badge of the Swarmguard", verified: true },
  // Essence of the Martyr (item 29376) — +healing/spell damage.
  { spellId: 35165, name: "Essence of the Martyr", verified: true },

  // ── On-use trinkets logged by the BUFF name (name-matching used to miss) ───
  // Bloodlust Brooch (item 29383) — +278 AP; logged as "Lust for Battle".
  { spellId: 35166, name: "Bloodlust Brooch", verified: true },
  // Icon of the Silver Crescent (item 29370) — +spell damage; logged as
  // "Blessing of the Silver Crescent".
  { spellId: 35163, name: "Icon of the Silver Crescent", verified: true },
  // Bangle of Endless Blessings (item 28370) — logged as "Endless Blessings".
  { spellId: 34210, name: "Bangle of Endless Blessings", verified: true },
  // Scarab of Displacement (item 30629) — +dodge; logged as "Displacement".
  { spellId: 38351, name: "Scarab of Displacement", verified: true },
  // Scryer's Bloodgem (item 29132) — +spell damage/healing; logged as
  // "Spell Power".
  { spellId: 35337, name: "Scryer's Bloodgem", verified: true },
  // Vengeance of the Illidari (item 28040) — +spell damage/healing.
  // (Not cast in the reference report; id from the item's Use effect.)
  { spellId: 33662, name: "Vengeance of the Illidari", verified: true },
  // Badge of Tenacity (item 32658) — +150 agility.
  // (Not cast in the reference report; id from the item's Use effect.)
  { spellId: 40729, name: "Badge of Tenacity", verified: true },
  // Moroes' Lucky Pocket Watch (item 28528) — +300 dodge.
  // (Not cast in the reference report; id from the item's Use effect.)
  { spellId: 34519, name: "Moroes' Lucky Pocket Watch", verified: true },
  // Ribbon of Sacrifice (item 28590) — on-use heal-received buff; logged as
  // "Blessing of Life".
  { spellId: 38332, name: "Ribbon of Sacrifice", verified: true },
];

/** Extra Windfury proc spell id (Enhancement Shaman Windfury Totem extra attack).
 *  This is the proc/extra-attack spell id WCL attributes, NOT the totem aura id.
 *  Verify against Task-1 report and wago.tools. */
export const extraWindfurySpellId = 33010; // TODO verify

/** Battle Squawk buff id (Cenarion War Hippogryph trinket / similar battle-squawk
 *  effect). Verify the correct TBC buff id against wago.tools. */
export const battleSquawkBuffId = 23060; // TODO verify
