import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { SummaryRankings } from "./SummaryRankings";

describe("SummaryRankings", () => {
  it("renders an Avg column and role group headers", () => {
    render(<SummaryRankings report={reportFixture} onPlayer={() => {}} />);
    expect(screen.getAllByText("Avg").length).toBeGreaterThan(0);
    expect(screen.getByText(/Damage Dealers/i)).toBeInTheDocument();
  });
  it("clicking a player name calls onPlayer", () => {
    const onPlayer = vi.fn();
    const report = reportFixture;
    render(<SummaryRankings report={report} onPlayer={onPlayer} />);
    const name = report.rankings![0].dps[0].name;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
    expect(onPlayer).toHaveBeenCalledWith(name);
  });
  it("shows the refresh notice when rankings are absent", () => {
    const report = { ...reportFixture, rankings: undefined };
    render(<SummaryRankings report={report} onPlayer={() => {}} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
