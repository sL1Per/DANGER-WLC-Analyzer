import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ReportData } from "@wcl/core";
import { createMemoryShareStore, type ShareStore } from "./shareStore";

// Tiny snapshot store: the only thing this backend holds. Snapshots are
// key-free ReportData published deliberately by a user; viewing one needs no
// WCL key. No live WCL fetching happens here anymore (that's browser-side).
export function createApp(store: ShareStore = createMemoryShareStore()) {
  const app = new Hono();
  app.use("/api/*", cors());

  app.post("/api/share", async (c) => {
    const data = await c.req.json<ReportData>();
    if (!data || typeof data.reportId !== "string") return c.json({ error: "Invalid report payload" }, 400);
    return c.json({ shareId: await store.put(data) });
  });

  app.get("/api/share/:shareId", async (c) => {
    const data = await store.get(c.req.param("shareId"));
    if (!data) return c.json({ error: "Snapshot not found" }, 404);
    return c.json(data);
  });

  return app;
}
