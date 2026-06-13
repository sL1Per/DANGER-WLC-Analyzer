import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { reportFixture, type ReportData } from "@wcl/core";
import { ShadowResView } from "./ShadowResView";

afterEach(cleanup);

/** self-contained report with a Mother Shahraz kill + one geared player. */
function srReport(): ReportData {
  return {
    reportId: "sr", title: "BT", zoneName: "Black Temple",
    startTime: 0, endTime: 1_000_000,
    fights: [{ id: 60, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: true, startTime: 0, endTime: 100 }],
    players: [{ id: 2, name: "Playertwo", class: "Priest" }],
    gear: [{ fightId: 60, playerId: 2, auras: [], items: [{ slot: 1, itemId: 34204, gemIds: [] }] }],
    itemMeta: { "34204": { name: "Pendant of Shadow's End" } },
  };
}

describe("ShadowResView", () => {
  it("renders per-player SR rows for the SR boss", () => {
    render(<ShadowResView report={srReport()} />);
    expect(screen.getByText("Playertwo")).toBeTruthy();
    expect(screen.getByText(/SR from gear \+ buffs/i)).toBeTruthy();
  });
  it("shows a notice when the report has no SR bosses", () => {
    render(<ShadowResView report={reportFixture} />); // fixture has no SR boss
    expect(screen.getByText(/no shadow-resistance boss/i)).toBeTruthy();
  });
});
