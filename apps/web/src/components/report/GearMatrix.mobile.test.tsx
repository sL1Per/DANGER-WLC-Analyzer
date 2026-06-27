import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { GearMatrix } from "./GearMatrix";
import type { ReportData } from "@wcl/core";
import { ALL_FIGHTS } from "../../lib/scopeReport";

// Minimal report with one boss fight + one player + one gear snapshot.
const report = {
  reportId: "r1", title: "T", zoneName: "BT", startTime: 0,
  players: [{ id: 1, name: "Thrall", class: "Shaman" }],
  fights: [{ id: 10, name: "Najentus", isBoss: true, kill: true, startTime: 0, endTime: 1000 }],
  itemMeta: { "100": { name: "Helm" } },
  gear: [{ fightId: 10, playerId: 1, items: [{ itemId: 100, slot: 0 }] }],
} as unknown as ReportData;

afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("GearMatrix mobile", () => {
  it("renders stat cards (no table) on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<GearMatrix report={report} fightId={ALL_FIGHTS} onPlayer={() => {}} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table (no cards) on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<GearMatrix report={report} fightId={ALL_FIGHTS} onPlayer={() => {}} />);
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector(".stat-cards")).not.toBeInTheDocument();
  });
});
