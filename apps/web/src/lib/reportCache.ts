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
