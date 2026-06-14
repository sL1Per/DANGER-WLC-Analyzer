import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { REPORT_ID_RE, type ItemMeta, type ReportData } from "@wcl/core";
import { consumableBuffs, drumSpells, jcNecks, suboptimalConsumables, hasteBuffs, battleShoutBuffIds } from "@wcl/data";
import { TtlCache } from "./cache";
import { normalizeReport } from "./normalize";
import {
  WclError,
  fetchRawReport as realFetchRawReport,
  fetchToken as realFetchToken,
  fetchCombatantInfo as realFetchCombatantInfo,
  fetchItemMeta as realFetchItemMeta,
  fetchBuffEvents as realFetchBuffEvents,
  fetchCastEvents as realFetchCastEvents,
  fetchDeaths as realFetchDeaths,
  fetchInterrupts as realFetchInterrupts,
  fetchDamageTaken as realFetchDamageTaken,
  fetchDamageDone as realFetchDamageDone,
  fetchAllCasts as realFetchAllCasts,
  fetchTable as realFetchTable,
  fetchEnemyDebuffs as realFetchEnemyDebuffs,
  fetchAbsorbs as realFetchAbsorbs,
  type RawBuffEvent,
  type RawCastEvent,
  type RawCombatantInfo,
  type RawDeathEvent,
  type RawInterruptEvent,
  type RawDamageEvent,
  type RawTableEntry,
  type RawDebuffEvent,
} from "./wcl";

const DRUM_BUFF_IDS = drumSpells.map((d) => d.buffId);
const DRUM_CAST_IDS = [...new Set(drumSpells.map((d) => d.castId))];
const TRACKED_BUFF_IDS = [...new Set([
  ...consumableBuffs.map((b) => b.spellId),
  ...DRUM_BUFF_IDS,
  ...jcNecks.map((n) => n.buffId),
  // suboptimal buffs aren't all in consumableBuffs (e.g. low-level int
  // elixirs) — without fetching them, suboptimal detection can't see them
  ...suboptimalConsumables.filter((s) => s.kind === "buff").map((s) => s.id),
  ...hasteBuffs.map((h) => h.spellId),   // RPB activity spell-haste correction
  ...battleShoutBuffIds,                 // RPB Battle Shout uptime
])];

export interface AppDeps {
  fetchToken: typeof realFetchToken;
  fetchRawReport: typeof realFetchRawReport;
  fetchCombatantInfo: typeof realFetchCombatantInfo;
  fetchItemMeta: typeof realFetchItemMeta;
  fetchBuffEvents: typeof realFetchBuffEvents;
  fetchCastEvents: typeof realFetchCastEvents;
  fetchDeaths: typeof realFetchDeaths;
  fetchInterrupts: typeof realFetchInterrupts;
  fetchDamageTaken: typeof realFetchDamageTaken;
  fetchDamageDone: typeof realFetchDamageDone;
  fetchAllCasts: typeof realFetchAllCasts;
  fetchTable: typeof realFetchTable;
  fetchEnemyDebuffs: typeof realFetchEnemyDebuffs;
  fetchAbsorbs: typeof realFetchAbsorbs;
  cacheTtlMs: number;
}

