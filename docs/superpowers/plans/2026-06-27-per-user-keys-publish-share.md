# Per-User Keys + Publish-to-Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every hosted user drive WCL with their own key end-to-end (no shared server state), and replace the automatic shared cache with an explicit "publish a key-free snapshot" sharing flow.

**Architecture:** Phase 1 moves WCL token exchange, GraphQL fetching, normalization, and caching out of the backend (`apps/api`) and into each user's browser (`apps/web`); the in-memory server cache becomes a per-browser IndexedDB cache. Phase 2 reduces `apps/api` to a tiny snapshot store (`POST/GET /api/share`) and adds a Publish action + a key-free `/s/:shareId` viewer route.

**Tech Stack:** TypeScript, React 19, react-router-dom v6, Vite, Vitest, Hono (Phase 2 snapshot store only), IndexedDB (`fake-indexeddb` in tests), `@wcl/core` + `@wcl/data` workspace packages (browser-safe, unchanged).

## Global Constraints

- **No Node-only APIs in browser code.** Replace `Buffer.from(s).toString("base64")` with `btoa(s)` (client id/secret are ASCII). All moved code must run in the browser.
- **Token lives only in `localStorage`** via existing `saveToken`/`loadToken` in `apps/web/src/lib/storage.ts`. No credential or access token may be sent to any server we host.
- **Preserve staleness behavior:** cached reports keep `cachedAt` and are flagged stale via `isStaleSchema(data.schemaVersion)` from `@wcl/core`; the "refresh to update" banner must keep working.
- **Published snapshots are key-free:** the stored payload is a `ReportData` and must contain no `clientId`/`clientSecret`/`accessToken` fields (asserted by a test).
- **Snapshot storage is swappable:** the production backend (serverless KV / file / DB) is deferred to TODO #14; ship an in-memory/file dev adapter behind an interface.
- **Do not modify analysis logic** in `@wcl/core` or `@wcl/data`. This work only relocates fetch/normalize/cache and adds sharing.
- **Keep the public surface of `apps/web/src/lib/api.ts` stable:** `fetchReport(id)`, `refreshReport(id)`, `ApiError`, and `ReportResponse { data, cachedAt, stale? }` — so `useReport`, `ReportPage`, etc. need no changes.
- **Test commands:** web → `pnpm --filter @wcl/web test`; api → `pnpm --filter @wcl/api test`. Run the relevant one(s) per task.

---

## PHASE 1 — Per-user keys (browser-side fetching)

After Phase 1: every user must enter their own WCL key; nobody can read data another user's key fetched. (Shared links temporarily prompt the recipient for their own key until Phase 2.)

### Task 1: Move the WCL client into the web app (browser-safe base64)

**Files:**
- Move: `apps/api/src/wcl.ts` → `apps/web/src/lib/wcl/wcl.ts`
- Move: `apps/api/src/wcl.test.ts` → `apps/web/src/lib/wcl/wcl.test.ts`
- Modify: `apps/web/src/lib/wcl/wcl.ts` (the `fetchToken` base64 line)
- Modify: `apps/api/scripts/*.ts` (repoint imports of `./wcl`)

**Interfaces:**
- Produces: the full `wcl.ts` export surface, unchanged signatures — `fetchToken(clientId, clientSecret): Promise<{accessToken, expiresIn}>`, `fetchRawReport`, `fetchCombatantInfo`, `fetchItemMeta`, `fetchBuffEvents`, `fetchCastEvents`, `fetchDeaths`, `fetchInterrupts`, `fetchDamageTaken`, `fetchDamageDone`, `fetchHealingDone`, `fetchAllCasts`, `fetchTable`, `fetchEnemyDebuffs`, `fetchAbsorbs`, `fetchRankings`, `WclError`, and all `Raw*` types — now importable from `apps/web/src/lib/wcl/wcl.ts`.

- [ ] **Step 1: Move the files with git (preserve history)**

```bash
cd "$(git rev-parse --show-toplevel)"
mkdir -p apps/web/src/lib/wcl
git mv apps/api/src/wcl.ts apps/web/src/lib/wcl/wcl.ts
git mv apps/api/src/wcl.test.ts apps/web/src/lib/wcl/wcl.test.ts
```

- [ ] **Step 2: Replace the Node `Buffer` base64 with `btoa` in `fetchToken`**

In `apps/web/src/lib/wcl/wcl.ts`, change the `Authorization` header line inside `fetchToken` from:

```ts
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
```

to:

```ts
      Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
```

(The existing test asserts the header equals `"Basic " + Buffer.from("myid:mysecret").toString("base64")`; for ASCII input `btoa` produces the identical string, so the test still passes.)

- [ ] **Step 3: Repoint the dev probe-script imports**

The probe scripts in `apps/api/scripts/` import the WCL client. Update each import that references the old location to the new one. Run:

```bash
cd "$(git rev-parse --show-toplevel)"
grep -rln "from \"\.\./src/wcl\"\|from \"\.\./src/wcl\.js\"" apps/api/scripts || echo "none-by-that-pattern"
```

For every match, change the import specifier to the moved path, e.g.:

```ts
// before
import { fetchToken, fetchRawReport } from "../src/wcl";
// after
import { fetchToken, fetchRawReport } from "../../web/src/lib/wcl/wcl";
```

(Probes are dev-only `tsx` scripts; cross-package relative TS imports work without a build. `btoa` is available in Node 18+, so they keep running.)

- [ ] **Step 4: Run the moved WCL tests at their new location**

