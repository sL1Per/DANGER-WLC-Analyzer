import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import { reportFixture, type ReportData } from "@wcl/core";
import { ConsumablesView } from "./ConsumablesView";

afterEach(cleanup);

/** Same trick as the core tests: keep fight 3 as the only boss fight so the
 * fixture's buff intervals (all on fight 3) yield undiluted uptimes. */
function baseReport(): ReportData {
  const report = structuredClone(reportFixture);
  report.fights = report.fights.filter((f) => !f.isBoss || f.id === 3);
  return report;
}

/** Players are columns (angled headers); metrics are rows. Find the cell for a
 * given player under a given row label by matching column position. */
function cellFor(container: HTMLElement, playerName: string, rowLabel: string): HTMLElement {
  const headerCells = [...container.querySelectorAll("thead th.player-col")];
  const colIndex = headerCells.findIndex((h) => h.textContent?.trim() === playerName);
  expect(colIndex).toBeGreaterThanOrEqual(0);
  const row = screen.getByText(rowLabel).closest("tr")!;
  return row.querySelectorAll("td")[colIndex] as HTMLElement;
}

describe("ConsumablesView", () => {
  it("renders one column per player with uptimes", () => {
    const { container } = render(<ConsumablesView report={baseReport()} />);
    const total = cellFor(container, "Playerone", "total average (excl. Scrolls)");
    expect(total.textContent).toBe("100%"); // total average: (elixirOrFlask 1 + food 1) / 2, count-based
    const elixirOrFlask = cellFor(container, "Playerone", "Elixir or Flask");
    expect(elixirOrFlask.textContent).toBe("100%");
    expect(elixirOrFlask.className).toContain("sev-minor");
    expect(screen.getByText("Playertwo")).toBeTruthy();
  });
  it("does not render separate 'name' rows or a suboptimal row (moved into the cell-click modal / Improvements tab)", () => {
    render(<ConsumablesView report={baseReport()} />);
    expect(screen.queryByText(/flask name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/battle elixir name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/guardian elixir name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/suboptimal/i)).not.toBeInTheDocument();
  });
  it("makes a value cell clickable when the player has a named consumable, revealing the name(s) in a modal", () => {
    const { container } = render(<ConsumablesView report={baseReport()} />);
    const flaskCell = cellFor(container, "Playerone", "Flask");
    const button = flaskCell.querySelector(".cell-btn") as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe("100%"); // the value itself is unchanged, just wrapped
    fireEvent.click(button!);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Flask of Relentless Assault")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("leaves a value cell as plain, non-interactive text when the player has no named consumable for that row", () => {
    const { container } = render(<ConsumablesView report={baseReport()} />);
    const battleElixirCell = cellFor(container, "Playerone", "Battle Elixir"); // Playerone flasks, no battle elixir
    expect(battleElixirCell.querySelector(".cell-btn")).toBeNull();
    expect(battleElixirCell.textContent).toBe("0%");
  });
  it("shows only the percentage on the Scrolls cell — the type breakdown lives in the click-through modal", () => {
    const report = baseReport();
    report.gear.find((s) => s.playerId === 1)!.auras!.push(33077); // Scroll of Agility V
    const { container } = render(<ConsumablesView report={report} />);
    const cell = cellFor(container, "Playerone", "Scrolls");
    const button = cell.querySelector(".cell-btn") as HTMLButtonElement;
    expect(button.textContent).toBe("100%"); // not "100% (Agi)"

    fireEvent.click(button);
    expect(within(screen.getByRole("dialog")).getByText("Scroll of Agility V")).toBeInTheDocument();
  });
  it("renders '-' for Weapon Enhancement when a player has no gear snapshots", () => {
    const report = baseReport();
    report.gear = report.gear.filter((s) => s.playerId !== 2);
    const { container } = render(<ConsumablesView report={report} />);
    const cell = cellFor(container, "Playertwo", "Weapon Enhancement");
    expect(cell.textContent).toBe("-");
    expect(cell.className).not.toContain("sev-"); // no severity color for missing data
  });
  it("shows a refresh notice for reports cached before consumable support", () => {
    const report = baseReport();
    delete report.buffs;
    render(<ConsumablesView report={report} />);
    expect(screen.getByText(/cached before consumable support/i)).toBeTruthy();
  });
  it("color-codes low uptimes as major", () => {
    const { container } = render(<ConsumablesView report={baseReport()} />);
    const cell = cellFor(container, "Playertwo", "Food Buff");
    expect(cell.textContent).toBe("0%");
    expect(cell.className).toContain("sev-major");
  });
  it("renders the player name as plain text, not a link", () => {
    render(<ConsumablesView report={baseReport()} />);
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Playerone" })).not.toBeInTheDocument();
  });
  it("colors each player column header by class", () => {
    render(<ConsumablesView report={baseReport()} />);
    const headerCell = screen.getByText("Playerone").closest("th")!;
    expect(headerCell.className).toContain("player-col");
    expect(headerCell.style.getPropertyValue("--class-color")).toBe("var(--cc-mage)");
  });
});
