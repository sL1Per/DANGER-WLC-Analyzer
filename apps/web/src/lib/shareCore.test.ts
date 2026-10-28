import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReportData } from "@wcl/core";
import { publishSnapshotTo, shareUrlFor } from "./shareCore";

afterEach(() => vi.unstubAllGlobals());
const data = { reportId: "abc", players: [], fights: [] } as unknown as ReportData;

describe("shareCore (Node-safe publishing for the auto-ingest job)", () => {
  it("publishSnapshotTo POSTs to an explicit API base, ignoring a trailing slash", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ shareId: "s1" }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    expect(await publishSnapshotTo("https://api.example.com/", data)).toBe("s1");
    expect(mock.mock.calls[0]![0]).toBe("https://api.example.com/api/share");
  });
  it("publishSnapshotTo rejects with the HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 413 })));
    await expect(publishSnapshotTo("https://api.example.com", data)).rejects.toMatchObject({ status: 413 });
  });
  it("shareUrlFor builds an absolute /s/ link from an explicit origin", () => {
    expect(shareUrlFor("https://web.example.com/", "s1")).toBe("https://web.example.com/s/s1");
  });
});
