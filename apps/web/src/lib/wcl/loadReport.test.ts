import { describe, expect, it, vi } from "vitest";

// Mock the whole WCL fetch layer so loadReport exercises only orchestration.
vi.mock("./wcl", () => ({
  WclError: class WclError extends Error { status: number; constructor(status: number, m: string) { super(m); this.status = status; } },
  fetchRawReport: vi.fn().mockResolvedValue({
    title: "T5 fun", startTime: 1, endTime: 2, zone: { name: "Karazhan" },
    fights: [], masterData: { actors: [], npcs: [] },
  }),
  fetchCombatantInfo: vi.fn().mockResolvedValue([]),
  fetchItemMeta: vi.fn().mockResolvedValue({}),
  fetchBuffEvents: vi.fn().mockResolvedValue([]),
  fetchCastEvents: vi.fn().mockResolvedValue([]),
  fetchDeaths: vi.fn().mockResolvedValue([]),
  fetchInterrupts: vi.fn().mockResolvedValue([]),
  fetchDamageTaken: vi.fn().mockResolvedValue([]),
  fetchDamageDone: vi.fn().mockResolvedValue([]),
  fetchHealingDone: vi.fn().mockResolvedValue([]),
  fetchAllCasts: vi.fn().mockResolvedValue([]),
  fetchTable: vi.fn().mockResolvedValue([]),
  fetchEnemyDebuffs: vi.fn().mockResolvedValue([]),
  fetchAbsorbs: vi.fn().mockResolvedValue([]),
  fetchRankings: vi.fn().mockResolvedValue([]),
}));

import { loadReport } from "./loadReport";
import { SCHEMA_VERSION } from "@wcl/core";

describe("loadReport", () => {
  it("normalizes a fetched report and stamps the current schema version", async () => {
    const data = await loadReport("a1B2c3D4e5F6g7H8", "tok");
    expect(data.reportId).toBe("a1B2c3D4e5F6g7H8");
    expect(data.title).toBe("T5 fun");
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("propagates a WclError when the primary report fetch fails", async () => {
    const wcl = await import("./wcl");
    (wcl.fetchRawReport as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new wcl.WclError(404, "Report not found"));
    await expect(loadReport("a1B2c3D4e5F6g7H8", "tok")).rejects.toMatchObject({ status: 404 });
  });
});
