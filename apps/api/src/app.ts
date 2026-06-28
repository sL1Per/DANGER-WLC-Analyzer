import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ReportData } from "@wcl/core";
import { createMemoryShareStore, type ShareStore } from "./shareStore";

// Defensive strip at the publish boundary: a published snapshot is shared
// key-free, so never persist credential-like fields even if a caller's
// ReportData somehow carried them.
function stripCredentials(data: ReportData): ReportData {
  const { clientId, clientSecret, accessToken, ...rest } = data as unknown as Record<string, unknown>;
  void clientId; void clientSecret; void accessToken;
  return rest as unknown as ReportData;
}

// Tiny snapshot store: the only thing this backend holds. Snapshots are
// key-free ReportData published deliberately by a user; viewing one needs no
// WCL key. No live WCL fetching happens here anymore (that's browser-side).
export function createApp(store: ShareStore = createMemoryShareStore()) {
  const app = new Hono();
  app.use("/api/*", cors());

  app.post("/api/share", async (c) => {
    let data: ReportData;
    try {
      data = await c.req.json<ReportData>();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    if (!data || typeof data.reportId !== "string") return c.json({ error: "Invalid report payload" }, 400);
    return c.json({ shareId: await store.put(stripCredentials(data)) });
  });

  app.get("/api/share/:shareId", async (c) => {
    const data = await store.get(c.req.param("shareId"));
    if (!data) return c.json({ error: "Snapshot not found" }, 404);
    return c.json(data);
  });

  return app;
}
