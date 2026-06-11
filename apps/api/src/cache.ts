export interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

/** In-memory TTL cache. Swappable for Cloudflare KV at deploy time (M6). */
export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  constructor(private ttlMs: number) {}

  get(key: string): CacheEntry<T> | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, cachedAt: Date.now() });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}
