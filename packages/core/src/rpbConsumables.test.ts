import { describe, expect, it } from "vitest";
import { rpbConsumables, type RpbConsumableSpec } from "./rpbConsumables";
import type { ReportData } from "./types";

const baseReport = (): ReportData => ({
  reportId: "R", title: "t", zoneName: "Tempest Keep",
  startTime: 0, endTime: 10000,
  fights: [
    { id: 1, name: "Trash", encounterId: 0, isBoss: false, startTime: 0, endTime: 1000 },
    { id: 2, name: "Void Reaver", encounterId: 624, isBoss: true, kill: true, startTime: 1000, endTime: 5000 },
    { id: 3, name: "Kalecgos", encounterId: 730, isBoss: true, kill: true, startTime: 5000, endTime: 9000 },
  ],
  players: [
    { id: 1, name: "Locky", class: "Warlock" },
    { id: 2, name: "Magey", class: "Mage" },
  ],
  gear: [], itemMeta: {},
  playerTotals: [
    { playerId: 1, healingDone: 0, damageDone: 100, damageTaken: 0, magicDamageDone: 100 },
    { playerId: 2, healingDone: 0, damageDone: 100, damageTaken: 0, magicDamageDone: 100 },
  ],
  playerCasts: [],
});

const hastePotion: RpbConsumableSpec = { key: "haste-potion", name: "Haste Potion", spellIds: [28507] };
const manaGems: RpbConsumableSpec = { key: "mana-gems", name: "Mana Gems", spellIds: [27103, 10058] };

describe("rpbConsumables", () => {
  it("counts only casts within boss fights (trash excluded)", () => {
    const r = baseReport();
    r.playerCasts = [
      { fightId: 1, playerId: 1, spellId: 28507, timestamp: 100 }, // trash — excluded
      { fightId: 2, playerId: 1, spellId: 28507, timestamp: 1100 }, // boss — counted
    ];
    const res = rpbConsumables(r, [hastePotion])!;
    const locky = res.rows.find((x) => x.playerId === 1)!;
    expect(locky.counts["haste-potion"]).toBe(1);
  });

  it("excludes Kalecgos casts", () => {
    const r = baseReport();
    r.playerCasts = [
      { fightId: 2, playerId: 1, spellId: 28507, timestamp: 1100 }, // Void Reaver — counted
      { fightId: 3, playerId: 1, spellId: 28507, timestamp: 5100 }, // Kalecgos — excluded
    ];
    const res = rpbConsumables(r, [hastePotion])!;
    expect(res.rows.find((x) => x.playerId === 1)!.counts["haste-potion"]).toBe(1);
  });

  it("sums all member spell ids of a grouped consumable", () => {
    const r = baseReport();
    r.playerCasts = [
      { fightId: 2, playerId: 2, spellId: 27103, timestamp: 1100 }, // Mana Emerald
      { fightId: 2, playerId: 2, spellId: 10058, timestamp: 1200 }, // lower-rank gem
      { fightId: 2, playerId: 2, spellId: 28507, timestamp: 1300 }, // unrelated
    ];
    const res = rpbConsumables(r, [manaGems])!;
    expect(res.rows.find((x) => x.playerId === 2)!.counts["mana-gems"]).toBe(2);
  });

  it("isolates counts per player", () => {
    const r = baseReport();
    r.playerCasts = [
      { fightId: 2, playerId: 1, spellId: 28507, timestamp: 1100 },
      { fightId: 2, playerId: 1, spellId: 28507, timestamp: 1200 },
    ];
    const res = rpbConsumables(r, [hastePotion])!;
    expect(res.rows.find((x) => x.playerId === 1)!.counts["haste-potion"]).toBe(2);
    expect(res.rows.find((x) => x.playerId === 2)!.counts["haste-potion"]).toBe(0);
  });

  it("returns a row per player with className", () => {
    const r = baseReport();
    const res = rpbConsumables(r, [hastePotion])!;
    expect(res.rows.map((x) => x.playerName)).toEqual(["Locky", "Magey"]);
    expect(res.rows[1].className).toBe("Mage");
  });

  it("returns null when playerCasts is absent", () => {
    const r = baseReport();
    delete r.playerCasts;
    expect(rpbConsumables(r, [hastePotion])).toBeNull();
  });
});
