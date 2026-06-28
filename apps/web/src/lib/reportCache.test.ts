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
