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
  it("renders a class band heading and a player row", () => {
    const groups = [{ className: "Mage", rows: [base({})] }];
    render(<table><tbody /></table>); // ensure clean DOM
    const { container } = render(<RpbRowsView groups={groups} onRoleChange={vi.fn()} />);
    expect(screen.getByText("Mage")).toBeInTheDocument(); // class band
    expect(screen.getByText("Mageguy")).toBeInTheDocument();
    // a death-free cell is "good" (green = sev-minor)
    const deathCell = container.querySelector("td.sev-minor");
    expect(deathCell).not.toBeNull();
  });

  it("heatmaps a death as a problem (red = sev-major)", () => {
    const groups = [{ className: "Mage", rows: [base({ deaths: 2 })] }];
    const { container } = render(<RpbRowsView groups={groups} onRoleChange={vi.fn()} />);
    const bad = container.querySelector("td.sev-major");
    expect(bad?.textContent).toBe("2");
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
