import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { GearMatrix } from "./GearMatrix";

describe("GearMatrix", () => {
  it("renders the eight slot headers", () => {
    const report = reportFixture;
    const fightId = report.gear[0]?.fightId ?? report.fights.find((f) => f.isBoss)!.id;
    render(<GearMatrix report={report} fightId={fightId} onPlayer={() => {}} />);
    for (const label of ["Head", "Neck", "Shoulders", "Cloak", "Chest", "Hands", "Legs", "Weapon"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
