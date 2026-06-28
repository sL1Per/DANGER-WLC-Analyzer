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

  it("evicts the least-recently-used entry past maxEntries", async () => {
    const store = createMemoryShareStore({ maxEntries: 2 });
    const a = await store.put({ reportId: "a" } as unknown as ReportData);
    const b = await store.put({ reportId: "b" } as unknown as ReportData);
    const c = await store.put({ reportId: "c" } as unknown as ReportData); // overflow → evicts a

    expect(await store.get(a)).toBeNull();
    expect((await store.get(b))?.reportId).toBe("b");
    expect((await store.get(c))?.reportId).toBe("c");
  });

  it("a get refreshes recency so the next eviction drops the other entry", async () => {
    const store = createMemoryShareStore({ maxEntries: 2 });
    const a = await store.put({ reportId: "a" } as unknown as ReportData);
    const b = await store.put({ reportId: "b" } as unknown as ReportData);
    await store.get(a); // touch a → b is now least-recently-used
    const c = await store.put({ reportId: "c" } as unknown as ReportData); // evicts b

    expect((await store.get(a))?.reportId).toBe("a");
    expect(await store.get(b)).toBeNull();
    expect((await store.get(c))?.reportId).toBe("c");
  });

  it("returns null for entries older than ttlMs", async () => {
    let t = 1000;
    const store = createMemoryShareStore({ ttlMs: 100, now: () => t });
    const id = await store.put(data);
    t = 1050;
    expect((await store.get(id))?.reportId).toBe("abc"); // within TTL
    t = 1200;
    expect(await store.get(id)).toBeNull(); // expired
  });
});
