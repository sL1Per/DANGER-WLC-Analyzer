import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("orders players by class (Warrior before Mage)", () => {
    const report = reportFixture;
    const fightId = report.gear[0]?.fightId ?? report.fights.find((f) => f.isBoss)!.id;
    render(<GearMatrix report={report} fightId={fightId} onPlayer={() => {}} />);
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names.indexOf("Playertwo")).toBeLessThan(names.indexOf("Playerone"));
  });

  it("opens a modal with issue details when a flagged item is clicked", () => {
    const report = reportFixture;
    const fightId = report.gear[0]?.fightId ?? report.fights.find((f) => f.isBoss)!.id;
    render(<GearMatrix report={report} fightId={fightId} onPlayer={() => {}} />);

    const cell = document.querySelector(".gear-issue-cell") as HTMLButtonElement | null;
    expect(cell).not.toBeNull();
    fireEvent.click(cell!);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(cell!.textContent!)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
