import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, isStaleSchema } from "./types";

describe("isStaleSchema", () => {
  it("treats the current version as fresh", () => {
    expect(isStaleSchema(SCHEMA_VERSION)).toBe(false);
  });

  it("treats an older/different version as stale", () => {
    expect(isStaleSchema(SCHEMA_VERSION - 1)).toBe(true);
  });

  it("treats a pre-versioning cache (undefined) as stale", () => {
    expect(isStaleSchema(undefined)).toBe(true);
  });
});
