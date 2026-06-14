import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { WclError, type RawCombatantInfo, type RawReport } from "./wcl";

const raw: RawReport = {
  title: "T5 fun", startTime: 1, endTime: 2, zone: { name: "Karazhan" },
  fights: [], masterData: { actors: [], npcs: [] },
};

function makeApp(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  return createApp({
    fetchToken: vi.fn().mockResolvedValue({ accessToken: "tok", expiresIn: 86400 }),
    fetchRawReport: vi.fn().mockResolvedValue(raw),
    fetchCombatantInfo: vi.fn().mockResolvedValue([]),
    fetchItemMeta: vi.fn().mockResolvedValue({}),
    fetchBuffEvents: vi.fn().mockResolvedValue([]),
    fetchCastEvents: vi.fn().mockResolvedValue([]),
    fetchDeaths: vi.fn().mockResolvedValue([]),
    fetchInterrupts: vi.fn().mockResolvedValue([]),
    fetchDamageTaken: vi.fn().mockResolvedValue([]),
    fetchDamageDone: vi.fn().mockResolvedValue([]),
    fetchAllCasts: vi.fn().mockResolvedValue([]),
    fetchTable: vi.fn().mockResolvedValue([]),
    cacheTtlMs: 60_000,
    ...overrides,
  });
}

