import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { createMemoryShareStore, type ShareStore } from "./shareStore";
import type { IngestStore } from "./ingestStore";

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
  /** Bearer token the auto-ingest job must send to /api/ingest/*. Unset → those
   *  routes answer 503, so the state store is never open by default. */
  ingestToken?: string;
  ingestStore?: IngestStore;
}

const MAX_INGEST_STATE_BYTES = 64 * 1024;

// Constant-time comparison so the token can't be guessed byte-by-byte from
// response timing. (crypto.subtle.timingSafeEqual is Workers-only.)
function tokenMatches(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i]!;
  return diff === 0;
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

  // State for the scheduled auto-ingest job (apps/web/scripts/autoIngest.ts):
  // which guild reports it has already posted. Called server-to-server only,
  // so no CORS beyond the default; guarded by a shared bearer token.
  app.use("/api/ingest/*", async (c, next) => {
    if (!opts.ingestToken || !opts.ingestStore) return c.json({ error: "Auto-ingest is not configured" }, 503);
    const auth = c.req.header("Authorization") ?? "";
    if (!auth.startsWith("Bearer ") || !tokenMatches(auth.slice(7), opts.ingestToken)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  app.get("/api/ingest/state", async (c) => {
    const json = await opts.ingestStore!.get();
    return c.body(json ?? "null", 200, { "Content-Type": "application/json" });
  });

  app.put("/api/ingest/state", bodyLimit({ maxSize: MAX_INGEST_STATE_BYTES }), async (c) => {
    const text = await c.req.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = undefined; }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return c.json({ error: "Expected a JSON object" }, 400);
    }
    await opts.ingestStore!.put(text);
    return c.json({ ok: true });
  });

  return app;
}
