import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RoleSheetTable } from "./RoleSheetTable";
import { reportFixture } from "@wcl/core";
import { ALL_FIGHTS } from "../../lib/scopeReport";
import type { ReportData } from "@wcl/core";

/**
 * The shared reportFixture has:
 *  - Playerone (id 1) — Mage → detected as "caster" (Mage is in casterClasses)
 *  - Playertwo (id 2) — Warrior → detected as "physical"
 *
 * Neither has hitStats or trinketUses, so those cells render "—".
 * roleSheet returns rows because the fixture has playerTotals.
 */

describe("RoleSheetTable", () => {
  it("renders a row per player in the role with a deaths cell header", () => {
    render(
      <RoleSheetTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="caster"
        onPlayer={() => {}}
      />,
    );
    // Playerone is the Mage → caster role
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    // Required by test spec
    expect(screen.getByText("# of deaths in total")).toBeInTheDocument();
  });

  it("renders the stale-cache notice when roleSheet returns null", () => {
    // A report without playerTotals triggers roleSheet → null
    const staleReport: ReportData = { ...reportFixture, playerTotals: undefined };
    render(
      <RoleSheetTable
        report={staleReport}
        fightId={ALL_FIGHTS}
        role="caster"
        onPlayer={() => {}}
      />,
    );
    expect(screen.getByText(/cached before RPB support/)).toBeInTheDocument();
  });

  it("calls onPlayer when a player name button is clicked", async () => {
    const onPlayer = vi.fn();
    render(
      <RoleSheetTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="physical"
        onPlayer={onPlayer}
      />,
    );
    // Playertwo (Warrior) is in the physical role
    screen.getByText("Playertwo").click();
    expect(onPlayer).toHaveBeenCalledWith("Playertwo");
  });
});
