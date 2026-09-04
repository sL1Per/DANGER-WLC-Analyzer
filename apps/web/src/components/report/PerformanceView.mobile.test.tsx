import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { PerformanceView } from "./PerformanceView";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    performanceSummary: () => ({
      damageBySource: [{ id: 1, name: "Thrall", className: "Shaman", percent: 0.5, amount: 100000, perSecond: 2500 }],
      healingBySource: [],
      damageTakenByAbility: [],
      deaths: [],
    }),
  };
});

const report = { fights: [] } as unknown as ReportData;
afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("PerformanceView mobile", () => {
  it("renders cards on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<PerformanceView report={report} fightId={0} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders tables on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<PerformanceView report={report} fightId={0} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
