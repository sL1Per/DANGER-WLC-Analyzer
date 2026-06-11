import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import type { ReportData } from "@wcl/core";
import { TtlCache } from "./cache";
import { normalizeReport } from "./normalize";
import { WclError, fetchRawReport as realFetchRawReport, fetchToken as realFetchToken } from "./wcl";

export interface AppDeps {
  fetchToken: typeof realFetchToken;
  fetchRawReport: typeof realFetchRawReport;
  cacheTtlMs: number;
}

const REPORT_ID_RE = /^[a-zA-Z0-9]{16}$/;

export function createApp(deps: AppDeps = {
  fetchToken: realFetchToken,
  fetchRawReport: realFetchRawReport,
  cacheTtlMs: 24 * 60 * 60 * 1000,
}) {
  const cache = new TtlCache<ReportData>(deps.cacheTtlMs);
  const app = new Hono();
  app.use("/api/*", cors());

  app.post("/api/token", async (c) => {
    const { clientId, clientSecret } = await c.req.json<{ clientId?: string; clientSecret?: string }>();
    if (!clientId || !clientSecret) return c.json({ error: "clientId and clientSecret required" }, 400);
    try {
      return c.json(await deps.fetchToken(clientId, clientSecret));
    } catch (e) {
      return toErrorResponse(c, e);
    }
  });

  app.get("/api/report/:id", async (c) => {
    const id = c.req.param("id");
    if (!REPORT_ID_RE.test(id)) return c.json({ error: "Malformed report id" }, 400);

    const cached = cache.get(id);
    if (cached) return c.json({ data: cached.value, cachedAt: cached.cachedAt });

    const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
    if (!token) {
      return c.json({
        needsKey: true,
        error: "Report not cached yet. Load it once with WCL credentials (Settings page).",
      }, 401);
    }
    try {
      const data = normalizeReport(id, await deps.fetchRawReport(id, token));
      cache.set(id, data);
      return c.json({ data, cachedAt: Date.now() });
    } catch (e) {
      return toErrorResponse(c, e);
    }
  });

  app.delete("/api/report/:id", (c) => {
    cache.delete(c.req.param("id"));
    return c.json({ ok: true });
  });

  return app;
}

function toErrorResponse(c: Context, e: unknown) {
  if (e instanceof WclError) {
    const friendly: Record<number, string> = {
      401: "WCL rejected the credentials. Check your client ID and secret.",
      429: "WCL rate limit reached. Wait for your hourly points to reset (see your WCL profile).",
    };
    return c.json({ error: friendly[e.status] ?? e.message }, e.status as 400);
  }
  return c.json({ error: "Unexpected server error" }, 500);
}
