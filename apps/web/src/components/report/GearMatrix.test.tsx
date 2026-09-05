import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { GearMatrix } from "./GearMatrix";
import { applyHideEmpty } from "../../lib/hideEmpty";

describe("GearMatrix", () => {
  it("renders all gear slot headers", () => {
    const report = reportFixture;
    const fightId = report.gear[0]?.fightId ?? report.fights.find((f) => f.isBoss)!.id;
    render(<GearMatrix report={report} fightId={fightId} />);
    for (const label of [
      "Head", "Neck", "Shoulders", "Cloak", "Chest", "Bracers", "Hands", "Waist", "Legs",
      "Ring1", "Ring2", "Trinket1", "Trinket2", "Weapon", "Off-Hand",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("orders players by class (Warrior before Mage)", () => {
    const report = reportFixture;
    const fightId = report.gear[0]?.fightId ?? report.fights.find((f) => f.isBoss)!.id;
    const { container } = render(<GearMatrix report={report} fightId={fightId} />);
    const names = [...container.querySelectorAll(".player-col__name")].map((el) => el.textContent);
    expect(names.indexOf("Playertwo")).toBeLessThan(names.indexOf("Playerone"));
  });

  it("opens a modal with issue details when a flagged item is clicked", () => {
    const report = reportFixture;
    const fightId = report.gear[0]?.fightId ?? report.fights.find((f) => f.isBoss)!.id;
    render(<GearMatrix report={report} fightId={fightId} />);

    const cell = document.querySelector(".cell-btn") as HTMLButtonElement | null;
    expect(cell).not.toBeNull();
    // Name is present (so "hide empty" doesn't treat the cell as empty) but visually hidden.
    const srName = cell!.querySelector(".sr-only");
    expect(srName).not.toBeNull();
    fireEvent.click(cell!);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(srName!.textContent!)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps filled gear cells visible when 'hide empty' is toggled on, since names are only visually hidden", () => {
    const report = reportFixture;
    const fightId = report.gear[0]?.fightId ?? report.fights.find((f) => f.isBoss)!.id;
    const { container } = render(<GearMatrix report={report} fightId={fightId} />);

    applyHideEmpty(container, true);

    const table = container.querySelector("table")!;
    expect(table.querySelectorAll("tbody tr:not(.eh-hidden)").length).toBeGreaterThan(0);
  });
});
