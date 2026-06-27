import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { PlayerProfile } from "./PlayerProfile";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    rpb: () => ({ rows: [{ playerId: 1, role: "physical", deaths: 1, totalAvoidableDamageTaken: 0, interruptedSpells: 0, activity: { relativeActiveST: 0.9 } }] }),
    consumables: () => ({ rows: [] }),
    gearListing: () => ({ rows: [] }),
    gearIssues: () => ([]),
    listGearFights: () => ([{ id: 10 }]),
  };
});

const report = {
  players: [{ id: 1, name: "Thrall", class: "Shaman" }],
  fights: [{ id: 10, name: "Najentus", isBoss: true, kill: true, startTime: 0, endTime: 1000 }],
  gear: [],
} as unknown as ReportData;

afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("PlayerProfile mobile", () => {
  it("renders the per-boss breakdown as cards (no inner table) on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<PlayerProfile report={report} playerId={1} />);
    expect(container.querySelector(".profile .stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
  });

  it("renders the per-boss breakdown table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<PlayerProfile report={report} playerId={1} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
