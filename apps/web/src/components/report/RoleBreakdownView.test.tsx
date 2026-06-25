import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { RoleBreakdownView } from "./RoleBreakdownView";
import { reportFixture } from "@wcl/core";
import { ALL_FIGHTS, ALL_TRASH } from "../../lib/scopeReport";

function renderAt(fightId: number) {
  return render(
    <MemoryRouter>
      <RoleBreakdownView report={reportFixture} fightId={fightId} onPlayer={() => {}} />
    </MemoryRouter>,
  );
}

describe("RoleBreakdownView", () => {
  it("shows all 9 sub-tabs on the BOSSES card", () => {
    renderAt(ALL_FIGHTS);
    for (const t of [
      "Overview",
      "Tank",
      "Tank - Casts",
      "Healer",
      "Healer - Casts",
      "Caster",
      "Caster - Casts",
      "Physical",
      "Physical - Casts",
    ]) {
      expect(screen.getByRole("button", { name: t })).toBeInTheDocument();
    }
  });

  it("shows only Overview on the TRASH card", () => {
    renderAt(ALL_TRASH);
    expect(screen.getByRole("button", { name: "Overview" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tank - Casts" }),
    ).not.toBeInTheDocument();
  });

  it("defaults to the Overview sub-tab content", () => {
    renderAt(ALL_FIGHTS);
    // SummaryView renders role sections; fixture has Mage (caster) and Warrior (physical)
    // so at least one role heading should be present
    expect(screen.getByRole("button", { name: "Overview" })).toHaveClass("active");
  });

  it("shows only Overview button on a single-pull card", () => {
    // fight id 1 is a single boss pull in the fixture
    renderAt(1);
    expect(screen.getByRole("button", { name: "Overview" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tank" }),
    ).not.toBeInTheDocument();
  });
});