Run: `pnpm --filter @wcl/web test -- src/lib/wcl/wcl.test.ts`
Expected: PASS (all `fetchToken`/`fetchRawReport`/… suites green).

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/lib/wcl apps/api/scripts
git commit -m "refactor(web): move WCL client into web app, browser-safe base64"
```

---

### Task 2: Move normalization into the web app

**Files:**
- Move: `apps/api/src/normalize.ts` → `apps/web/src/lib/wcl/normalize.ts`
- Move: `apps/api/src/normalize.test.ts` → `apps/web/src/lib/wcl/normalize.test.ts`
- Modify: `apps/api/scripts/*.ts` (repoint imports of `./normalize`, if any)

**Interfaces:**
- Consumes: `./wcl` (same directory after the move — its relative imports `from "./wcl"` stay valid).
- Produces: `normalizeReport(reportId, rawReport, combatants, itemMeta, eventInputs): ReportData` and `NormalizeEventInputs`, importable from `apps/web/src/lib/wcl/normalize.ts`.

- [ ] **Step 1: Move the files with git**

```bash
cd "$(git rev-parse --show-toplevel)"
git mv apps/api/src/normalize.ts apps/web/src/lib/wcl/normalize.ts
git mv apps/api/src/normalize.test.ts apps/web/src/lib/wcl/normalize.test.ts
```

The `normalize.ts` imports `from "@wcl/core"`, `from "@wcl/data"` (workspace, resolve in web) and `from "./wcl"` (same new directory) — no import edits needed inside it.

- [ ] **Step 2: Repoint any probe-script imports of normalize**

```bash
cd "$(git rev-parse --show-toplevel)"
grep -rln "src/normalize" apps/api/scripts || echo "no probe imports normalize"
```

For each match, repoint `"../src/normalize"` → `"../../web/src/lib/wcl/normalize"`.

- [ ] **Step 3: Run the moved normalize tests**

Run: `pnpm --filter @wcl/web test -- src/lib/wcl/normalize.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/lib/wcl apps/api/scripts
git commit -m "refactor(web): move report normalization into web app"
```

---

### Task 3: Per-browser report cache (IndexedDB)

**Files:**
- Create: `apps/web/src/lib/reportCache.ts`
- Test: `apps/web/src/lib/reportCache.test.ts`
- Modify: `apps/web/package.json` (add `fake-indexeddb` devDependency)

**Interfaces:**
- Consumes: `ReportData` from `@wcl/core`.
- Produces:
  - `getCachedReport(id: string): Promise<{ data: ReportData; cachedAt: number } | null>`
  - `setCachedReport(id: string, data: ReportData): Promise<void>` (stamps `cachedAt = Date.now()`)
  - `deleteCachedReport(id: string): Promise<void>`

- [ ] **Step 1: Add the `fake-indexeddb` test dependency**

```bash
cd "$(git rev-parse --show-toplevel)"
pnpm --filter @wcl/web add -D fake-indexeddb
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/lib/reportCache.test.ts`:

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getCachedReport, setCachedReport, deleteCachedReport } from "./reportCache";
import type { ReportData } from "@wcl/core";

const sample = { reportId: "abc", title: "T5", schemaVersion: 1 } as unknown as ReportData;

describe("reportCache", () => {
  beforeEach(async () => { await deleteCachedReport("abc"); });

  it("returns null for an unknown id", async () => {
    expect(await getCachedReport("missing")).toBeNull();
  });

  it("stores and retrieves a report with a cachedAt timestamp", async () => {
    const before = Date.now();
    await setCachedReport("abc", sample);
    const hit = await getCachedReport("abc");
    expect(hit?.data.reportId).toBe("abc");
    expect(hit?.cachedAt).toBeGreaterThanOrEqual(before);
  });

  it("deletes an entry", async () => {
    await setCachedReport("abc", sample);
    await deleteCachedReport("abc");
    expect(await getCachedReport("abc")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @wcl/web test -- src/lib/reportCache.test.ts`
Expected: FAIL ("Failed to resolve import ./reportCache" / module not found).

- [ ] **Step 4: Implement the IndexedDB cache**

Create `apps/web/src/lib/reportCache.ts`:

```ts
import type { ReportData } from "@wcl/core";

// Per-browser report cache. Replaces the old shared server-side TtlCache:
// each user's normalized reports live only in their own browser, so no one
// can read data another user's WCL key fetched. IndexedDB (not localStorage)
// because a normalized report can exceed localStorage's ~5 MB limit.
const DB_NAME = "wcl-reports";
const STORE = "reports";
const DB_VERSION = 1;

interface CachedReport { data: ReportData; cachedAt: number; }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedReport(id: string): Promise<CachedReport | null> {
  const entry = await tx<CachedReport | undefined>("readonly", (s) => s.get(id));
  return entry ?? null;
}

export async function setCachedReport(id: string, data: ReportData): Promise<void> {
  await tx("readwrite", (s) => s.put({ data, cachedAt: Date.now() } satisfies CachedReport, id));
}

export async function deleteCachedReport(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @wcl/web test -- src/lib/reportCache.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/reportCache.ts apps/web/src/lib/reportCache.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): per-browser IndexedDB report cache"
```

---

### Task 4: Browser-side report loader (`loadReport`)

**Files:**
- Create: `apps/web/src/lib/wcl/loadReport.ts`
- Test: `apps/web/src/lib/wcl/loadReport.test.ts`

**Interfaces:**
- Consumes: all `wcl.ts` fetchers (Task 1), `normalizeReport` (Task 2), constants from `@wcl/data`.
- Produces: `loadReport(id: string, token: string): Promise<ReportData>` — ports the orchestration currently in `apps/api/src/app.ts` (the two `Promise.allSettled` batches, the tracked-buff/drum id sets, building `actorNames`/`abilityMeta`/`petOwners`, calling `normalizeReport`). Throws `WclError` on a failed primary report fetch.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/wcl/loadReport.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

// Mock the whole WCL fetch layer so loadReport exercises only orchestration.
vi.mock("./wcl", () => ({
  WclError: class WclError extends Error { constructor(public status: number, m: string) { super(m); } },
  fetchRawReport: vi.fn().mockResolvedValue({
    title: "T5 fun", startTime: 1, endTime: 2, zone: { name: "Karazhan" },
    fights: [], masterData: { actors: [], npcs: [] },
  }),
  fetchCombatantInfo: vi.fn().mockResolvedValue([]),
  fetchItemMeta: vi.fn().mockResolvedValue({}),
  fetchBuffEvents: vi.fn().mockResolvedValue([]),
  fetchCastEvents: vi.fn().mockResolvedValue([]),
  fetchDeaths: vi.fn().mockResolvedValue([]),
  fetchInterrupts: vi.fn().mockResolvedValue([]),
  fetchDamageTaken: vi.fn().mockResolvedValue([]),
  fetchDamageDone: vi.fn().mockResolvedValue([]),
  fetchHealingDone: vi.fn().mockResolvedValue([]),
  fetchAllCasts: vi.fn().mockResolvedValue([]),
  fetchTable: vi.fn().mockResolvedValue([]),
  fetchEnemyDebuffs: vi.fn().mockResolvedValue([]),
  fetchAbsorbs: vi.fn().mockResolvedValue([]),
  fetchRankings: vi.fn().mockResolvedValue([]),
}));

import { loadReport } from "./loadReport";
import { SCHEMA_VERSION } from "@wcl/core";

describe("loadReport", () => {
  it("normalizes a fetched report and stamps the current schema version", async () => {
    const data = await loadReport("a1B2c3D4e5F6g7H8", "tok");
    expect(data.reportId).toBe("a1B2c3D4e5F6g7H8");
    expect(data.title).toBe("T5 fun");
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("propagates a WclError when the primary report fetch fails", async () => {
    const wcl = await import("./wcl");
    (wcl.fetchRawReport as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new wcl.WclError(404, "Report not found"));
    await expect(loadReport("a1B2c3D4e5F6g7H8", "tok")).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wcl/web test -- src/lib/wcl/loadReport.test.ts`
Expected: FAIL (cannot resolve `./loadReport`).

- [ ] **Step 3: Implement `loadReport` by porting the app.ts orchestration**

Create `apps/web/src/lib/wcl/loadReport.ts`. This is the body of the old `GET /api/report/:id` handler with the HTTP/cache shell removed and the `token` passed in:

```ts
import type { ItemMeta, ReportData } from "@wcl/core";
import {
  consumableBuffs, drumSpells, jcNecks, suboptimalConsumables, hasteBuffs,
  battleShoutBuffIds, extraWindfurySpellId, battleSquawkBuffId,
} from "@wcl/data";
import { normalizeReport } from "./normalize";
import {
  fetchRawReport, fetchCombatantInfo, fetchItemMeta, fetchBuffEvents, fetchCastEvents,
  fetchDeaths, fetchInterrupts, fetchDamageTaken, fetchDamageDone, fetchHealingDone,
  fetchAllCasts, fetchTable, fetchEnemyDebuffs, fetchAbsorbs, fetchRankings,
  type RawBuffEvent, type RawCastEvent, type RawCombatantInfo, type RawDeathEvent,
  type RawInterruptEvent, type RawDamageEvent, type RawTableEntry, type RawDebuffEvent,
  type RawRankingEntry,
} from "./wcl";

const DRUM_BUFF_IDS = drumSpells.map((d) => d.buffId);
const DRUM_CAST_IDS = [...new Set(drumSpells.map((d) => d.castId))];
const TRACKED_BUFF_IDS = [...new Set([
  ...consumableBuffs.map((b) => b.spellId),
  ...DRUM_BUFF_IDS,
  ...jcNecks.map((n) => n.buffId),
  ...suboptimalConsumables.filter((s) => s.kind === "buff").map((s) => s.id),
  ...hasteBuffs.map((h) => h.spellId),
  ...battleShoutBuffIds,
])];

/** Fetch + normalize a full report in the browser using the caller's own WCL
 *  token. Ported from the old apps/api GET /api/report handler — same parallel
 *  best-effort fetch strategy, minus the HTTP/cache shell. */
