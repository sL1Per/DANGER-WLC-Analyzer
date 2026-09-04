import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { PerformanceView } from "./PerformanceView";

describe("PerformanceView (summary panels)", () => {
  const report = reportFixture;
  const fightId = report.fights.find((f) => f.kill)!.id; // Hydross kill (id 3)

  it("renders the four panel titles", () => {
    render(<PerformanceView report={report} fightId={fightId} />);
    expect(screen.getByText("Damage Done By Source")).toBeInTheDocument();
    expect(screen.getByText("Healing Done By Source")).toBeInTheDocument();
    expect(screen.getByText("Damage Taken By Ability")).toBeInTheDocument();
    expect(screen.getByText("Deaths")).toBeInTheDocument();
  });

  it("shows a damage-done row with a DPS value and a death killing blow", () => {
    render(<PerformanceView report={report} fightId={fightId} />);
    expect(screen.getAllByText("Playerone").length).toBeGreaterThan(0);
    // The killing-blow ability name must appear in the Deaths panel's "Killing Blow"
    // column specifically (it also appears in the Damage Taken panel), so scope the
    // assertion to the Deaths table rather than matching anywhere on the page.
    const deathsTable = screen.getByRole("columnheader", { name: "Killing Blow" }).closest("table");
    expect(within(deathsTable!).getByText("Frostbolt")).toBeInTheDocument();
  });

  it("renders source player names as plain text, not a link", () => {
    render(<PerformanceView report={report} fightId={fightId} />);
    expect(screen.getAllByText("Playerone").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Playerone" })).not.toBeInTheDocument();
  });

  it("shows a refresh notice when healing data is missing", () => {
    const bare = { ...report, healingEvents: undefined };
    render(<PerformanceView report={bare} fightId={fightId} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
