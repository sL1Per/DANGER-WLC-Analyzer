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
const giftOfArthas: RpbConsumableSpec = { key: "gift-of-arthas", name: "Gift of Arthas", spellIds: [11371], buffUptime: true };

describe("rpbConsumables", () => {
  it("counts casts on the fights present in report.fights (scoping decides boss vs trash)", () => {
    const r = baseReport();
    r.playerCasts = [
      { fightId: 1, playerId: 1, spellId: 28507, timestamp: 100 }, // trash
      { fightId: 2, playerId: 1, spellId: 28507, timestamp: 1100 }, // boss
    ];
    // scoped to boss fights (the ALL-bosses card): only the boss cast counts
    const boss = { ...r, fights: r.fights.filter((f) => f.isBoss) };
    expect(rpbConsumables(boss, [hastePotion])!.rows.find((x) => x.playerId === 1)!.counts["haste-potion"]).toBe(1);
    // scoped to trash fights (the ALL-trash card): only the trash cast counts
    const trash = { ...r, fights: r.fights.filter((f) => !f.isBoss) };
    expect(rpbConsumables(trash, [hastePotion])!.rows.find((x) => x.playerId === 1)!.counts["haste-potion"]).toBe(1);
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

  it("reports buff-uptime rows as an application count + uptime fraction over scoped fights", () => {
    const r = baseReport();
    // Void Reaver is fight 2, window 1000–5000 (4000ms). Buff up for half of it.
    r.buffs = [
      { fightId: 2, targetId: 1, spellId: 11371, startTime: 1000, endTime: 3000 },
    ];
    const boss = { ...r, fights: r.fights.filter((f) => f.isBoss && !f.name.includes("Kalecgos")) };
    const row = rpbConsumables(boss, [giftOfArthas])!.rows.find((x) => x.playerId === 1)!;
    expect(row.counts["gift-of-arthas"]).toBe(1);
    expect(row.uptimes["gift-of-arthas"]).toBeCloseTo(2000 / 4000); // 0.5
  });

  it("buff-uptime rows are zero when report.buffs is absent", () => {
    const r = baseReport();
    delete r.buffs;
    const row = rpbConsumables(r, [giftOfArthas])!.rows.find((x) => x.playerId === 1)!;
    expect(row.counts["gift-of-arthas"]).toBe(0);
    expect(row.uptimes["gift-of-arthas"]).toBe(0);
  });

  it("returns null when playerCasts is absent", () => {
    const r = baseReport();
    delete r.playerCasts;
    expect(rpbConsumables(r, [hastePotion])).toBeNull();
  });
});
