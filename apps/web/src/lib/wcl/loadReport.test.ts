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

  it("scopes boss-only fetchers to boss fight ids and all-fights fetchers to all fight ids", async () => {
    const wcl = await import("./wcl");
    // Clear call history from previous tests so assertions below reflect only this call.
    vi.clearAllMocks();

    const bossFight = { id: 1, name: "Attumen the Huntsman", encounterID: 611, kill: true,
      startTime: 0, endTime: 1000, friendlyPlayers: [] };
    const trashFight = { id: 2, name: "Trash", encounterID: 0, kill: null as null,
      startTime: 1000, endTime: 2000, friendlyPlayers: [] };

    (wcl.fetchRawReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      title: "T5 fun", startTime: 1, endTime: 2,
      zone: { name: "Karazhan" },
      fights: [bossFight, trashFight],
      masterData: { actors: [], npcs: [] },
    });

    await loadReport("a1B2c3D4e5F6g7H8", "tok");

    const bossFightIds = [1];
    const allFightIds = [1, 2];

    // --- Boss-scoped fetchers must receive ONLY boss fight ids ---
    // fetchCombatantInfo(code, token, fightIds)
    const combatantCalls = (wcl.fetchCombatantInfo as ReturnType<typeof vi.fn>).mock.calls;
    expect(combatantCalls).toHaveLength(1);
    expect(combatantCalls[0]![2]).toEqual(bossFightIds);

    // fetchTable(code, token, type, fightIds) — called once per table type (DamageDone, Healing, DamageTaken)
    const tableCalls = (wcl.fetchTable as ReturnType<typeof vi.fn>).mock.calls;
    expect(tableCalls).toHaveLength(3);
    for (const call of tableCalls) {
      expect(call[3]).toEqual(bossFightIds);
    }

    // fetchRankings must be called (hasBoss = true)
    expect(wcl.fetchRankings as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();

    // --- All-fights fetchers must receive ALL fight ids ---
    // fetchInterrupts(code, token, fightIds)
    const intCalls = (wcl.fetchInterrupts as ReturnType<typeof vi.fn>).mock.calls;
    expect(intCalls).toHaveLength(1);
    expect(intCalls[0]![2]).toEqual(allFightIds);

    // fetchDamageTaken(code, token, fightIds)
    const dtCalls = (wcl.fetchDamageTaken as ReturnType<typeof vi.fn>).mock.calls;
    expect(dtCalls).toHaveLength(1);
    expect(dtCalls[0]![2]).toEqual(allFightIds);

    // fetchDamageDone(code, token, fightIds)
    const ddCalls = (wcl.fetchDamageDone as ReturnType<typeof vi.fn>).mock.calls;
    expect(ddCalls).toHaveLength(1);
    expect(ddCalls[0]![2]).toEqual(allFightIds);

    // fetchAllCasts(code, token, fightIds)
    const acCalls = (wcl.fetchAllCasts as ReturnType<typeof vi.fn>).mock.calls;
    expect(acCalls).toHaveLength(1);
    expect(acCalls[0]![2]).toEqual(allFightIds);

    // fetchEnemyDebuffs(code, token, fightIds)
    const edCalls = (wcl.fetchEnemyDebuffs as ReturnType<typeof vi.fn>).mock.calls;
    expect(edCalls).toHaveLength(1);
    expect(edCalls[0]![2]).toEqual(allFightIds);

    // fetchHealingDone(code, token, fightIds)
    const hdCalls = (wcl.fetchHealingDone as ReturnType<typeof vi.fn>).mock.calls;
    expect(hdCalls).toHaveLength(1);
    expect(hdCalls[0]![2]).toEqual(allFightIds);
  });

  it("logs a rejected best-effort fetch instead of silently degrading to empty data", async () => {
    const wcl = await import("./wcl");
    vi.clearAllMocks();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    (wcl.fetchRawReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      title: "T5 fun", startTime: 1, endTime: 2, zone: { name: "Karazhan" },
      fights: [{ id: 1, name: "Attumen the Huntsman", encounterID: 611, kill: true,
        startTime: 0, endTime: 1000, friendlyPlayers: [] }],
      masterData: { actors: [], npcs: [] },
    });
    (wcl.fetchRankings as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new wcl.WclError(500, "This report's rankings could not be computed"));

    const data = await loadReport("a1B2c3D4e5F6g7H8", "tok");

    expect(data.rankings).toEqual([]); // still degrades gracefully, not a thrown error
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("rankings"),
      expect.objectContaining({ message: "This report's rankings could not be computed" }),
    );
    warnSpy.mockRestore();
  });
});
