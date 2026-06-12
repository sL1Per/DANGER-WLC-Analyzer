import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchToken, fetchRawReport, WclError, fetchCombatantInfo, fetchItemMeta } from "./wcl";

afterEach(() => vi.unstubAllGlobals());

describe("fetchToken", () => {
  it("posts client_credentials with basic auth and returns the token", async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 86400 }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const token = await fetchToken("myid", "mysecret");
    expect(token).toEqual({ accessToken: "tok", expiresIn: 86400 });
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe("https://www.warcraftlogs.com/oauth/token");
    expect((init!.headers as Record<string,string>).Authorization).toBe("Basic " + Buffer.from("myid:mysecret").toString("base64"));
    expect(init!.body!.toString()).toContain("grant_type=client_credentials");
  });
  it("throws WclError(401) on bad credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    await expect(fetchToken("bad", "creds")).rejects.toMatchObject({ status: 401 });
  });
});

describe("fetchRawReport", () => {
  it("queries the classic v2 endpoint with bearer token", async () => {
    const report = { title: "T5 fun" };
    const mock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { reportData: { report } } }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const raw = await fetchRawReport("a1B2c3D4e5F6g7H8", "tok");
    expect(raw).toEqual(report);
    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe("https://classic.warcraftlogs.com/api/v2/client");
    expect((init!.headers as Record<string,string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init!.body! as string).variables.code).toBe("a1B2c3D4e5F6g7H8");
    // friendlyPlayers is needed to filter out logged bystanders (see normalize)
    expect(JSON.parse(init!.body! as string).query).toContain("friendlyPlayers");
  });
  it("throws WclError(404) when the report is null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { reportData: { report: null } } }), { status: 200 })));
    await expect(fetchRawReport("a1B2c3D4e5F6g7H8", "tok")).rejects.toMatchObject({ status: 404 });
  });
  it("throws WclError(429) on rate limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("limit", { status: 429 })));
    await expect(fetchRawReport("a1B2c3D4e5F6g7H8", "tok")).rejects.toMatchObject({ status: 429 });
  });
  it("throws WclError(502) on GraphQL-level errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: null, errors: [{ message: "Query cost limit exceeded" }] }), { status: 200 })));
    await expect(fetchRawReport("a1B2c3D4e5F6g7H8", "tok")).rejects.toMatchObject({ status: 502 });
  });
});

describe("fetchCombatantInfo", () => {
  const page = (events: unknown[], next: number | null) =>
    new Response(JSON.stringify({ data: { reportData: { report: { events: { data: events, nextPageTimestamp: next } } } } }), { status: 200 });

  it("collects combatantinfo events across pages", async () => {
    const e1 = { type: "combatantinfo", sourceID: 7, fight: 3, gear: [] };
    const e2 = { type: "combatantinfo", sourceID: 8, fight: 3, gear: [] };
    const mock = vi.fn()
      .mockResolvedValueOnce(page([e1], 12345))
      .mockResolvedValueOnce(page([e2], null));
    vi.stubGlobal("fetch", mock);
    const events = await fetchCombatantInfo("a1B2c3D4e5F6g7H8", "tok", [3, 5]);
    expect(events).toHaveLength(2);
    expect(mock).toHaveBeenCalledTimes(2);
    const vars2 = JSON.parse((mock.mock.calls[1]![1]!.body as string)).variables;
    expect(vars2.start).toBe(12345);
    expect(vars2.fightIds).toEqual([3, 5]);
  });
  it("filters out non-combatantinfo events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      page([{ type: "damage", sourceID: 1 }, { type: "combatantinfo", sourceID: 7, fight: 3, gear: [] }], null)));
    const events = await fetchCombatantInfo("a1B2c3D4e5F6g7H8", "tok", [3]);
    expect(events).toHaveLength(1);
  });
});

describe("fetchItemMeta", () => {
  it("batches ids into one aliased gameData query", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { gameData: {
        i0: { id: 24266, name: "Spellstrike Hood", quality: 4 },
        i1: { id: 31867, name: "Great Golden Draenite", quality: 2 },
        i2: null,
      } },
    }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const meta = await fetchItemMeta([24266, 31867, 99999], "tok");
    expect(meta["24266"]).toEqual({ name: "Spellstrike Hood", quality: 4 });
    expect(meta["99999"]).toBeUndefined();
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("retries without the quality field if WCL rejects it", async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: 'Cannot query field "quality"' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { gameData: { i0: { id: 24266, name: "Spellstrike Hood" } } } }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const meta = await fetchItemMeta([24266], "tok");
    expect(meta["24266"]).toEqual({ name: "Spellstrike Hood", quality: undefined });
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
