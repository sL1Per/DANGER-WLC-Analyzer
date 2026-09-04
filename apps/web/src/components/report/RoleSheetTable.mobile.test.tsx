import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { RoleSheetTable } from "./RoleSheetTable";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    roleSheet: () => ([
      {
        playerId: 1, playerName: "Thrall", className: "Shaman",
        battleShoutUptime: 0, demoShoutUptime: 0, demoShoutCasts: 0,
        exposeArmorUptime: 0, exposeArmorCasts: 0,
        hitStats: undefined, trinketUses: [], avoidableByAbility: [],
        damageReflected: 0, damageToHostilePlayers: 0, friendlyFire: 0, deaths: 2,
        totalAvoidableDamageTaken: 5000, debuffsApplied: [],
      },
    ]),
  };
});

const report = { fights: [] } as unknown as ReportData;
afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("RoleSheetTable mobile", () => {
  it("renders one card per player on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<RoleSheetTable report={report} fightId={0} role="tank" />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<RoleSheetTable report={report} fightId={0} role="tank" />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
