import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { SummaryRankings } from "./SummaryRankings";

describe("SummaryRankings", () => {
  it("renders an Avg column and role group headers", () => {
    render(<SummaryRankings report={reportFixture} />);
    expect(screen.getAllByText("Avg").length).toBeGreaterThan(0);
    expect(screen.getByText(/Damage Dealers/i)).toBeInTheDocument();
  });
  it("renders player names as plain text, not a link", () => {
    const report = reportFixture;
    render(<SummaryRankings report={report} />);
    const name = report.rankings![0].dps[0].name;
    expect(screen.getByText(new RegExp(name))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(name) })).not.toBeInTheDocument();
  });
  it("shows the refresh notice when rankings are absent", () => {
    const report = { ...reportFixture, rankings: undefined };
    render(<SummaryRankings report={report} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
