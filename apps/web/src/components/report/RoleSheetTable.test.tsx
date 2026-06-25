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
 * Neither has hitStats or trinketUses by default, so those cells render "—".
 * roleSheet returns rows because the fixture has playerTotals.
 */

/** A fixture with per-fight hit counts for Playerone (id 1, caster) on a boss
 *  fight (id 3 = Hydross kill). roleSheet aggregates the scoped boss fights;
 *  outgoing crit = 35 of 100 → "35 (35%)". */
const reportWithHitStats: ReportData = {
  ...reportFixture,
  hitStatsByFight: [
    {
      playerId: 1,
      fightId: 3,
      outgoing: { hit: 65, crit: 35, dodge: 0, miss: 0, parry: 0, resist: 0 },
      incomingMelee: { hit: 97, crit: 0, crushing: 3, blocked: 0, dodge: 0, immune: 0, miss: 0, parry: 0 },
      heal: { hit: 80, crit: 20 },
      extraWindfury: 2,
      battleSquawk: 1,
    },
  ],
};

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

  it("renders all Stats & Misc columns including new ones when hitStats is present", () => {
    render(
      <RoleSheetTable
        report={reportWithHitStats}
        fightId={ALL_FIGHTS}
        role="caster"
        onPlayer={() => {}}
      />,
    );

    // Column headers for newly-added columns must be present
    expect(
      screen.getByText("# of extra Windfury Attacks"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("# of Battle Squawk buffs on bosses"),
    ).toBeInTheDocument();
    expect(screen.getByText("Crit Heals")).toBeInTheDocument();
    expect(screen.getByText("In: Blocked")).toBeInTheDocument();
    expect(screen.getByText("In: Dodge")).toBeInTheDocument();
    expect(screen.getByText("In: Immune")).toBeInTheDocument();
    expect(screen.getByText("In: Miss")).toBeInTheDocument();
    expect(screen.getByText("In: Parry")).toBeInTheDocument();

    // Outgoing crit cell: 35 hits at 35%
    expect(screen.getByText("35 (35%)")).toBeInTheDocument();

    // extraWindfury cell: integer 2
    expect(screen.getByText("2")).toBeInTheDocument();

    // battleSquawk cell: integer 1
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