export function createApp(deps: AppDeps = {
  fetchToken: realFetchToken,
  fetchRawReport: realFetchRawReport,
  fetchCombatantInfo: realFetchCombatantInfo,
  fetchItemMeta: realFetchItemMeta,
  fetchBuffEvents: realFetchBuffEvents,
  fetchCastEvents: realFetchCastEvents,
  fetchDeaths: realFetchDeaths,
  fetchInterrupts: realFetchInterrupts,
  fetchDamageTaken: realFetchDamageTaken,
  fetchDamageDone: realFetchDamageDone,
  fetchAllCasts: realFetchAllCasts,
  fetchTable: realFetchTable,
  fetchEnemyDebuffs: realFetchEnemyDebuffs,
  fetchAbsorbs: realFetchAbsorbs,
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
      let buffEvents: RawBuffEvent[] = [];
      let castEvents: RawCastEvent[] = [];
      let deaths: RawDeathEvent[] | undefined;
      {
        // gear and buff/cast events are best-effort: a failure must not take
        // down the whole report, and must not discard what the OTHER fetches
        // already returned. The four are independent, so run them in parallel
        // (WCL limits points/hour, not concurrency). Gear/buffs are boss-only;
        // drum casts and deaths count trash fights too, so fetched regardless.
        const none = Promise.resolve([]);
        const [combatantsR, buffR, castR, deathR] = await Promise.allSettled([
          bossFightIds.length > 0 ? deps.fetchCombatantInfo(id, token, bossFightIds) : none,
          bossFightIds.length > 0 ? deps.fetchBuffEvents(id, token, TRACKED_BUFF_IDS) : none,
          deps.fetchCastEvents(id, token, DRUM_CAST_IDS),
          deps.fetchDeaths(id, token),
        ]);
        if (combatantsR.status === "fulfilled") combatants = combatantsR.value as RawCombatantInfo[];
        if (buffR.status === "fulfilled") buffEvents = buffR.value as RawBuffEvent[];
        if (castR.status === "fulfilled") castEvents = castR.value;
        if (deathR.status === "fulfilled") deaths = deathR.value as RawDeathEvent[];
        const ids = new Set<number>();
        for (const c of combatants) for (const g of c.gear ?? []) {
          if (g.id !== 0) ids.add(g.id);
          for (const gem of g.gems ?? []) ids.add(gem.id);
        }
        if (ids.size > 0) {
          try {
            itemMeta = await deps.fetchItemMeta([...ids], token);
          } catch { /* names degrade to "item #id" in the UI */ }
        }
      }
      let interrupts: RawInterruptEvent[] = [];
      let damageTaken: RawDamageEvent[] = [];
      let damageDone: RawDamageEvent[] = [];
      let allCasts: RawCastEvent[] = [];
      let damageDoneTable: RawTableEntry[] = [];
      let healingTable: RawTableEntry[] = [];
      let damageTakenTable: RawTableEntry[] = [];
      let enemyDebuffs: RawDebuffEvent[] = [];
      let absorbEvents: RawDamageEvent[] = [];
      if (bossFightIds.length > 0) {
        const [intR, dtR, ddR, castR, ddtR, htR, dttR, edR, absR] = await Promise.allSettled([
          deps.fetchInterrupts(id, token, bossFightIds),
          deps.fetchDamageTaken(id, token, bossFightIds),
          deps.fetchDamageDone(id, token, bossFightIds),
          deps.fetchAllCasts(id, token, bossFightIds),
          deps.fetchTable(id, token, "DamageDone", bossFightIds),
          deps.fetchTable(id, token, "Healing", bossFightIds),
          deps.fetchTable(id, token, "DamageTaken", bossFightIds),
          deps.fetchEnemyDebuffs(id, token, bossFightIds),
          deps.fetchAbsorbs(id, token, bossFightIds),
        ]);
        if (intR.status === "fulfilled") interrupts = intR.value as RawInterruptEvent[];
        if (dtR.status === "fulfilled") damageTaken = dtR.value as RawDamageEvent[];
        if (ddR.status === "fulfilled") damageDone = ddR.value as RawDamageEvent[];
        if (castR.status === "fulfilled") allCasts = castR.value as RawCastEvent[];
        if (ddtR.status === "fulfilled") damageDoneTable = ddtR.value as RawTableEntry[];
        if (htR.status === "fulfilled") healingTable = htR.value as RawTableEntry[];
        if (dttR.status === "fulfilled") damageTakenTable = dttR.value as RawTableEntry[];
        if (edR.status === "fulfilled") enemyDebuffs = edR.value as RawDebuffEvent[];
        if (absR.status === "fulfilled") absorbEvents = absR.value as RawDamageEvent[];
      }
      const actorNames: Record<number, string> = {};
      for (const a of rawReport.masterData?.actors ?? []) actorNames[a.id] = a.name;
      for (const n of rawReport.masterData?.npcs ?? []) actorNames[n.id] = actorNames[n.id] ?? `NPC ${n.gameID}`;
      const data = normalizeReport(id, rawReport, combatants, itemMeta, {
        buffEvents, castEvents, deaths,
        trackedBuffIds: TRACKED_BUFF_IDS, drumBuffIds: DRUM_BUFF_IDS,
        interrupts, damageTaken, damageDone, allCasts,
        damageDoneTable, healingTable, damageTakenTable, actorNames,
        enemyDebuffs, absorbEvents,
      });
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
