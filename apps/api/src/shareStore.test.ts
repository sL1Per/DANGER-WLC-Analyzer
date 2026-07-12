import { describe, expect, it } from "vitest";
import type { KVNamespace } from "@cloudflare/workers-types";
import { createMemoryShareStore, createKvShareStore } from "./shareStore";

const bytes = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null);

// Minimal in-memory stand-in for the put/get(arrayBuffer) surface the adapter uses.
function fakeKv() {
  const map = new Map<string, Uint8Array>();
  const ttls: Record<string, number | undefined> = {};
  const kv = {
    put: async (k: string, v: Uint8Array, opts?: { expirationTtl?: number }) => {
      map.set(k, v);
      ttls[k] = opts?.expirationTtl;
    },
    get: async (k: string, _type: "arrayBuffer") => {
      const v = map.get(k);
      return v ? v.buffer : null;
    },
  } as unknown as KVNamespace;
  return { kv, ttls };
}

describe("createMemoryShareStore", () => {
  it("round-trips a snapshot under a generated id", async () => {
    const store = createMemoryShareStore();
    const id = await store.put(bytes("hello"));
    expect(typeof id).toBe("string");
    expect(text(await store.get(id))).toBe("hello");
  });
  it("returns null for an unknown id", async () => {
    expect(await createMemoryShareStore().get("nope")).toBeNull();
  });

  it("evicts the least-recently-used entry past maxEntries", async () => {
    const store = createMemoryShareStore({ maxEntries: 2 });
    const a = await store.put(bytes("a"));
    const b = await store.put(bytes("b"));
    const c = await store.put(bytes("c")); // overflow → evicts a

    expect(await store.get(a)).toBeNull();
    expect(text(await store.get(b))).toBe("b");
    expect(text(await store.get(c))).toBe("c");
  });

  it("a get refreshes recency so the next eviction drops the other entry", async () => {
    const store = createMemoryShareStore({ maxEntries: 2 });
    const a = await store.put(bytes("a"));
    const b = await store.put(bytes("b"));
    await store.get(a); // touch a → b is now least-recently-used
    const c = await store.put(bytes("c")); // evicts b

    expect(text(await store.get(a))).toBe("a");
    expect(await store.get(b)).toBeNull();
    expect(text(await store.get(c))).toBe("c");
  });

  it("returns null for entries older than ttlMs", async () => {
    let t = 1000;
    const store = createMemoryShareStore({ ttlMs: 100, now: () => t });
    const id = await store.put(bytes("x"));
    t = 1050;
    expect(text(await store.get(id))).toBe("x"); // within TTL
    t = 1200;
    expect(await store.get(id)).toBeNull(); // expired
  });
});

describe("createKvShareStore", () => {
  it("round-trips a snapshot under a generated id", async () => {
    const { kv } = fakeKv();
    const store = createKvShareStore(kv);
    const id = await store.put(bytes("hello"));
    expect(typeof id).toBe("string");
    expect(text(await store.get(id))).toBe("hello");
  });

  it("returns null for an unknown id", async () => {
    const { kv } = fakeKv();
    expect(await createKvShareStore(kv).get("nope")).toBeNull();
  });

  it("writes with an expirationTtl so KV evicts stale snapshots", async () => {
    const { kv, ttls } = fakeKv();
    const id = await createKvShareStore(kv, 123).put(bytes("x"));
    expect(ttls[id]).toBe(123);
  });
});
