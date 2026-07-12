import type { KVNamespace } from "@cloudflare/workers-types";

// Storage seam for published, key-free report snapshots. A snapshot is an opaque
// gzip blob (the client compresses before upload — see apps/web/src/lib/share.ts).
// The in-memory adapter is for local dev; createKvShareStore is the deploy target.
export interface ShareStore {
  put(bytes: Uint8Array): Promise<string>;
  get(id: string): Promise<Uint8Array | null>;
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
// are an in-memory backstop — a real deploy should swap in the KV adapter.
export function createMemoryShareStore(opts: MemoryShareStoreOptions = {}): ShareStore {
  const maxEntries = opts.maxEntries ?? 1000;
  const ttlMs = opts.ttlMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days
  const now = opts.now ?? Date.now;
  const map = new Map<string, { bytes: Uint8Array; storedAt: number }>();
  return {
    async put(bytes) {
      const id = newShareId();
      map.set(id, { bytes, storedAt: now() });
      while (map.size > maxEntries) map.delete(map.keys().next().value as string);
      return id;
    },
    async get(id) {
      const entry = map.get(id);
      if (!entry) return null;
      if (now() - entry.storedAt > ttlMs) { map.delete(id); return null; }
      map.delete(id); map.set(id, entry); // refresh LRU recency
      return entry.bytes;
    },
  };
}

// 30 days — matches the memory store's default retention. Cloudflare KV's
// minimum expirationTtl is 60s, well under this.
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

// Cloudflare KV adapter for the Workers deploy. Stores the gzip blob as-is (KV's
// 25 MiB per-value ceiling is why the payload is compressed in the first place).
// KV gives native TTL expiry and automatic eviction — no LRU/TTL bookkeeping.
export function createKvShareStore(kv: KVNamespace, ttlSeconds = DEFAULT_TTL_SECONDS): ShareStore {
  return {
    async put(bytes) {
      const id = newShareId();
      await kv.put(id, bytes, { expirationTtl: ttlSeconds });
      return id;
    },
    async get(id) {
      const buf = await kv.get(id, "arrayBuffer");
      return buf ? new Uint8Array(buf) : null;
    },
  };
}
