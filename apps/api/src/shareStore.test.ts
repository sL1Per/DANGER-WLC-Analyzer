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
