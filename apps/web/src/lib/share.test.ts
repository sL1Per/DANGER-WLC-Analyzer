import { afterEach, describe, expect, it, vi } from "vitest";
import { publishSnapshot, fetchSnapshot, shareUrl } from "./share";
import type { ReportData } from "@wcl/core";

afterEach(() => vi.unstubAllGlobals());
const data = { reportId: "abc" } as unknown as ReportData;

describe("share client", () => {
  it("publishSnapshot POSTs to /api/share and returns the shareId", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ shareId: "xyz123" }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    expect(await publishSnapshot(data)).toBe("xyz123");
    expect(mock.mock.calls[0]![0]).toBe("/api/share");
    expect((mock.mock.calls[0]![1] as RequestInit).method).toBe("POST");
  });

  it("fetchSnapshot GETs the snapshot", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 })));
    expect((await fetchSnapshot("xyz123")).reportId).toBe("abc");
  });

  it("fetchSnapshot throws on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    await expect(fetchSnapshot("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("shareUrl builds an absolute /s/ link", () => {
    expect(shareUrl("xyz123")).toMatch(/\/s\/xyz123$/);
  });
});
