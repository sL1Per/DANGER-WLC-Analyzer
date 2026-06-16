import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RpbRow } from "@wcl/core";
import { RpbRowsView } from "./RpbRowsView";

const base = (over: Partial<RpbRow>): RpbRow => ({
  playerId: 1, playerName: "Mageguy", className: "Mage", role: "caster",
  deaths: 0, interruptedSpells: 0, interruptSources: [], totalAbsorbed: 0,
  friendlyFire: 0, damageReflected: 0, damageToHostilePlayers: 0,
  totalAvoidableDamageTaken: 0, totalPartlyAvoidable: 0, classRows: [],
  engineeringDamage: 0, oilOfImmolationDamage: 0, battleShoutUptime: 1,
  activity: null, severity: "ok",
  ...over,
});

describe("RpbRowsView", () => {
  // the deaths cell is the 3rd column (player, role, deaths, ...)
  const deathsCell = (container: HTMLElement) =>
    container.querySelector("tbody tr td:nth-child(3)");

  it("renders a class band heading and a player row", () => {
    const groups = [{ className: "Mage", rows: [base({})] }];
    const { container } = render(<RpbRowsView groups={groups} onRoleChange={vi.fn()} />);
    expect(screen.getByText("Mage")).toBeInTheDocument(); // class band
    expect(screen.getByText("Mageguy")).toBeInTheDocument();
    // a death-free deaths cell is "good" (green = sev-minor)
    expect(deathsCell(container)).toHaveClass("sev-minor");
  });

  it("heatmaps a death as a problem (red = sev-major)", () => {
    const groups = [{ className: "Mage", rows: [base({ deaths: 2 })] }];
    const { container } = render(<RpbRowsView groups={groups} onRoleChange={vi.fn()} />);
    const cell = deathsCell(container);
    expect(cell).toHaveClass("sev-major");
    expect(cell?.textContent).toBe("2");
  });

  it("turns class abilities into columns", () => {
    const groups = [{
      className: "Mage",
      rows: [base({
        classRows: [{ key: "wc", name: "Winter's Chill", measure: "enemy-debuff-uptime", uptimePct: 0.95, rankFlag: false, verified: true, severity: "ok" }],
      })],
    }];
    render(<RpbRowsView groups={groups} onRoleChange={vi.fn()} />);
    expect(screen.getByRole("columnheader", { name: /Winter's Chill/ })).toBeInTheDocument();
  });
});
