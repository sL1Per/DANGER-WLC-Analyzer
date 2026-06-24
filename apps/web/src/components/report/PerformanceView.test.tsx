import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { PerformanceView } from "./PerformanceView";

describe("PerformanceView (summary panels)", () => {
  const report = reportFixture;
  const fightId = report.fights.find((f) => f.kill)!.id; // Hydross kill (id 3)

  it("renders the four panel titles", () => {
    render(<PerformanceView report={report} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getByText("Damage Done By Source")).toBeInTheDocument();
    expect(screen.getByText("Healing Done By Source")).toBeInTheDocument();
    expect(screen.getByText("Damage Taken By Ability")).toBeInTheDocument();
    expect(screen.getByText("Deaths")).toBeInTheDocument();
  });

  it("shows a damage-done row with a DPS value and a death killing blow", () => {
    render(<PerformanceView report={report} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getAllByText("Playerone").length).toBeGreaterThan(0);
    // The killing-blow ability name must appear in the Deaths panel's "Killing Blow"
    // column specifically (it also appears in the Damage Taken panel), so scope the
    // assertion to the Deaths table rather than matching anywhere on the page.
    const deathsTable = screen.getByRole("columnheader", { name: "Killing Blow" }).closest("table");
    expect(within(deathsTable!).getByText("Frostbolt")).toBeInTheDocument();
  });

  it("navigates on source player click", () => {
    const onPlayer = vi.fn();
    render(<PerformanceView report={report} fightId={fightId} onPlayer={onPlayer} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Playerone" })[0]);
    expect(onPlayer).toHaveBeenCalledWith("Playerone");
  });

  it("shows a refresh notice when healing data is missing", () => {
    const bare = { ...report, healingEvents: undefined };
    render(<PerformanceView report={bare} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
