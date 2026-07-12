import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { createMemoryShareStore, type ShareStore } from "./shareStore";

// The stored blob is a gzipped ReportData JSON. A full raid report serializes to
// tens of MB — past Cloudflare KV's 25 MiB per-value ceiling — so the browser
// compresses it before upload (~10x on JSON). On Cloudflare's free tier a Worker
// gets ~10 ms CPU, nowhere near enough to decompress/parse a multi-MB report, so
// this endpoint is a pure pass-through: it checks the gzip magic bytes and hands
// the opaque bytes to the store. Shape/credential validation happens client-side
// before compression (see apps/web/src/lib/share.ts).
const DEFAULT_MAX_BODY_BYTES = 24 * 1024 * 1024;

export interface AppOptions {
  /** Reject /api/share bodies larger than this (bytes). Defaults to 24 MB
   *  (just under KV's 25 MiB per-value limit). */
  maxBodyBytes?: number;
  /** Restrict CORS to this exact web origin. Unset → "*" (dev only). */
  corsOrigin?: string;
}

// gzip streams start with the magic bytes 0x1f 0x8b. Cheap O(1) guard so the open
// endpoint isn't trivially usable as arbitrary-blob hosting of non-gzip data.
function isGzip(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 2) return false;
  const head = new Uint8Array(buf, 0, 2);
  return head[0] === 0x1f && head[1] === 0x8b;
}

// Tiny snapshot store: the only thing this backend holds. Snapshots are
// key-free, gzip-compressed ReportData published deliberately by a user; viewing
// one needs no WCL key. No live WCL fetching happens here (that's browser-side).
export function createApp(store: ShareStore = createMemoryShareStore(), opts: AppOptions = {}) {
  const maxSize = opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const app = new Hono();
  // Restrict to the deployed web origin when known; "*" is acceptable only because
  // the store holds public, key-free data with no cookies — but lock it down anyway.
  app.use("/api/*", cors({ origin: opts.corsOrigin ?? "*" }));

  app.post("/api/share", bodyLimit({ maxSize }), async (c) => {
    const raw = await c.req.arrayBuffer();
    if (!isGzip(raw)) return c.json({ error: "Expected a gzip-compressed body" }, 400);
    return c.json({ shareId: await store.put(new Uint8Array(raw)) });
  });

  app.get("/api/share/:shareId", async (c) => {
    const bytes = await store.get(c.req.param("shareId"));
    if (!bytes) return c.json({ error: "Snapshot not found" }, 404);
    // Served as-is; the browser decompresses (see fetchSnapshot).
    return c.body(bytes.buffer as ArrayBuffer, 200, { "Content-Type": "application/gzip" });
  });

  return app;
}
