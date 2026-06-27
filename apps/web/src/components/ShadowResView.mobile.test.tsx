import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../test-utils/matchMedia";
import { ShadowResView } from "./ShadowResView";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    shadowResistance: () => ({
      boss: "Mother Shahraz", availableBosses: ["Mother Shahraz"], isKill: true,
      players: [{ playerId: 1, name: "Thrall", total: 60, fromGear: 45, fromBuffs: 15, severity: "ok", slots: { 0: "Hood (~30 SR)" } }],
    }),
  };
});

const report = {} as unknown as ReportData;
afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("ShadowResView mobile", () => {
  it("renders cards on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<ShadowResView report={report} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<ShadowResView report={report} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
