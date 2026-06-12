import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { REPORT_ID_RE, type ItemMeta, type ReportData } from "@wcl/core";
import { TtlCache } from "./cache";
import { normalizeReport } from "./normalize";
import {
  WclError,
  fetchRawReport as realFetchRawReport,
  fetchToken as realFetchToken,
  fetchCombatantInfo as realFetchCombatantInfo,
  fetchItemMeta as realFetchItemMeta,
  type RawCombatantInfo,
} from "./wcl";

export interface AppDeps {
  fetchToken: typeof realFetchToken;
  fetchRawReport: typeof realFetchRawReport;
  fetchCombatantInfo: typeof realFetchCombatantInfo;
  fetchItemMeta: typeof realFetchItemMeta;
  cacheTtlMs: number;
}

export function createApp(deps: AppDeps = {
  fetchToken: realFetchToken,
  fetchRawReport: realFetchRawReport,
  fetchCombatantInfo: realFetchCombatantInfo,
  fetchItemMeta: realFetchItemMeta,
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
      const rawReport = await deps.fetchRawReport(id, token);
      const bossFightIds = rawReport.fights.filter((f) => f.encounterID !== 0).map((f) => f.id);
      let combatants: RawCombatantInfo[] = [];
      let itemMeta: Record<string, ItemMeta> = {};
      if (bossFightIds.length > 0) {
        // gear is best-effort: a failure here must not take down the whole report
        try {
          combatants = await deps.fetchCombatantInfo(id, token, bossFightIds);
          const ids = new Set<number>();
          for (const c of combatants) for (const g of c.gear ?? []) {
            if (g.id !== 0) ids.add(g.id);
            for (const gem of g.gems ?? []) ids.add(gem.id);
          }
          if (ids.size > 0) itemMeta = await deps.fetchItemMeta([...ids], token);
        } catch {
          combatants = [];
          itemMeta = {};
        }
      }
      const data = normalizeReport(id, rawReport, combatants, itemMeta);
      cache.set(id, data);
      return c.json({ data, cachedAt: cache.get(id)!.cachedAt });
    } catch (e) {
      return toErrorResponse(c, e);
    }
  });

  // Requiring a Bearer token prevents keyless callers from evicting the cache.
  // We cannot validate the token's authenticity without storing credentials,
  // but requiring the header is sufficient to keep casual/keyless eviction out (M1 goal).
  app.delete("/api/report/:id", (c) => {
    const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
    if (!token) return c.json({ error: "Authorization header required to evict cache." }, 401);
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
