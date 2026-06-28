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
    // Assert body is serialized correctly
    expect(JSON.parse((mock.mock.calls[0]![1] as RequestInit).body as string)).toEqual(data);
  });

  it("publishSnapshot rejects with the response status on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Server Error", { status: 500 })));
    await expect(publishSnapshot(data)).rejects.toMatchObject({ status: 500 });
  });

  it("fetchSnapshot GETs the snapshot", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    expect((await fetchSnapshot("xyz123")).reportId).toBe("abc");
    // Assert exact URL so a path typo cannot pass silently
    expect(mock.mock.calls[0]![0]).toBe("/api/share/xyz123");
  });

  it("fetchSnapshot throws on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    await expect(fetchSnapshot("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("shareUrl builds an absolute /s/ link", () => {
    vi.stubGlobal("location", { origin: "https://example.com" });
    expect(shareUrl("xyz123")).toBe("https://example.com/s/xyz123");
  });
});
