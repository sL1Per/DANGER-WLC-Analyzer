import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../test-utils/matchMedia";
import { ConsumablesView } from "./ConsumablesView";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    consumables: () => ({
      rows: [{
        playerId: 1, playerName: "Thrall", totalAverage: 0.9, elixirOrFlask: 1,
        battleElixir: 0, battleElixirNames: [], guardianElixir: 0, guardianElixirNames: [],
        flask: 1, flaskNames: ["Flask of Relentless Assault"], food: 1, scrolls: "",
        weaponEnhancement: 1, jcNeck: { equipped: false, usedOnFights: 0, inactiveOnFights: 0 },
        suboptimal: [],
      }],
    }),
  };
});

const report = { players: [{ id: 1, name: "Thrall", class: "Shaman" }] } as unknown as ReportData;
afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("ConsumablesView mobile", () => {
  it("renders cards on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<ConsumablesView report={report} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<ConsumablesView report={report} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
