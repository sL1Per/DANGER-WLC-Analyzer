import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { SummaryRankings } from "./SummaryRankings";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    buildRankingsGrid: () => ({
      bosses: [{ fightID: 1, name: "Najentus" }],
      sections: [{
        role: "dps",
        players: [{ name: "Thrall", class: "Shaman", overall: 95, perBoss: { 1: { rankPercent: 95 } } }],
      }],
    }),
  };
});

const report = { rankings: {} } as unknown as ReportData;
afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("SummaryRankings mobile", () => {
  it("renders cards on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<SummaryRankings report={report} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<SummaryRankings report={report} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