export async function loadReport(id: string, token: string): Promise<ReportData> {
  const rawReport = await fetchRawReport(id, token);
  const bossFightIds = rawReport.fights.filter((f) => f.encounterID !== 0).map((f) => f.id);

  let combatants: RawCombatantInfo[] = [];
  let itemMeta: Record<string, ItemMeta> = {};
  let buffEvents: RawBuffEvent[] = [];
  let castEvents: RawCastEvent[] = [];
  let deaths: RawDeathEvent[] | undefined;
  {
    const none = Promise.resolve([]);
    const [combatantsR, buffR, castR, deathR] = await Promise.allSettled([
      bossFightIds.length > 0 ? fetchCombatantInfo(id, token, bossFightIds) : none,
      bossFightIds.length > 0 ? fetchBuffEvents(id, token, TRACKED_BUFF_IDS) : none,
      fetchCastEvents(id, token, DRUM_CAST_IDS),
      fetchDeaths(id, token),
    ]);
    if (combatantsR.status === "fulfilled") combatants = combatantsR.value as RawCombatantInfo[];
    if (buffR.status === "fulfilled") buffEvents = buffR.value as RawBuffEvent[];
    if (castR.status === "fulfilled") castEvents = castR.value as RawCastEvent[];
    if (deathR.status === "fulfilled") deaths = deathR.value as RawDeathEvent[];
    const ids = new Set<number>();
    for (const c of combatants) for (const g of c.gear ?? []) {
      if (g.id !== 0) ids.add(g.id);
      for (const gem of g.gems ?? []) ids.add(gem.id);
    }
    if (ids.size > 0) {
      try { itemMeta = await fetchItemMeta([...ids], token); } catch { /* names degrade to "item #id" */ }
    }
  }

  let interrupts: RawInterruptEvent[] = [];
  let damageTaken: RawDamageEvent[] = [];
  let damageDone: RawDamageEvent[] = [];
  let healingDone: RawDamageEvent[] = [];
  let allCasts: RawCastEvent[] = [];
  let damageDoneTable: RawTableEntry[] = [];
  let healingTable: RawTableEntry[] = [];
  let damageTakenTable: RawTableEntry[] = [];
  let enemyDebuffs: RawDebuffEvent[] = [];
  let absorbEvents: RawDamageEvent[] = [];
  let rankings: RawRankingEntry[] = [];
  const allFightIds = rawReport.fights.map((f) => f.id);
  const hasBoss = bossFightIds.length > 0;
  if (allFightIds.length > 0) {
    const none = Promise.resolve([]);
    const [intR, dtR, ddR, castR, ddtR, htR, dttR, edR, absR, rankR, hdR] = await Promise.allSettled([
      fetchInterrupts(id, token, allFightIds),
      fetchDamageTaken(id, token, allFightIds),
      fetchDamageDone(id, token, allFightIds),
      fetchAllCasts(id, token, allFightIds),
      hasBoss ? fetchTable(id, token, "DamageDone", bossFightIds) : none,
      hasBoss ? fetchTable(id, token, "Healing", bossFightIds) : none,
      hasBoss ? fetchTable(id, token, "DamageTaken", bossFightIds) : none,
      fetchEnemyDebuffs(id, token, allFightIds),
      fetchAbsorbs(id, token, allFightIds),
      hasBoss ? fetchRankings(id, token) : none,
      fetchHealingDone(id, token, allFightIds),
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
    if (rankR.status === "fulfilled") rankings = rankR.value as RawRankingEntry[];
    if (hdR.status === "fulfilled") healingDone = hdR.value as RawDamageEvent[];
  }

  const actorNames: Record<number, string> = {};
  for (const a of rawReport.masterData?.actors ?? []) actorNames[a.id] = a.name;
  for (const n of rawReport.masterData?.npcs ?? []) actorNames[n.id] = actorNames[n.id] ?? n.name ?? `NPC ${n.gameID}`;
  const abilityMeta: Record<string, { name: string }> = {};
  for (const a of rawReport.masterData?.abilities ?? []) abilityMeta[String(a.gameID)] = { name: a.name };
  const petOwners: Record<number, number> = {};
  for (const p of rawReport.masterData?.pets ?? []) petOwners[p.id] = p.petOwner;

  return normalizeReport(id, rawReport, combatants, itemMeta, {
    buffEvents, castEvents, deaths,
    trackedBuffIds: TRACKED_BUFF_IDS, drumBuffIds: DRUM_BUFF_IDS,
    interrupts, damageTaken, damageDone, allCasts,
    damageDoneTable, healingTable, damageTakenTable, actorNames,
    enemyDebuffs, absorbEvents, rankings, healingDone, abilityMeta, petOwners,
    extraWindfurySpellId, battleSquawkBuffId,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @wcl/web test -- src/lib/wcl/loadReport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/wcl/loadReport.ts apps/web/src/lib/wcl/loadReport.test.ts
git commit -m "feat(web): browser-side report loader (token + GraphQL + normalize)"
```

---

### Task 5: Rewire `api.ts` to fetch in the browser

**Files:**
- Modify: `apps/web/src/lib/api.ts` (full rewrite, same exports)
- Test: `apps/web/src/lib/api.test.ts` (create)

**Interfaces:**
- Consumes: `loadCredentials`/`loadToken`/`saveToken` (storage), `loadReport` (Task 4), `getCachedReport`/`setCachedReport`/`deleteCachedReport` (Task 3), `isStaleSchema` (`@wcl/core`).
- Produces (unchanged surface): `fetchReport(id): Promise<ReportResponse>`, `refreshReport(id): Promise<ReportResponse>`, `class ApiError`, `interface ReportResponse { data; cachedAt; stale? }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/api.test.ts`:

```ts
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION } from "@wcl/core";
import { deleteCachedReport } from "./reportCache";
import { saveCredentials } from "./storage";

vi.mock("./wcl/loadReport", () => ({
  loadReport: vi.fn().mockResolvedValue({ reportId: "abc", title: "T5", schemaVersion: SCHEMA_VERSION }),
}));

import { fetchReport, refreshReport, ApiError } from "./api";
import { loadReport } from "./wcl/loadReport";

beforeEach(async () => {
  localStorage.clear();
  await deleteCachedReport("abc");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchReport", () => {
  it("throws a needsKey ApiError when no credentials are stored", async () => {
    await expect(fetchReport("abc")).rejects.toMatchObject({ needsKey: true });
  });

  it("exchanges credentials for a token directly with WCL, then loads + caches", async () => {
    saveCredentials({ clientId: "id", clientSecret: "secret" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 86400 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchReport("abc");
    expect(res.data.reportId).toBe("abc");
    expect(res.stale).toBe(false);
    // token exchanged against WCL directly (not our backend)
    expect(fetchMock.mock.calls[0]![0]).toBe("https://www.warcraftlogs.com/oauth/token");
    expect(loadReport).toHaveBeenCalledWith("abc", "tok");

    // second call serves from the browser cache without re-loading
    (loadReport as ReturnType<typeof vi.fn>).mockClear();
    const cached = await fetchReport("abc");
    expect(cached.data.reportId).toBe("abc");
    expect(loadReport).not.toHaveBeenCalled();
  });

  it("refreshReport clears the cache and re-loads", async () => {
    saveCredentials({ clientId: "id", clientSecret: "secret" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 86400 }), { status: 200 })));
    await fetchReport("abc");
    (loadReport as ReturnType<typeof vi.fn>).mockClear();
    await refreshReport("abc");
    expect(loadReport).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wcl/web test -- src/lib/api.test.ts`
Expected: FAIL (current `api.ts` posts to `/api/token` and `/api/report`, so the WCL-URL and cache assertions fail).

- [ ] **Step 3: Rewrite `api.ts`**

Replace the contents of `apps/web/src/lib/api.ts` with:

```ts
import { type ReportData, isStaleSchema } from "@wcl/core";
import { loadCredentials, loadToken, saveToken } from "./storage";
import { loadReport } from "./wcl/loadReport";
import { getCachedReport, setCachedReport, deleteCachedReport } from "./reportCache";

const WCL_TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";

export class ApiError extends Error {
  status: number;
  needsKey: boolean;
  constructor(status: number, message: string, needsKey = false) {
    super(message);
    this.status = status;
    this.needsKey = needsKey;
  }
}

export interface ReportResponse { data: ReportData; cachedAt: number; stale?: boolean; }

// Exchange the user's stored credentials for a WCL access token, directly with
// WCL (CORS-enabled) — the secret never touches any server we host. Returns null
// when no credentials are stored, so callers can surface a needsKey error.
async function ensureToken(): Promise<string | null> {
  const existing = loadToken();
  if (existing) return existing.accessToken;
  const creds = loadCredentials();
  if (!creds) return null;
  const res = await fetch(WCL_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${creds.clientId}:${creds.clientSecret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) {
    const msg = res.status === 401
      ? "WCL rejected the credentials. Check your client ID and secret."
      : `WCL token request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  saveToken({ accessToken: access_token, expiresAt: Date.now() + (expires_in - 300) * 1000 });
  return access_token;
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  // WclError carries a numeric status; map a couple to friendly copy.
  const status = typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : 500;
  const friendly: Record<number, string> = {
    401: "WCL rejected the credentials. Check your client ID and secret.",
    429: "WCL rate limit reached. Wait for your hourly points to reset (see your WCL profile).",
  };
  return new ApiError(status, friendly[status] ?? (e instanceof Error ? e.message : "Unexpected error"));
}

export async function fetchReport(reportId: string): Promise<ReportResponse> {
  const cached = await getCachedReport(reportId);
  if (cached) {
    return { data: cached.data, cachedAt: cached.cachedAt, stale: isStaleSchema(cached.data.schemaVersion) };
  }
  const token = await ensureToken();
  if (!token) {
    throw new ApiError(401, "Add your WCL credentials in Settings to load this report.", true);
  }
  try {
    const data = await loadReport(reportId, token);
    await setCachedReport(reportId, data);
    const stored = await getCachedReport(reportId);
    return { data, cachedAt: stored?.cachedAt ?? Date.now(), stale: false };
  } catch (e) {
    throw toApiError(e);
  }
}

export async function refreshReport(reportId: string): Promise<ReportResponse> {
  await deleteCachedReport(reportId);
  return fetchReport(reportId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @wcl/web test -- src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full web test suite (catch fallout in `useReport`/pages)**

Run: `pnpm --filter @wcl/web test`
Expected: PASS. (If `ReportPage.test.tsx` mocked `/api/...` fetches, update it to mock `./lib/api` `fetchReport`/`refreshReport` instead — repeat the code, do not leave it broken.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat(web): fetch reports browser-side with per-user key + local cache"
```

---

### Task 6: Remove the WCL backend endpoints

**Files:**
- Delete: `apps/api/src/app.ts`, `apps/api/src/app.test.ts`, `apps/api/src/cache.ts`, `apps/api/src/cache.test.ts`, `apps/api/src/server.ts`
- Modify: `apps/api/src/normalize.test.ts` is already moved (Task 2); confirm `apps/api/src` no longer references the moved files.
- Keep: `apps/web/vite.config.ts` `/api` proxy (Phase 2 reuses it for `/api/share`).

**Interfaces:**
- Produces: nothing new. `apps/api` now contains only `scripts/` (dev probes) until Task 7 adds the snapshot store.

- [ ] **Step 1: Delete the backend WCL/token/report/cache modules**

```bash
cd "$(git rev-parse --show-toplevel)"
git rm apps/api/src/app.ts apps/api/src/app.test.ts apps/api/src/cache.ts apps/api/src/cache.test.ts apps/api/src/server.ts
```

- [ ] **Step 2: Verify nothing in `apps/api/src` dangles**

```bash
ls apps/api/src 2>/dev/null || echo "src empty"
grep -rn "from \"./wcl\"\|from \"./normalize\"\|createApp" apps/api/src 2>/dev/null || echo "no dangling refs"
```

Expected: no dangling references (probes under `apps/api/scripts` were repointed in Tasks 1–2).

- [ ] **Step 3: Confirm both test suites pass**

Run: `pnpm --filter @wcl/web test`
Run: `pnpm --filter @wcl/api test`
Expected: web PASS; api PASS or "no test files found" (acceptable — the api package now has no tests until Task 7).

- [ ] **Step 4: Commit**

```bash
git add -A apps/api
git commit -m "refactor(api): remove WCL/token/report proxy + shared cache (now browser-side)"
```

---

**Phase 1 checkpoint.** At this point the security requirement is met: each user fetches with their own key, cached only in their own browser; nothing your key fetched is readable by anyone else. Shared deep links temporarily prompt the recipient for their own key — Phase 2 restores key-free sharing.

---

## PHASE 2 — Publish-to-share (key-free snapshots)

### Task 7: Snapshot store backend (`POST/GET /api/share`)

**Files:**
- Create: `apps/api/src/shareStore.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Test: `apps/api/src/app.test.ts`
- Test: `apps/api/src/shareStore.test.ts`

**Interfaces:**
- Produces:
  - `interface ShareStore { put(data: ReportData): Promise<string>; get(id: string): Promise<ReportData | null>; }`
  - `createMemoryShareStore(): ShareStore` (dev/default adapter — swappable for KV at deploy time)
  - `createApp(store?: ShareStore)` → Hono app exposing `POST /api/share` → `{ shareId }` and `GET /api/share/:shareId` → `ReportData | 404`.

- [ ] **Step 1: Write the failing shareStore test**

Create `apps/api/src/shareStore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMemoryShareStore } from "./shareStore";
import type { ReportData } from "@wcl/core";

const data = { reportId: "abc", title: "T5" } as unknown as ReportData;

describe("createMemoryShareStore", () => {
  it("round-trips a snapshot under a generated id", async () => {
    const store = createMemoryShareStore();
    const id = await store.put(data);
    expect(typeof id).toBe("string");
    expect((await store.get(id))?.reportId).toBe("abc");
  });
  it("returns null for an unknown id", async () => {
    expect(await createMemoryShareStore().get("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @wcl/api test -- src/shareStore.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the store**

Create `apps/api/src/shareStore.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { ReportData } from "@wcl/core";

// Storage seam for published, key-free report snapshots. The in-memory adapter
// is for local dev; swap createMemoryShareStore for a serverless KV/file/DB
// adapter at deploy time (TODO #14) without touching the HTTP layer.
export interface ShareStore {
  put(data: ReportData): Promise<string>;
  get(id: string): Promise<ReportData | null>;
}

export function createMemoryShareStore(): ShareStore {
  const map = new Map<string, ReportData>();
  return {
    async put(data) { const id = randomUUID().replace(/-/g, "").slice(0, 12); map.set(id, data); return id; },
    async get(id) { return map.get(id) ?? null; },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @wcl/api test -- src/shareStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing app test**

Create `apps/api/src/app.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createMemoryShareStore } from "./shareStore";
import type { ReportData } from "@wcl/core";

const data = { reportId: "abc", title: "T5", players: [] } as unknown as ReportData;

describe("share endpoints", () => {
  it("POST /api/share stores and returns a shareId; GET returns it back", async () => {
    const app = createApp(createMemoryShareStore());
    const post = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    expect(post.status).toBe(200);
    const { shareId } = await post.json();
    expect(typeof shareId).toBe("string");

    const get = await app.request(`/api/share/${shareId}`);
    expect(get.status).toBe(200);
    expect((await get.json()).reportId).toBe("abc");
  });

  it("GET unknown shareId returns 404", async () => {
    const app = createApp(createMemoryShareStore());
    expect((await app.request("/api/share/missing")).status).toBe(404);
  });

  it("stored payload carries no credential fields", async () => {
    const app = createApp(createMemoryShareStore());
    const post = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const { shareId } = await post.json();
    const body = await (await app.request(`/api/share/${shareId}`)).text();
    expect(body).not.toMatch(/clientId|clientSecret|accessToken/);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm --filter @wcl/api test -- src/app.test.ts`
Expected: FAIL (no `./app`).

- [ ] **Step 7: Implement the Hono app and server**

Create `apps/api/src/app.ts`:

```ts
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
```

Create `apps/api/src/server.ts`:

```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp().fetch, port });
console.log(`Snapshot store listening on http://localhost:${port}`);
```

- [ ] **Step 8: Run the api suite**

Run: `pnpm --filter @wcl/api test`
Expected: PASS (shareStore + app).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): key-free snapshot store (POST/GET /api/share)"
```

---

### Task 8: Web share client (`publishSnapshot` / `fetchSnapshot`)

**Files:**
- Create: `apps/web/src/lib/share.ts`
- Test: `apps/web/src/lib/share.test.ts`

**Interfaces:**
- Produces:
  - `publishSnapshot(data: ReportData): Promise<string>` — `POST /api/share`, returns `shareId`.
  - `fetchSnapshot(shareId: string): Promise<ReportData>` — `GET /api/share/:shareId`; throws `ApiError(404)` if missing.
  - `shareUrl(shareId: string): string` — absolute `…/s/<shareId>` for the current origin.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/share.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishSnapshot, fetchSnapshot, shareUrl } from "./share";
import type { ReportData } from "@wcl/core";

afterEach(() => vi.unstubAllGlobals());
const data = { reportId: "abc" } as unknown as ReportData;

describe("share client", () => {
  it("publishSnapshot POSTs to /api/share and returns the shareId", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ shareId: "xyz123" }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    expect(await publishSnapshot(data)).toBe("xyz123");
    expect(mock.mock.calls[0]![0]).toBe("/api/share");
    expect((mock.mock.calls[0]![1] as RequestInit).method).toBe("POST");
  });

  it("fetchSnapshot GETs the snapshot", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 })));
    expect((await fetchSnapshot("xyz123")).reportId).toBe("abc");
  });

  it("fetchSnapshot throws on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    await expect(fetchSnapshot("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("shareUrl builds an absolute /s/ link", () => {
    expect(shareUrl("xyz123")).toMatch(/\/s\/xyz123$/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @wcl/web test -- src/lib/share.test.ts`
Expected: FAIL (no `./share`).

- [ ] **Step 3: Implement the share client**

Create `apps/web/src/lib/share.ts`:

```ts
import type { ReportData } from "@wcl/core";
import { ApiError } from "./api";

export async function publishSnapshot(data: ReportData): Promise<string> {
  const res = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new ApiError(res.status, "Could not publish this report for sharing.");
  return (await res.json() as { shareId: string }).shareId;
}

export async function fetchSnapshot(shareId: string): Promise<ReportData> {
  const res = await fetch(`/api/share/${shareId}`);
  if (!res.ok) throw new ApiError(res.status, "This shared report could not be found.");
  return await res.json() as ReportData;
}

export function shareUrl(shareId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/s/${shareId}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @wcl/web test -- src/lib/share.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/share.ts apps/web/src/lib/share.test.ts
git commit -m "feat(web): publish/fetch key-free report snapshots"
```

---

### Task 9: Extract a presentational `ReportView` from `ReportPage`

**Files:**
- Create: `apps/web/src/components/report/ReportView.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx`
- Modify: `apps/web/src/components/ReportHeader.tsx` (make refresh optional)

**Interfaces:**
- Produces: `ReportView` —
  ```ts
  interface ReportViewProps {
    report: ReportData;        // already-loaded data
    stale?: boolean;           // show stale banner (live mode only)
    onRefresh?: () => void;    // omitted in read-only/shared mode → no refresh UI
    shareActions?: React.ReactNode; // injected into LensBar `actions` slot
  }
  ```
  Contains everything currently rendered by `ReportPage` from `const lens = …` (line 55) through the closing `</div>` (line 175): the phone drawer / desktop header, the stale banner, the `LensBar`, and the fight/player body. Reads tab/lens state from `useSearchParams` (works in both the live and shared routes).

- [ ] **Step 1: Read the current files**

Read `apps/web/src/pages/ReportPage.tsx` (lines 37–177) and `apps/web/src/components/ReportHeader.tsx` so the extraction is faithful (props, class names, handlers).

- [ ] **Step 2: Create `ReportView.tsx`**

Move the body. Copy `CATEGORIES`, `Cat`, `TRASH_HIDDEN_CATS`, `BOSSES_ONLY_CATS` (ReportPage lines 21–35) and all the imports the body uses (ReportPage lines 3–18) into `ReportView.tsx`. The component signature and the conditional refresh/stale rendering:

```tsx
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import type { ReportData } from "@wcl/core";
// …(copy the rest of ReportPage's body imports: useIsPhone, ReportHeader,
//    ReportDrawer, LensBar, scopeReport, all the view components, EmptyToggle)…

interface ReportViewProps {
  report: ReportData;
  stale?: boolean;
  onRefresh?: () => void;
  shareActions?: ReactNode;
}

export function ReportView({ report, stale = false, onRefresh, shareActions }: ReportViewProps) {
  const [params, setParams] = useSearchParams();
  const isPhone = useIsPhone();
  // …paste ReportPage lines 55–96 verbatim (lens/query/fightId/playerId,
  //    categories, cat, patch, goPlayer, viewLabel, reportDetails)…

  return (
    <div className="report">
      {isPhone ? (
        <ReportDrawer title={report.title} activeLabel={viewLabel}>
          <nav className="drawer-nav">{/* …unchanged category buttons… */}</nav>
          <div className="drawer-actions">
            <Link to="/settings" className="btn-outline">Settings</Link>
            <Link to="/" className="btn-outline">New report</Link>
            {onRefresh && <button className="btn-outline" onClick={onRefresh}>Refresh from WCL</button>}
          </div>
        </ReportDrawer>
      ) : (
        <ReportHeader report={report} onRefresh={onRefresh} />
      )}
      {stale && onRefresh && (
        <div className="stale-banner" role="status">
          <span>This report was cached by an older version of the analyzer and may be missing the latest stats.</span>
          <button type="button" className="btn-outline" onClick={onRefresh}>Refresh from WCL</button>
        </div>
      )}
      <LensBar
        report={report} lens={lens} fightId={fightId} playerId={playerId} query={query}
        onLens={(l) => patch({ lens: l })}
        onFight={(id) => patch({ fight: String(id) })}
        onPlayer={(id) => patch({ player: String(id) })}
        onQuery={(q) => patch({ q })}
        actions={shareActions}
      />
      {/* …paste ReportPage lines 148–174 verbatim (the fight/player body)… */}
    </div>
  );
}
```

- [ ] **Step 3: Make `ReportHeader.onRefresh` optional**

In `apps/web/src/components/ReportHeader.tsx`, change the `onRefresh` prop type to optional (`onRefresh?: () => void`) and render the "Refresh from WCL" button only when `onRefresh` is provided. (Read the file first; repeat its existing button markup inside the `onRefresh && (…)` guard.)

- [ ] **Step 4: Slim `ReportPage.tsx` to a data-loader that renders `ReportView`**

Replace `ReportPage.tsx` with:

```tsx
import { useParams, Link } from "react-router-dom";
import { useReport } from "../lib/useReport";
import { LoadingNugget } from "../components/LoadingNugget";
import { ReportView } from "../components/report/ReportView";
import { PublishShare } from "../components/PublishShare"; // added in Task 10

export function ReportPage() {
  const { reportId = "" } = useParams();
  const { result, error, loading, reload } = useReport(reportId);

  if (loading) return <LoadingNugget />;
  if (error) {
    return (
      <div role="alert">
        <p>{error.message}</p>
        {error.needsKey && <p><Link to="/settings">Add your WCL credentials</Link> to load this report.</p>}
      </div>
    );
  }
  if (!result) return null;

  return (
    <ReportView
      report={result.data}
      stale={result.stale}
      onRefresh={reload}
      shareActions={<PublishShare report={result.data} />}
    />
  );
}
```

> Note: `PublishShare` lands in Task 10. If executing strictly task-by-task, temporarily pass `shareActions={null}` here and switch to `<PublishShare …>` in Task 10. Reorder Tasks 9/10 if your executor prefers.

- [ ] **Step 5: Run the web suite**

Run: `pnpm --filter @wcl/web test`
Expected: PASS. Update `ReportPage.test.tsx` if it asserted on markup now living in `ReportView` (move those assertions to a new `ReportView.test.tsx` or retarget them — repeat the assertions, don't drop coverage).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/report/ReportView.tsx apps/web/src/pages/ReportPage.tsx apps/web/src/components/ReportHeader.tsx
git commit -m "refactor(web): extract presentational ReportView (read-only capable)"
```

---

### Task 10: Publish action + Discord wiring

**Files:**
- Create: `apps/web/src/components/PublishShare.tsx`
- Test: `apps/web/src/components/PublishShare.test.tsx`

**Interfaces:**
- Consumes: `publishSnapshot`, `shareUrl` (Task 8); `loadWebhookUrl` (storage); `buildShareMessage`, `postToDiscord` (existing `lib/discord.ts`); `ShareToDiscord` props pattern.
- Produces: `PublishShare({ report }: { report: ReportData })` — a button that publishes the snapshot, then reveals the key-free `/s/<id>` link with a copy button and (when a webhook is set) a "Post to Discord" action that posts the snapshot link.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/PublishShare.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublishShare } from "./PublishShare";
import type { ReportData } from "@wcl/core";

vi.mock("../lib/share", () => ({
  publishSnapshot: vi.fn().mockResolvedValue("xyz123"),
  shareUrl: (id: string) => `https://app.test/s/${id}`,
}));

const report = { reportId: "abc", title: "T5", zoneName: "Karazhan" } as unknown as ReportData;

describe("PublishShare", () => {
  it("publishes on click and reveals the key-free share link", async () => {
    render(<PublishShare report={report} />);
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));
    await waitFor(() => expect(screen.getByDisplayValue("https://app.test/s/xyz123")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @wcl/web test -- src/components/PublishShare.test.tsx`
Expected: FAIL (no `./PublishShare`).

- [ ] **Step 3: Implement `PublishShare`**

Create `apps/web/src/components/PublishShare.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import type { ReportData } from "@wcl/core";
import { publishSnapshot, shareUrl } from "../lib/share";
import { buildShareMessage, postToDiscord } from "../lib/discord";
import { loadWebhookUrl } from "../lib/storage";

type Status = "idle" | "publishing" | "ready" | "error";

export function PublishShare({ report }: { report: ReportData }) {
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const webhookUrl = loadWebhookUrl();

  async function onPublish() {
    setStatus("publishing"); setMessage("");
    try {
      const id = await publishSnapshot(report);
      setUrl(shareUrl(id));
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Publish failed.");
    }
  }

  async function onCopy() {
    await navigator.clipboard.writeText(url);
    setMessage("Link copied.");
  }

  async function onPostDiscord() {
    if (!webhookUrl) return;
    try {
      await postToDiscord(webhookUrl, buildShareMessage({
        title: report.title, zoneName: report.zoneName, link: url,
      }));
      setMessage("Posted to Discord.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to post.");
    }
  }

  if (status !== "ready") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn-outline" onClick={onPublish} disabled={status === "publishing"}>
          {status === "publishing" ? "Publishing…" : "Publish & share"}
        </button>
        {status === "error" && <span role="status" className="sev-major">{message}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input readOnly value={url} aria-label="Shareable link" style={{ minWidth: 240 }} />
      <button className="btn-outline" onClick={onCopy}>Copy link</button>
      {webhookUrl
        ? <button className="btn-outline" onClick={onPostDiscord}>Post to Discord</button>
        : <span className="navitem--disabled"><Link to="/settings">Set a webhook</Link> to post</span>}
      {message && <span role="status" className="sev-ok">{message}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `ReportPage` (if Task 9 used a placeholder)**

Ensure `ReportPage.tsx` passes `shareActions={<PublishShare report={result.data} />}` (see Task 9 Step 4).

- [ ] **Step 5: Run the web suite**

Run: `pnpm --filter @wcl/web test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/PublishShare.tsx apps/web/src/components/PublishShare.test.tsx apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): Publish & share action posts key-free snapshot links"
```

---

### Task 11: Key-free viewer route `/s/:shareId`

**Files:**
- Create: `apps/web/src/pages/SharedReportPage.tsx`
- Modify: `apps/web/src/App.tsx` (add the route)
- Test: `apps/web/src/pages/SharedReportPage.test.tsx`

**Interfaces:**
- Consumes: `fetchSnapshot` (Task 8), `ReportView` (Task 9).
- Produces: a route `"/s/:shareId"` that loads a snapshot and renders `ReportView` read-only — **no `onRefresh`, no `shareActions`, no WCL calls, no key prompt**.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/SharedReportPage.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SharedReportPage } from "./SharedReportPage";
import type { ReportData } from "@wcl/core";

const snapshot = {
  reportId: "abc", title: "Shared T5", zoneName: "Karazhan", startTime: 0,
  players: [], fights: [], schemaVersion: 1,
} as unknown as ReportData;

const fetchSnapshot = vi.fn().mockResolvedValue(snapshot);
vi.mock("../lib/share", () => ({ fetchSnapshot: (id: string) => fetchSnapshot(id) }));

it("renders a snapshot without any WCL fetch or key prompt", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  render(
    <MemoryRouter initialEntries={["/s/xyz123"]}>
      <Routes><Route path="/s/:shareId" element={<SharedReportPage />} /></Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(fetchSnapshot).toHaveBeenCalledWith("xyz123"));
  expect(screen.queryByText(/WCL credentials/i)).not.toBeInTheDocument();
  // no direct WCL token/GraphQL calls from the shared view
  expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining("warcraftlogs.com"), expect.anything());
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @wcl/web test -- src/pages/SharedReportPage.test.tsx`
Expected: FAIL (no `./SharedReportPage`).

- [ ] **Step 3: Implement the viewer page**

Create `apps/web/src/pages/SharedReportPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { ReportData } from "@wcl/core";
import { fetchSnapshot } from "../lib/share";
import { ReportView } from "../components/report/ReportView";
import { LoadingNugget } from "../components/LoadingNugget";

export function SharedReportPage() {
  const { shareId = "" } = useParams();
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSnapshot(shareId)
      .then((d) => { if (alive) setReport(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Could not load shared report."); });
    return () => { alive = false; };
  }, [shareId]);

  if (error) return <div role="alert"><p>{error}</p><p><Link to="/">Go home</Link></p></div>;
  if (!report) return <LoadingNugget />;
  // read-only: no onRefresh, no shareActions → ReportView hides refresh/stale UI
  return <ReportView report={report} />;
}
```

- [ ] **Step 4: Register the route**

In `apps/web/src/App.tsx`, add the import and route:

```tsx
import { SharedReportPage } from "./pages/SharedReportPage";
```

```tsx
        <Route path="/s/:shareId" element={<SharedReportPage />} />
```

(Place it alongside the other `<Route>` entries inside `<Routes>`.)

- [ ] **Step 5: Run the web suite**

Run: `pnpm --filter @wcl/web test`
Expected: PASS.

- [ ] **Step 6: Manual smoke test (optional but recommended)**

```bash
pnpm --filter @wcl/api dev   # snapshot store on :8787
pnpm --filter @wcl/web dev   # vite proxies /api → :8787
```

Load a report with your key → "Publish & share" → open the `/s/<id>` link in a private window (no credentials) → the report renders with no key prompt and no Refresh button.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/SharedReportPage.tsx apps/web/src/pages/SharedReportPage.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): key-free /s/:shareId snapshot viewer route"
```

---

## Final verification

- [ ] Run both suites: `pnpm --filter @wcl/web test` and `pnpm --filter @wcl/api test` — all green.
- [ ] Build the web app: `pnpm --filter @wcl/web build` — no TypeScript errors.
- [ ] Update `TODO.md`: mark item (10) `[DONE]` and note the publish-snapshot sharing model + that production snapshot storage rides with #14.

---

## Self-review notes (coverage check against the spec)

- **§1 browser fetching** → Tasks 1, 2, 4, 5 (move client/normalize, loadReport, rewire api.ts). **Cache** → Task 3 + Task 5 wiring. **Backend removal** → Task 6. ✓
- **§2 credentials/webhook local** → satisfied by Task 5 (secret exchanged browser-side); webhook unchanged (still `localStorage` + browser→Discord). Settings copy already says "Stored only in this browser." ✓
- **§3 publish-to-share** → snapshot store (Task 7), web client (Task 8), publish UI + Discord wiring (Task 10), viewer route (Task 11), with ReportView extraction (Task 9) enabling read-only render. ✓
- **Staleness preserved** → Task 3 (`cachedAt`) + Task 5 (`isStaleSchema`) + Task 9 (stale banner shown only in live mode). ✓
- **Key-free guarantee** → Task 7 test asserts no credential fields in stored payload; Task 11 test asserts no WCL calls / no key prompt in the shared view. ✓
- **Open question (prod storage)** → Task 7 ships the swappable `ShareStore` interface + memory adapter; concrete backend deferred to #14, as agreed. ✓
