import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { ReportData } from "@wcl/core";
import { createMemoryShareStore, type ShareStore } from "./shareStore";

const DEFAULT_MAX_BODY_BYTES = 512 * 1024;

export interface AppOptions {
  /** Reject /api/share bodies larger than this (bytes). Defaults to 512 KB. */
  maxBodyBytes?: number;
}

// Defensive strip at the publish boundary: a published snapshot is shared
// key-free, so never persist credential-like fields even if a caller's
// ReportData somehow carried them.
function stripCredentials(data: ReportData): ReportData {
  const { clientId, clientSecret, accessToken, ...rest } = data as unknown as Record<string, unknown>;
  void clientId; void clientSecret; void accessToken;
  return rest as unknown as ReportData;
}

// A published snapshot is always a normalized report: it must at minimum carry a
// string reportId plus the fights/players arrays the viewer renders. Enforcing
// the shape stops the open endpoint being abused as arbitrary-JSON hosting.
function isReportShape(data: unknown): data is ReportData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.reportId === "string" && Array.isArray(d.fights) && Array.isArray(d.players);
}

// Tiny snapshot store: the only thing this backend holds. Snapshots are
// key-free ReportData published deliberately by a user; viewing one needs no
// WCL key. No live WCL fetching happens here anymore (that's browser-side).
export function createApp(store: ShareStore = createMemoryShareStore(), opts: AppOptions = {}) {
  const maxSize = opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const app = new Hono();
  app.use("/api/*", cors());

  app.post("/api/share", bodyLimit({ maxSize }), async (c) => {
    let data: unknown;
    try {
      data = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    if (!isReportShape(data)) return c.json({ error: "Invalid report payload" }, 400);
    return c.json({ shareId: await store.put(stripCredentials(data)) });
  });

  app.get("/api/share/:shareId", async (c) => {
    const data = await store.get(c.req.param("shareId"));
    if (!data) return c.json({ error: "Snapshot not found" }, 404);
    return c.json(data);
  });

  return app;
}
