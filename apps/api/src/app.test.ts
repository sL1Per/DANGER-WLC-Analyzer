import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { WclError, type RawReport } from "./wcl";

const raw: RawReport = {
  title: "T5 fun", startTime: 1, endTime: 2, zone: { name: "Karazhan" },
  fights: [], masterData: { actors: [] },
};

function makeApp(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  return createApp({
    fetchToken: vi.fn().mockResolvedValue({ accessToken: "tok", expiresIn: 86400 }),
    fetchRawReport: vi.fn().mockResolvedValue(raw),
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
