import { afterEach, describe, expect, it, vi } from "vitest";
import { publishSnapshot, fetchSnapshot, shareUrl } from "./share";
import type { ReportData } from "@wcl/core";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const data = { reportId: "abc", players: [], fights: [] } as unknown as ReportData;

// Mirror the client's gzip so tests can inspect what was uploaded / serve a
// snapshot. Uses Web Streams directly (jsdom's Blob has no .stream()).
async function pump(
  input: Uint8Array,
  transform: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> },
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = transform.writable.getWriter();
  void writer.write(input as BufferSource);
  void writer.close();
  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}
async function gzip(value: unknown): Promise<Uint8Array<ArrayBuffer>> {
  return pump(new TextEncoder().encode(JSON.stringify(value)), new CompressionStream("gzip"));
}
async function gunzip(body: BodyInit): Promise<unknown> {
  const buf = await new Response(body as BodyInit).arrayBuffer();
  const out = await pump(new Uint8Array(buf), new DecompressionStream("gzip"));
  return JSON.parse(new TextDecoder().decode(out));
}

describe("share client", () => {
  it("publishSnapshot gzips the report, POSTs it, and returns the shareId", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ shareId: "xyz123" }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    expect(await publishSnapshot(data)).toBe("xyz123");
    const [url, init] = mock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/share");
    expect(init.method).toBe("POST");
    // Body is gzip that decompresses back to the report.
    expect(await gunzip(init.body as BodyInit)).toEqual(data);
  });

  it("publishSnapshot strips credential fields before upload", async () => {
    // The API stores opaque bytes and can't strip — so the client must.
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ shareId: "x" }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const withCreds = { ...data, clientId: "id", clientSecret: "s", accessToken: "t" } as unknown as ReportData;
    await publishSnapshot(withCreds);
    const sent = await gunzip((mock.mock.calls[0]![1] as RequestInit).body as BodyInit) as Record<string, unknown>;
    expect(sent).not.toHaveProperty("clientId");
    expect(sent).not.toHaveProperty("clientSecret");
    expect(sent).not.toHaveProperty("accessToken");
    expect(sent.reportId).toBe("abc"); // legitimate fields survive
  });

  it("publishSnapshot rejects with the response status on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Server Error", { status: 500 })));
    await expect(publishSnapshot(data)).rejects.toMatchObject({ status: 500 });
  });

  it("fetchSnapshot GETs and decompresses the snapshot", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(await gzip(data), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    expect((await fetchSnapshot("xyz123")).reportId).toBe("abc");
    // Assert exact URL so a path typo cannot pass silently
    expect(mock.mock.calls[0]![0]).toBe("/api/share/xyz123");
  });

  it("fetchSnapshot throws on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    await expect(fetchSnapshot("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("strips a trailing slash from VITE_API_BASE so paths don't become //api/... (misses CORS)", async () => {
    vi.stubEnv("VITE_API_BASE", "https://api.example.com/");
    vi.resetModules(); // API_BASE is computed at module load — re-import to pick up the stubbed env
    const { publishSnapshot: publish } = await import("./share");
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ shareId: "x" }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    await publish(data);
    expect(mock.mock.calls[0]![0]).toBe("https://api.example.com/api/share");
  });

  it("shareUrl builds an absolute /s/ link", () => {
    vi.stubGlobal("location", { origin: "https://example.com" });
    expect(shareUrl("xyz123")).toBe("https://example.com/s/xyz123");
  });
});
