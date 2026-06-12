import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { WclError, type RawCombatantInfo, type RawReport } from "./wcl";

const raw: RawReport = {
  title: "T5 fun", startTime: 1, endTime: 2, zone: { name: "Karazhan" },
  fights: [], masterData: { actors: [] },
};

function makeApp(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  return createApp({
    fetchToken: vi.fn().mockResolvedValue({ accessToken: "tok", expiresIn: 86400 }),
    fetchRawReport: vi.fn().mockResolvedValue(raw),
    fetchCombatantInfo: vi.fn().mockResolvedValue([]),
    fetchItemMeta: vi.fn().mockResolvedValue({}),
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
