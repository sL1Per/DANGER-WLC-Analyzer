import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { LensBar } from "./LensBar";
import { ALL_FIGHTS, ALL_TRASH } from "../lib/scopeReport";

function setup(over: Partial<ComponentProps<typeof LensBar>> = {}) {
  const report = reportFixture;
  const props = {
    report, fightId: report.fights.find((f) => f.isBoss)!.id,
    onFight: vi.fn(), ...over,
  };
  render(<LensBar {...props} />);
  return props;
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { expanded: false }));
}

describe("LensBar", () => {
  it("shows a BOSSES row first that selects all bosses combined", () => {
    const p = setup();
    openPicker();
    const rows = screen.getAllByTestId("picker-row");
    expect(rows[0]).toHaveTextContent("BOSSES");
    fireEvent.click(rows[0]);
    expect(p.onFight).toHaveBeenCalledWith(ALL_FIGHTS);
  });

  it("selects a fight row", () => {
    const p = setup();
    openPicker();
    const boss = p.report.fights.find((f) => f.isBoss)!;
    // reportFixture has two fights sharing this boss name (a wipe + a kill), and the
    // trigger already shows that same name (fightId starts on the first one) — scope
    // to the open listbox so we click a row, not the trigger behind it.
    fireEvent.click(within(screen.getByRole("listbox")).getAllByText(boss.name)[0]);
    expect(p.onFight).toHaveBeenCalledWith(boss.id);
  });

  it("shows a TRASH row that selects all trash combined", () => {
    const p = setup();
    openPicker();
    fireEvent.click(screen.getByText("TRASH"));
    expect(p.onFight).toHaveBeenCalledWith(ALL_TRASH);
  });

  it("omits the TRASH row when the report has no trash fights", () => {
    const bossOnly = { ...reportFixture, fights: reportFixture.fights.filter((f) => f.isBoss) };
    setup({ report: bossOnly });
    openPicker();
    expect(screen.queryByText("TRASH")).not.toBeInTheDocument();
  });

  it("closes the picker after selecting a fight", () => {
    const p = setup();
    openPicker();
    const boss = p.report.fights.find((f) => f.isBoss)!;
    fireEvent.click(within(screen.getByRole("listbox")).getAllByText(boss.name)[0]);
    expect(screen.queryAllByTestId("picker-row")).toHaveLength(0);
  });

  it("renders the actions slot", () => {
    setup({ actions: <button>Publish</button> });
    expect(screen.getByRole("button", { name: /publish/i })).toBeInTheDocument();
  });
});
