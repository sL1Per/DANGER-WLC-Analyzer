import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createMemoryShareStore } from "./shareStore";

// The API stores/serves opaque gzip blobs; compress/decompress here to mirror
// what the browser client does around it.
async function gzip(value: unknown): Promise<ArrayBuffer> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).arrayBuffer();
}
async function gunzip(buf: ArrayBuffer): Promise<unknown> {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

const report = { reportId: "abc", title: "T5", players: [], fights: [] };

describe("share endpoints", () => {
  it("POST stores a gzip snapshot and returns a shareId; GET serves the bytes back", async () => {
    const app = createApp(createMemoryShareStore());
    const post = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/gzip" }, body: await gzip(report),
    });
    expect(post.status).toBe(200);
    const { shareId } = await post.json();
    expect(typeof shareId).toBe("string");

    const get = await app.request(`/api/share/${shareId}`);
    expect(get.status).toBe(200);
    expect(get.headers.get("content-type")).toContain("application/gzip");
    // Round-trips: the served bytes decompress back to the original report.
    expect((await gunzip(await get.arrayBuffer()) as { reportId: string }).reportId).toBe("abc");
  });

  it("GET unknown shareId returns 404", async () => {
    const app = createApp(createMemoryShareStore());
    expect((await app.request("/api/share/missing")).status).toBe(404);
  });

  it("POST rejects a non-gzip (uncompressed) body with 400", async () => {
    // Guards the open endpoint against being used to host arbitrary non-gzip data.
    const app = createApp(createMemoryShareStore());
    const res = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/gzip/i);
  });

  it("POST rejects bodies over the size limit with 413", async () => {
    const app = createApp(createMemoryShareStore(), { maxBodyBytes: 8 });
    const res = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/gzip" }, body: await gzip(report),
    });
    expect(res.status).toBe(413);
  });

  it("allows any origin by default (dev, no corsOrigin configured)", async () => {
    const app = createApp(createMemoryShareStore());
    const res = await app.request("/api/share/x", { headers: { Origin: "https://evil.example" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("restricts CORS to the configured web origin when corsOrigin is set", async () => {
    const app = createApp(createMemoryShareStore(), { corsOrigin: "https://app.example" });
    // A disallowed origin gets no allow-origin header at all (browser blocks it)...
    const evil = await app.request("/api/share/x", { headers: { Origin: "https://evil.example" } });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
    // ...while the configured origin is echoed back.
    const ok = await app.request("/api/share/x", { headers: { Origin: "https://app.example" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://app.example");
  });
});
