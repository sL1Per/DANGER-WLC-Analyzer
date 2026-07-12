import type { KVNamespace } from "@cloudflare/workers-types";
import type { ReportData } from "@wcl/core";

// Storage seam for published, key-free report snapshots. The in-memory adapter
// is for local dev; swap createMemoryShareStore for a serverless KV/file/DB
// adapter at deploy time (TODO #14) without touching the HTTP layer.
export interface ShareStore {
  put(data: ReportData): Promise<string>;
  get(id: string): Promise<ReportData | null>;
}

// Web-standard UUID; available as a global in both Node 20+ and the Workers
// runtime, so neither adapter needs node:crypto (and no nodejs_compat flag).
function newShareId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export interface MemoryShareStoreOptions {
  /** Hard cap on retained snapshots; the least-recently-used entry is evicted past it. */
  maxEntries?: number;
  /** Entries older than this (ms) are treated as absent and dropped on read. */
  ttlMs?: number;
  /** Clock seam for deterministic TTL tests. */
  now?: () => number;
}

// Bounded so an unauthenticated, unbounded /api/share cannot exhaust process
// memory: a Map is insertion-ordered, so the first key is the LRU entry; a get
// re-inserts to refresh recency. TTL caps how long any snapshot survives. These
// are an in-memory backstop — a real deploy should swap in a KV adapter (TODO #14).
export function createMemoryShareStore(opts: MemoryShareStoreOptions = {}): ShareStore {
  const maxEntries = opts.maxEntries ?? 1000;
  const ttlMs = opts.ttlMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days
  const now = opts.now ?? Date.now;
  const map = new Map<string, { data: ReportData; storedAt: number }>();
  return {
    async put(data) {
      const id = newShareId();
      map.set(id, { data, storedAt: now() });
      while (map.size > maxEntries) map.delete(map.keys().next().value as string);
      return id;
    },
    async get(id) {
      const entry = map.get(id);
      if (!entry) return null;
      if (now() - entry.storedAt > ttlMs) { map.delete(id); return null; }
      map.delete(id); map.set(id, entry); // refresh LRU recency
      return entry.data;
    },
  };
}

// 30 days — matches the memory store's default retention. Cloudflare KV's
// minimum expirationTtl is 60s, well under this.
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

// Cloudflare KV adapter for the Workers deploy. KV gives native TTL expiry and
// automatic eviction, so the LRU/TTL bookkeeping the memory store carries is
// gone — put/get is all that's left. Bind a namespace as SHARE_KV (wrangler).
export function createKvShareStore(kv: KVNamespace, ttlSeconds = DEFAULT_TTL_SECONDS): ShareStore {
  return {
    async put(data) {
      const id = newShareId();
      await kv.put(id, JSON.stringify(data), { expirationTtl: ttlSeconds });
      return id;
    },
    async get(id) {
      return (await kv.get(id, "json")) as ReportData | null;
    },
  };
}
