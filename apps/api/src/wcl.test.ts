import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchToken, fetchRawReport, WclError } from "./wcl";

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
});
