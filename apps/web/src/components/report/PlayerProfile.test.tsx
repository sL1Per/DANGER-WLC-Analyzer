import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { PlayerProfile } from "./PlayerProfile";

describe("PlayerProfile", () => {
  it("renders the player's name and the stat tiles", () => {
    const report = reportFixture;
    const player = report.players[0];
    render(<PlayerProfile report={report} playerId={player.id} />);
    expect(screen.getByRole("heading", { name: new RegExp(player.name) })).toBeInTheDocument();
    expect(screen.getAllByText(/Deaths/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gear flags/i).length).toBeGreaterThan(0);
  });
  it("shows a refresh notice when RPB data is missing", () => {
    const report = { ...reportFixture, playerTotals: undefined };
    render(<PlayerProfile report={report} playerId={report.players[0].id} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
