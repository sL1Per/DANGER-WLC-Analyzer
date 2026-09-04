import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { ConsumablesCategory } from "./ConsumablesCategory";

describe("ConsumablesCategory", () => {
  it("renders the consumable matrix for the scoped fight", () => {
    const report = reportFixture;
    const fightId = report.fights.find((f) => f.isBoss)!.id;
    render(<ConsumablesCategory report={report} fightId={fightId} />);
    // matrix renders a table; at least one consumable catalog label appears
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("shows the refresh notice when player casts are missing", () => {
    const report = { ...reportFixture, playerCasts: undefined };
    const fightId = report.fights.find((f) => f.isBoss)!.id;
    render(<ConsumablesCategory report={report} fightId={fightId} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
