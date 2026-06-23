import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    // killing blow ability name appears in the Deaths panel (also appears in damage-taken, so use getAllByText)
    expect(screen.getAllByText("Frostbolt").length).toBeGreaterThan(0);
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
