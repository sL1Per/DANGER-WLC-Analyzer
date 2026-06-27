import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { RoleCastsTable } from "./RoleCastsTable";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    roleCasts: () => ([
      {
        className: "Shaman",
        players: [{ playerId: 1, playerName: "Thrall" }],
        abilities: [{ key: "lb", name: "Lightning Bolt", category: "single" }],
        counts: new Map([["1:lb", { castCount: 12 }]]),
        activity: new Map([[1, { secondsActiveST: 100, relativeActiveST: 0.8, relativeActiveTotal: 0.8, relativeActiveAoe: 0, secondsActiveAoe: 0 }]]),
      },
    ]),
  };
});

const report = { fights: [] } as unknown as ReportData;
afterEach(() => { delete (window as unknown as Record<string, unknown>).matchMedia; });

describe("RoleCastsTable mobile", () => {
  it("renders one card per player on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<RoleCastsTable report={report} fightId={0} role="caster" onPlayer={() => {}} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
    expect(screen.getByText(/Lightning Bolt/)).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<RoleCastsTable report={report} fightId={0} role="caster" onPlayer={() => {}} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
