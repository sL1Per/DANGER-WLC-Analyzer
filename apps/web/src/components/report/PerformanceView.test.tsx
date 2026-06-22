import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { PerformanceView } from "./PerformanceView";

describe("PerformanceView", () => {
  const report = reportFixture;
  const fightId = report.fights.find((f) => f.isBoss)!.id;

  it("renders the column headers and at least one role section", () => {
    render(<PerformanceView report={report} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getAllByText("Deaths").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Avoidable dmg").length).toBeGreaterThan(0);
  });
  it("navigates on player click", () => {
    const onPlayer = vi.fn();
    render(<PerformanceView report={report} fightId={fightId} onPlayer={onPlayer} />);
    fireEvent.click(screen.getAllByRole("button", { name: report.players[0].name })[0]);
    expect(onPlayer).toHaveBeenCalled();
  });
  it("shows a refresh notice when RPB data is missing", () => {
    const bare = { ...report, playerTotals: undefined };
    render(<PerformanceView report={bare} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
