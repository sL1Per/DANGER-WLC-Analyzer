import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchToken, fetchRawReport, WclError, fetchCombatantInfo, fetchItemMeta, fetchBuffEvents, fetchCastEvents, fetchInterrupts, fetchAllCasts, fetchEnemyDebuffs } from "./wcl";

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

describe("fetchBuffEvents", () => {
  const page = (events: unknown[], next: number | null) =>
    new Response(JSON.stringify({ data: { reportData: { report: { events: { data: events, nextPageTimestamp: next } } } } }), { status: 200 });

  it("collects apply/remove/refresh buff events across pages and filters by ability", async () => {
    const e1 = { type: "applybuff", sourceID: 1, targetID: 1, abilityGameID: 28497, fight: 3, timestamp: 100 };
    const e2 = { type: "removebuff", sourceID: 1, targetID: 1, abilityGameID: 28497, fight: 3, timestamp: 200 };
    const e3 = { type: "refreshbuff", sourceID: 2, targetID: 2, abilityGameID: 35476, fight: 3, timestamp: 300 };
    const junk1 = { type: "applybuffstack", sourceID: 1, targetID: 1, abilityGameID: 28497, fight: 3, timestamp: 150 };
    const junk2 = { type: "cast", sourceID: 1, abilityGameID: 28497, fight: 3, timestamp: 160 };
    const mock = vi.fn()
      .mockResolvedValueOnce(page([e1, junk1, junk2], 12345))
      .mockResolvedValueOnce(page([e2, e3], null));
    vi.stubGlobal("fetch", mock);
    const events = await fetchBuffEvents("a1B2c3D4e5F6g7H8", "tok", [28497, 35476]);
    expect(events).toEqual([e1, e2, e3]);
    expect(mock).toHaveBeenCalledTimes(2);
    const body1 = JSON.parse(mock.mock.calls[0]![1]!.body as string);
    // dataType wired either via variable or inline
    if (/dataType:\s*\$dataType/.test(body1.query)) {
      expect(body1.variables.dataType).toBe("Buffs");
    } else {
      expect(body1.query).toContain("dataType: Buffs");
    }
    expect(body1.variables.filter).toContain("ability.id IN (28497, 35476)");
    const vars2 = JSON.parse(mock.mock.calls[1]![1]!.body as string).variables;
    expect(vars2.start).toBe(12345);
  });

  it("returns [] without calling fetch when no ability ids are given", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    const events = await fetchBuffEvents("a1B2c3D4e5F6g7H8", "tok", []);
    expect(events).toEqual([]);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("fetchCastEvents", () => {
  const page = (events: unknown[], next: number | null) =>
    new Response(JSON.stringify({ data: { reportData: { report: { events: { data: events, nextPageTimestamp: next } } } } }), { status: 200 });

  it("keeps only cast events, uses Casts dataType and paginates via nextPageTimestamp", async () => {
    const c1 = { type: "cast", sourceID: 5, abilityGameID: 35476, fight: 2, timestamp: 50 };
    const c2 = { type: "cast", sourceID: 6, abilityGameID: 35476, fight: 2, timestamp: 90 };
    const junk = { type: "begincast", sourceID: 5, abilityGameID: 35476, fight: 2, timestamp: 40 };
    const mock = vi.fn()
      .mockResolvedValueOnce(page([junk, c1], 777))
      .mockResolvedValueOnce(page([c2], null));
    vi.stubGlobal("fetch", mock);
    const events = await fetchCastEvents("a1B2c3D4e5F6g7H8", "tok", [35476]);
    expect(events).toEqual([c1, c2]);
    expect(mock).toHaveBeenCalledTimes(2);
    const body1 = JSON.parse(mock.mock.calls[0]![1]!.body as string);
    if (/dataType:\s*\$dataType/.test(body1.query)) {
      expect(body1.variables.dataType).toBe("Casts");
    } else {
      expect(body1.query).toContain("dataType: Casts");
    }
    expect(body1.variables.filter).toContain("ability.id IN (35476)");
    const vars2 = JSON.parse(mock.mock.calls[1]![1]!.body as string).variables;
    expect(vars2.start).toBe(777);
  });

  it("returns [] without calling fetch when no ability ids are given", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    const events = await fetchCastEvents("a1B2c3D4e5F6g7H8", "tok", []);
    expect(events).toEqual([]);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("fetchItemMeta", () => {
  it("batches ids into one aliased gameData query (names only — WCL has no quality field)", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { gameData: {
        i0: { id: 24266, name: "Spellstrike Hood" },
        i1: { id: 31867, name: "Great Golden Draenite" },
        i2: null,
      } },
    }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const meta = await fetchItemMeta([24266, 31867, 99999], "tok");
    expect(meta["24266"]).toEqual({ name: "Spellstrike Hood" });
    expect(meta["99999"]).toBeUndefined();
    expect(mock).toHaveBeenCalledTimes(1);
    // the query must not request `quality` — GameItem doesn't expose it
    expect(String(mock.mock.calls[0]![1]!.body)).not.toMatch(/quality/);
  });
});

describe("fetchInterrupts", () => {
  const page = (events: unknown[], next: number | null) =>
    new Response(JSON.stringify({ data: { reportData: { report: { events: { data: events, nextPageTimestamp: next } } } } }), { status: 200 });

  it("keeps only interrupt events and stops paging", async () => {
    const interrupt = { type: "interrupt", sourceID: 5, targetID: 1, abilityGameID: 1, extraAbilityGameID: 12471, fight: 3, timestamp: 1 };
    const cast = { type: "cast", sourceID: 1, abilityGameID: 2, fight: 3, timestamp: 2 };
    const mock = vi.fn().mockResolvedValue(page([interrupt, cast], null));
    vi.stubGlobal("fetch", mock);
    const out = await fetchInterrupts("abc", "tok");
    expect(out).toHaveLength(1);
    expect(out[0]!.extraAbilityGameID).toBe(12471);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("pages until nextPageTimestamp is null", async () => {
    const i1 = { type: "interrupt", sourceID: 1, targetID: 2, abilityGameID: 3, fight: 1, timestamp: 10 };
    const i2 = { type: "interrupt", sourceID: 2, targetID: 3, abilityGameID: 4, fight: 1, timestamp: 20 };
    const mock = vi.fn()
      .mockResolvedValueOnce(page([i1], 9999))
      .mockResolvedValueOnce(page([i2], null));
    vi.stubGlobal("fetch", mock);
    const out = await fetchInterrupts("abc", "tok");
    expect(out).toHaveLength(2);
    expect(mock).toHaveBeenCalledTimes(2);
    const vars2 = JSON.parse((mock.mock.calls[1]![1]!.body as string)).variables;
    expect(vars2.start).toBe(9999);
  });
});

describe("fetchAllCasts — fightIds scoping", () => {
  it("scopes fetchAllCasts to the given boss fight ids", async () => {
    const calls: any[] = [];
    const fakeFetch = vi.fn(async (_url: string, init: any) => {
      calls.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ data: { reportData: { report: { events: { data: [], nextPageTimestamp: null } } } } }) } as any;
    });
    vi.stubGlobal("fetch", fakeFetch);
    await fetchAllCasts("RPT", "tok", [11, 22]);
    expect(calls[0].variables.fightIds).toEqual([11, 22]);
    vi.unstubAllGlobals();
  });
});

describe("fetchEnemyDebuffs", () => {
  it("fetchEnemyDebuffs keeps debuff apply/remove/refresh and scopes to fights", async () => {
    const calls: any[] = [];
    const fakeFetch = vi.fn(async (_url: string, init: any) => {
      calls.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ data: { reportData: { report: { events: {
        data: [
          { type: "applydebuff", sourceID: 1, targetID: 9, abilityGameID: 27228, timestamp: 100, fight: 5 },
          { type: "cast", sourceID: 1, targetID: 9, abilityGameID: 1, timestamp: 100, fight: 5 },
        ], nextPageTimestamp: null } } } } }) } as any;
    });
    vi.stubGlobal("fetch", fakeFetch);
    const out = await fetchEnemyDebuffs("RPT", "tok", [5]);
    expect(out.map((e) => e.type)).toEqual(["applydebuff"]);
    expect(calls[0].variables.fightIds).toEqual([5]);
    // must query enemy-side debuffs (debuffs players apply to bosses); without this WCL
    // defaults to Friendlies and returns debuffs ON players → enemy-debuff uptime ~0.
    expect(calls[0].variables.hostilityType).toBe("Enemies");
    vi.unstubAllGlobals();
  });
});

describe("fetchRankings", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the rankings data array from the JSON field", async () => {
    const entry = {
      encounter: { id: 623, name: "Hydross the Unstable" },
      fightID: 3,
      roles: {
        tanks: { characters: [{ name: "Tankone", class: "Warrior", spec: "Protection", rankPercent: 64.2, bracketPercent: 70.1 }] },
        healers: { characters: [] },
        dps: { characters: [{ name: "Dpsone", class: "Mage", spec: "Fire", rankPercent: 95.8, bracketPercent: 88.4 }] },
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { reportData: { report: { rankings: { data: [entry] } } } } })),
    );
    const { fetchRankings } = await import("./wcl");
    const result = await fetchRankings("abc", "tok");
    expect(result).toHaveLength(1);
    expect(result[0]!.fightID).toBe(3);
    expect(result[0]!.roles?.dps?.characters?.[0]!.name).toBe("Dpsone");
  });

  it("returns [] when rankings is null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { reportData: { report: { rankings: null } } } })),
    );
    const { fetchRankings } = await import("./wcl");
    expect(await fetchRankings("abc", "tok")).toEqual([]);
  });
});
