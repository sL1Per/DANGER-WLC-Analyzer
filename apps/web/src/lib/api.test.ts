import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION } from "@wcl/core";
import { deleteCachedReport } from "./reportCache";
import { saveCredentials } from "./storage";

vi.mock("./wcl/loadReport", () => ({
  loadReport: vi.fn().mockResolvedValue({ reportId: "abc", title: "T5", schemaVersion: SCHEMA_VERSION }),
}));

import { fetchReport, refreshReport, ApiError } from "./api";
import { loadReport } from "./wcl/loadReport";

beforeEach(async () => {
  localStorage.clear();
  await deleteCachedReport("abc");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchReport", () => {
  it("throws a needsKey ApiError when no credentials are stored", async () => {
    await expect(fetchReport("abc")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchReport("abc")).rejects.toMatchObject({ needsKey: true });
  });

  it("exchanges credentials for a token directly with WCL, then loads + caches", async () => {
    saveCredentials({ clientId: "id", clientSecret: "secret" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 86400 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchReport("abc");
    expect(res.data.reportId).toBe("abc");
    expect(res.stale).toBe(false);
    // token exchanged against WCL directly (not our backend)
    expect(fetchMock.mock.calls[0]![0]).toBe("https://www.warcraftlogs.com/oauth/token");
    expect(loadReport).toHaveBeenCalledWith("abc", "tok");

    // second call serves from the browser cache without re-loading
    (loadReport as ReturnType<typeof vi.fn>).mockClear();
    const cached = await fetchReport("abc");
    expect(cached.data.reportId).toBe("abc");
    expect(loadReport).not.toHaveBeenCalled();
  });

  it("refreshReport clears the cache and re-loads", async () => {
    saveCredentials({ clientId: "id", clientSecret: "secret" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 86400 }), { status: 200 })));
    await fetchReport("abc");
    (loadReport as ReturnType<typeof vi.fn>).mockClear();
    await refreshReport("abc");
    expect(loadReport).toHaveBeenCalledTimes(1);
  });
});
