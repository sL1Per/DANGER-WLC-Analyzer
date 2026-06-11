import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
  it("stores and returns entries with their timestamp", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    expect(cache.get("k")?.value).toBe("v");
    expect(cache.get("k")?.cachedAt).toBeTypeOf("number");
  });
  it("expires entries after the ttl", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    vi.advanceTimersByTime(1001);
    expect(cache.get("k")).toBeUndefined();
    vi.useRealTimers();
  });
  it("delete removes an entry (manual refresh)", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    cache.delete("k");
    expect(cache.get("k")).toBeUndefined();
  });
});
