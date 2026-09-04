import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

describe("ConsumablesView", () => {
  it("renders one row per player with uptimes", () => {
    render(<ConsumablesView report={baseReport()} />);
    const row = screen.getByText("Playerone").closest("tr")!;
    const cells = [...row.querySelectorAll("td")];
    expect(cells[1]!.textContent).toBe("100%"); // total average: (elixirOrFlask 1 + food 1) / 2, count-based
    expect(cells[2]!.textContent).toBe("100%"); // Elixir or Flask
    expect(cells[2]!.className).toContain("sev-minor");
    expect(cells[8]!.textContent).toBe("Flask of Relentless Assault"); // Flask name
    expect(screen.getByText("Playertwo")).toBeTruthy();
  });
  it("renders '-' for Weapon Enhancement when a player has no gear snapshots", () => {
    const report = baseReport();
    report.gear = report.gear.filter((s) => s.playerId !== 2);
    render(<ConsumablesView report={report} />);
    const row = screen.getByText("Playertwo").closest("tr")!;
    const cells = [...row.querySelectorAll("td")];
    expect(cells[11]!.textContent).toBe("-"); // Weapon Enhancement
    expect(cells[11]!.className).not.toContain("sev-"); // no severity color for missing data
  });
  it("shows a refresh notice for reports cached before consumable support", () => {
    const report = baseReport();
    delete report.buffs;
    render(<ConsumablesView report={report} />);
    expect(screen.getByText(/cached before consumable support/i)).toBeTruthy();
  });
  it("color-codes low uptimes as major", () => {
    render(<ConsumablesView report={baseReport()} />);
    const row = screen.getByText("Playertwo").closest("tr")!;
    const cells = [...row.querySelectorAll("td")];
    expect(cells[9]!.textContent).toBe("0%"); // Food Buff
    expect(cells[9]!.className).toContain("sev-major");
  });
  it("renders the player name as plain text, not a link", () => {
    render(<ConsumablesView report={baseReport()} />);
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Playerone" })).not.toBeInTheDocument();
  });
  it("colors each player name cell by class", () => {
    render(<ConsumablesView report={baseReport()} />);
    const nameCell = screen.getByText("Playerone").closest("td")!;
    expect(nameCell.className).toContain("player-cell");
    expect(nameCell.style.getPropertyValue("--class-color")).toBe("var(--cc-mage)");
  });
});
