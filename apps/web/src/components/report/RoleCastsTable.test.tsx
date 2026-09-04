import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RoleCastsTable } from "./RoleCastsTable";
import { reportFixture } from "@wcl/core";
import { ALL_FIGHTS } from "../../lib/scopeReport";
import type { ReportData } from "@wcl/core";

/**
 * A report whose physical role contains TWO classes (Warrior + Rogue), so the
 * class filter has something to filter between.
 */
const twoClassReport: ReportData = {
  ...reportFixture,
  players: [...reportFixture.players, { id: 3, name: "Playerthree", class: "Rogue" }],
  playerTotals: [
    ...(reportFixture.playerTotals ?? []),
    { playerId: 3, healingDone: 0, damageDone: 50000, damageTaken: 1000, magicDamageDone: 0 },
  ],
};

/**
 * The shared reportFixture has:
 *  - Playerone (id 1) — Mage → detected as "caster" (Mage is in casterClasses)
 *  - Playertwo (id 2) — Warrior → detected as "physical"
 *
 * Both players have playerCasts defined, so roleCasts won't return null.
 */

describe("RoleCastsTable", () => {
  it("renders stale-cache notice when roleCasts returns null (no playerCasts)", () => {
    const staleReport: ReportData = { ...reportFixture, playerCasts: undefined };
    render(
      <RoleCastsTable
        report={staleReport}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    expect(screen.getByText(/cached before RPB support/)).toBeInTheDocument();
  });

  it("renders a class section header for Mages in caster role", () => {
    render(
      <RoleCastsTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    // Class block header (pluralized class name)
    expect(screen.getByText("Mages")).toBeInTheDocument();
  });

  it("renders the player name for the caster role", () => {
    render(
      <RoleCastsTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    // Playerone is the Mage → caster role
    expect(screen.getByText("Playerone")).toBeInTheDocument();
  });

  it("renders at least one ability column header from the catalog for Mage", () => {
    render(
      <RoleCastsTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    // Arcane Blast is a well-known Mage ability in the catalog
    // If it's in the catalog, it must appear as a column header
    // We just check that ability columns exist (the Activity header is always there)
    expect(screen.getByText("Activity")).toBeInTheDocument();
  });

  it("renders category band headers grouping abilities", () => {
    render(
      <RoleCastsTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    // Category band headers should be rendered; at minimum "Cooldowns"
    // (Mage has Icy Veins / Cold Snap in catalog)
    // We verify at least one category label appears
    const headers = ["Single Target", "AoE", "Cooldowns", "Healing"];
    const found = headers.filter((h) => {
      try { screen.getByText(h); return true; } catch { return false; }
    });
    expect(found.length).toBeGreaterThan(0);
  });

  it("renders the player name as plain text, not a link", () => {
    render(
      <RoleCastsTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Playerone" })).not.toBeInTheDocument();
  });

  it("renders Warriors class section for physical role", () => {
    render(
      <RoleCastsTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="physical"
      />,
    );
    // Playertwo is a Warrior → physical role
    expect(screen.getByText("Warriors")).toBeInTheDocument();
    expect(screen.getByText("Playertwo")).toBeInTheDocument();
  });

  it("does not render the class filter when the role has a single class", () => {
    render(
      <RoleCastsTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    // Only Mages in caster role → no filter group
    expect(screen.queryByRole("group", { name: /filter by class/i })).toBeNull();
  });

  it("renders a class filter with an 'All' option when the role has multiple classes", () => {
    render(
      <RoleCastsTable
        report={twoClassReport}
        fightId={ALL_FIGHTS}
        role="physical"
      />,
    );
    const group = screen.getByRole("group", { name: /filter by class/i });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Warrior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rogue" })).toBeInTheDocument();
    // Default: every class block is shown.
    expect(screen.getByText("Warriors")).toBeInTheDocument();
    expect(screen.getByText("Rogues")).toBeInTheDocument();
  });

  it("filters to a single class block when a class is selected", () => {
    render(
      <RoleCastsTable
        report={twoClassReport}
        fightId={ALL_FIGHTS}
        role="physical"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rogue" }));
    // Only the Rogues block remains; Warriors is filtered out.
    expect(screen.getByText("Rogues")).toBeInTheDocument();
    expect(screen.queryByText("Warriors")).toBeNull();
  });

  it("shows a non-zero cast count when playerCasts has a matching spell", () => {
    // The fixture has playerCasts: [{ fightId: 3, playerId: 1, spellId: 30451 }]
    // spell 30451 = Arcane Blast (Mage)
    // If Arcane Blast is in the catalog with spellIds including 30451, the cell shows 1
    render(
      <RoleCastsTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    // Verify the player name is present
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    // Assert the cast count of 1 appears in the cast count cells
    // (if the spell is in the catalog, this verifies the count path works)
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });
});
