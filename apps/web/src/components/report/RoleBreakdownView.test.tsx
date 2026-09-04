import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { RoleBreakdownView } from "./RoleBreakdownView";
import { reportFixture } from "@wcl/core";
import { ALL_FIGHTS, ALL_TRASH } from "../../lib/scopeReport";

const ROLE_TABS = ["Tanks", "Healers", "Casters", "Melee/Ranged"];

function renderAt(fightId: number, initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RoleBreakdownView report={reportFixture} fightId={fightId} />
    </MemoryRouter>,
  );
}

describe("RoleBreakdownView", () => {
  it("renders the By Stats / By Casts mode toggle", () => {
    renderAt(ALL_FIGHTS);
    expect(screen.getByRole("radio", { name: "By Stats" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "By Casts" })).toBeInTheDocument();
  });

  it("renders the four role tabs", () => {
    renderAt(ALL_FIGHTS);
    for (const t of ROLE_TABS) {
      expect(screen.getByRole("button", { name: t })).toBeInTheDocument();
    }
  });

  it("defaults to By Stats and Tank", () => {
    renderAt(ALL_FIGHTS);
    expect(screen.getByRole("radio", { name: "By Stats" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Tanks" })).toHaveClass("active");
  });

  it("honors mode and role from the URL", () => {
    renderAt(ALL_FIGHTS, ["/?mode=casts&role=healer"]);
    expect(screen.getByRole("radio", { name: "By Casts" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Healers" })).toHaveClass("active");
  });

  it("renders the same structure on the TRASH card and non-boss fights", () => {
    for (const fid of [ALL_TRASH, 1 /* Underbog Colossus, a trash fight */]) {
      const { unmount } = renderAt(fid);
      expect(screen.getByRole("radio", { name: "By Stats" })).toBeInTheDocument();
      for (const t of ROLE_TABS) {
        expect(screen.getByRole("button", { name: t })).toBeInTheDocument();
      }
      unmount();
    }
  });
});
