import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { FlagsView } from "./FlagsView";
import { ALL_FIGHTS } from "../../lib/scopeReport";

describe("FlagsView", () => {
  it("renders without crashing against the fixture report", () => {
    render(<FlagsView report={reportFixture} fightId={ALL_FIGHTS} onPlayer={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /flags/i })).toBeInTheDocument();
  });

  it("shows a clean-raid message when nobody is flagged", () => {
    // reportFixture may or may not have flaggable data — this test only
    // exercises the zero-flags branch by feeding an empty player list.
    const empty = { ...reportFixture, players: [] };
    render(<FlagsView report={empty} fightId={ALL_FIGHTS} onPlayer={vi.fn()} />);
    expect(screen.getByText(/no flags/i)).toBeInTheDocument();
  });
});
