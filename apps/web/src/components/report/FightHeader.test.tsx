import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { FightHeader } from "./FightHeader";

describe("FightHeader", () => {
  const report = reportFixture;
  const fight = report.fights.find((f) => f.isBoss)!;

  it("shows the boss name, outcome, and the four overview stats", () => {
    render(<FightHeader report={report} fightId={fight.id} />);
    expect(screen.getByRole("heading", { name: fight.name })).toBeInTheDocument();
    expect(screen.getByText(fight.kill ? "Kill" : "Wipe")).toBeInTheDocument();
    for (const label of ["Duration", "Deaths", "Under-consumed", "Gear flags"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("formats the duration as m:ss", () => {
    render(<FightHeader report={report} fightId={fight.id} />);
    expect(screen.getByText(/^\d+:\d{2}$/)).toBeInTheDocument();
  });
});