describe("POST /api/token", () => {
  it("mints a token from client credentials", async () => {
    const res = await makeApp().request("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "id", clientSecret: "sec" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accessToken: "tok", expiresIn: 86400 });
  });
  it("maps WCL 401 to 401 with a friendly message", async () => {
    const app = makeApp({ fetchToken: vi.fn().mockRejectedValue(new WclError(401, "bad")) });
    const res = await app.request("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "id", clientSecret: "sec" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/report/:id", () => {
  it("returns normalized data and caches it", async () => {
    const fetchRawReport = vi.fn().mockResolvedValue(raw);
    const app = makeApp({ fetchRawReport });
    const r1 = await app.request("/api/report/a1B2c3D4e5F6g7H8", {
      headers: { Authorization: "Bearer tok" },
    });
    expect(r1.status).toBe(200);
    const body1 = await r1.json();
    expect(body1.data.zoneName).toBe("Karazhan");
    expect(body1.cachedAt).toBeTypeOf("number");

    // second request: no auth header at all -> served from cache
    const r2 = await app.request("/api/report/a1B2c3D4e5F6g7H8");
    expect(r2.status).toBe(200);
    expect(fetchRawReport).toHaveBeenCalledTimes(1);
  });
  it("returns 401 with needsKey on cache miss without token", async () => {
    const res = await makeApp().request("/api/report/a1B2c3D4e5F6g7H8");
    expect(res.status).toBe(401);
    expect((await res.json()).needsKey).toBe(true);
  });
  it("rejects malformed report ids", async () => {
    const res = await makeApp().request("/api/report/short", {
      headers: { Authorization: "Bearer tok" },
    });
    expect(res.status).toBe(400);
  });
  it("DELETE evicts the cache (manual refresh) when auth header is present", async () => {
    const fetchRawReport = vi.fn().mockResolvedValue(raw);
    const app = makeApp({ fetchRawReport });
    const auth = { headers: { Authorization: "Bearer tok" } };
    await app.request("/api/report/a1B2c3D4e5F6g7H8", auth);
    await app.request("/api/report/a1B2c3D4e5F6g7H8", { ...auth, method: "DELETE" });
    await app.request("/api/report/a1B2c3D4e5F6g7H8", auth);
    expect(fetchRawReport).toHaveBeenCalledTimes(2);
  });
  it("DELETE without Authorization returns 401 and cache entry survives", async () => {
    const fetchRawReport = vi.fn().mockResolvedValue(raw);
    const app = makeApp({ fetchRawReport });
    const auth = { headers: { Authorization: "Bearer tok" } };
    // seed the cache
    await app.request("/api/report/a1B2c3D4e5F6g7H8", auth);
    // attempt keyless eviction
    const del = await app.request("/api/report/a1B2c3D4e5F6g7H8", { method: "DELETE" });
    expect(del.status).toBe(401);
    expect((await del.json()).error).toMatch(/Authorization/i);
    // cache entry still alive: keyless GET returns 200 without hitting WCL
    const r2 = await app.request("/api/report/a1B2c3D4e5F6g7H8");
    expect(r2.status).toBe(200);
    expect(fetchRawReport).toHaveBeenCalledTimes(1);
  });
  it("GET cachedAt matches the stored entry timestamp", async () => {
    const app = makeApp();
    const r1 = await app.request("/api/report/a1B2c3D4e5F6g7H8", {
      headers: { Authorization: "Bearer tok" },
    });
    const body1 = await r1.json();
    // Second (cached) request must return the same cachedAt
    const r2 = await app.request("/api/report/a1B2c3D4e5F6g7H8");
    const body2 = await r2.json();
    expect(body1.cachedAt).toBe(body2.cachedAt);
  });
});

describe("GET /api/report/:id — gear", () => {
  const rawWithBoss: RawReport = {
    ...raw,
    fights: [
      { id: 1, name: "Trash", encounterID: 0, kill: null, startTime: 0, endTime: 1 },
      { id: 2, name: "Attumen the Huntsman", encounterID: 652, kill: true, startTime: 2, endTime: 3 },
    ],
  };
  const combatants: RawCombatantInfo[] = [
    { sourceID: 7, fight: 2, gear: [{ id: 24266, slot: 0, gems: [{ id: 31867 }] }] },
  ];

  it("fetches combatant info for boss fights and resolves item meta", async () => {
    const fetchCombatantInfo = vi.fn().mockResolvedValue(combatants);
    const fetchItemMeta = vi.fn().mockResolvedValue({ "24266": { name: "Spellstrike Hood", quality: 4 } });
    const app = makeApp({
      fetchRawReport: vi.fn().mockResolvedValue(rawWithBoss),
      fetchCombatantInfo, fetchItemMeta,
    });
    const res = await app.request("/api/report/a1B2c3D4e5F6g7H8", { headers: { Authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.gear).toHaveLength(1);
    expect(body.data.itemMeta["24266"].name).toBe("Spellstrike Hood");
    expect(fetchCombatantInfo).toHaveBeenCalledWith("a1B2c3D4e5F6g7H8", "tok", [2]); // boss fights only
    // item ids AND gem ids requested:
    expect(fetchItemMeta.mock.calls[0]![0]).toEqual(expect.arrayContaining([24266, 31867]));
  });
  it("serves the report even when combatant info fails", async () => {
    const app = makeApp({
      fetchRawReport: vi.fn().mockResolvedValue(rawWithBoss),
      fetchCombatantInfo: vi.fn().mockRejectedValue(new WclError(502, "boom")),
      fetchItemMeta: vi.fn(),
    });
    const res = await app.request("/api/report/a1B2c3D4e5F6g7H8", { headers: { Authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
    expect((await res.json()).data.gear).toEqual([]);
  });
});

describe("GET /api/report/:id — buff intervals and drum events", () => {
  const rawWithBoss: RawReport = {
    ...raw,
    fights: [
      { id: 2, name: "Attumen the Huntsman", encounterID: 652, kill: true, startTime: 0, endTime: 100_000 },
    ],
  };

  it("includes intervals and drum events built from the event fetchers", async () => {
    const fetchBuffEvents = vi.fn().mockResolvedValue([
      // consumable buff (flask of pure death 28540): apply + remove
      { timestamp: 10_000, type: "applybuff", sourceID: 7, targetID: 7, abilityGameID: 28540, fight: 2 },
      { timestamp: 50_000, type: "removebuff", sourceID: 7, targetID: 7, abilityGameID: 28540, fight: 2 },
      // drum buff application (Drums of Battle 35476)
      { timestamp: 20_000, type: "applybuff", sourceID: 7, targetID: 9, abilityGameID: 35476, fight: 2 },
    ]);
    const fetchCastEvents = vi.fn().mockResolvedValue([
      { timestamp: 19_900, type: "cast", sourceID: 7, abilityGameID: 35476, fight: 2 },
    ]);
    const app = makeApp({
      fetchRawReport: vi.fn().mockResolvedValue(rawWithBoss),
      fetchBuffEvents, fetchCastEvents,
    });
    const res = await app.request("/api/report/a1B2c3D4e5F6g7H8", { headers: { Authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.buffs).toContainEqual(
      { fightId: 2, targetId: 7, spellId: 28540, startTime: 10_000, endTime: 50_000 });
    expect(body.data.drumCasts).toEqual([
      { fightId: 2, sourceId: 7, spellId: 35476, timestamp: 19_900 }]);
    expect(body.data.drumApplications).toEqual([
      { fightId: 2, sourceId: 7, targetId: 9, spellId: 35476, timestamp: 20_000 }]);
    // events were requested with non-empty tracked ability id lists
    expect(fetchBuffEvents.mock.calls[0]![2].length).toBeGreaterThan(0);
    expect(fetchCastEvents.mock.calls[0]![2].length).toBeGreaterThan(0);
    // suboptimal-only buffs (not in consumableBuffs) must be tracked too,
    // or suboptimal detection is dead in production (final-review finding)
    const tracked = fetchBuffEvents.mock.calls[0]![2] as number[];
    expect(tracked).toContain(3166); // Elixir of Wisdom — suboptimal list only
  });

  it("serves the report with empty buffs when event fetching fails (best-effort)", async () => {
    const fetchItemMeta = vi.fn().mockResolvedValue({ "24266": { name: "Spellstrike Hood", quality: 4 } });
    const app = makeApp({
      fetchRawReport: vi.fn().mockResolvedValue(rawWithBoss),
      fetchCombatantInfo: vi.fn().mockResolvedValue([
        { sourceID: 7, fight: 2, gear: [{ id: 24266, slot: 0 }] },
      ]),
      fetchItemMeta,
      fetchBuffEvents: vi.fn().mockRejectedValue(new WclError(502, "boom")),
    });
    const res = await app.request("/api/report/a1B2c3D4e5F6g7H8", { headers: { Authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.buffs).toEqual([]);
    expect(body.data.drumCasts).toEqual([]);
    expect(body.data.drumApplications).toEqual([]);
    // independent fetches are individually best-effort: gear that was
    // successfully fetched survives a buff-event failure
    expect(body.data.gear).toHaveLength(1);
    expect(body.data.itemMeta["24266"]?.name).toBe("Spellstrike Hood");
  });
});

describe("GET /api/report/:id — npc kills", () => {
  const rawWithNpcs: RawReport = {
    ...raw,
    fights: [
      { id: 1, name: "Trash Pack", encounterID: 0, kill: null, startTime: 0, endTime: 100, friendlyPlayers: [10] },
    ],
    masterData: {
      actors: [{ id: 10, name: "Tank", subType: "Warrior" }],
      npcs: [{ id: 50, gameID: 25507 }],
    },
  };

  it("populates npcKills from fetchDeaths events", async () => {
    const app = makeApp({
      fetchRawReport: vi.fn().mockResolvedValue(rawWithNpcs),
      fetchDeaths: vi.fn().mockResolvedValue([
        { timestamp: 40, type: "death", targetID: 50, fight: 1 },
      ]),
    });
    const res = await app.request("/api/report/a1B2c3D4e5F6g7H8", { headers: { Authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.npcKills).toEqual({ "25507": 1 });
  });

  it("serves the report with undefined npcKills when fetchDeaths fails (best-effort)", async () => {
    const app = makeApp({
      fetchRawReport: vi.fn().mockResolvedValue(rawWithNpcs),
      fetchDeaths: vi.fn().mockRejectedValue(new WclError(502, "boom")),
    });
    const res = await app.request("/api/report/a1B2c3D4e5F6g7H8", { headers: { Authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.npcKills).toBeUndefined();
  });
});
