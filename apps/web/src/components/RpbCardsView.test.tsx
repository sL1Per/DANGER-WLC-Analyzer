import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RpbRow } from "@wcl/core";
import { RpbCardsView } from "./RpbCardsView";

const base = (over: Partial<RpbRow>): RpbRow => ({
  playerId: 1, playerName: "Mageguy", className: "Mage", role: "caster",
  deaths: 0, interruptedSpells: 0, interruptSources: [], totalAbsorbed: 0,
  friendlyFire: 0, damageReflected: 0, damageToHostilePlayers: 0,
  totalAvoidableDamageTaken: 0, totalPartlyAvoidable: 0, classRows: [],
  engineeringDamage: 0, oilOfImmolationDamage: 0, battleShoutUptime: 1,
  activity: null, severity: "ok",
  ...over,
});

describe("RpbCardsView", () => {
  it("renders one card per player with name and class", () => {
    const groups = [{ className: "Mage", rows: [base({})] }];
    render(<RpbCardsView groups={groups} onRoleChange={vi.fn()} />);
    expect(screen.getByText("Mageguy")).toBeInTheDocument();
    expect(screen.getByText("Mage")).toBeInTheDocument();
  });

  it("surfaces a death as a red chip", () => {
    const groups = [{ className: "Mage", rows: [base({ deaths: 1 })] }];
    const { container } = render(<RpbCardsView groups={groups} onRoleChange={vi.fn()} />);
    const chip = container.querySelector(".pcard-chips .sev-major");
    expect(chip?.textContent).toMatch(/death/i);
  });

  it("lists class abilities on the card", () => {
    const groups = [{
      className: "Mage",
      rows: [base({
        classRows: [{ key: "wc", name: "Winter's Chill", measure: "enemy-debuff-uptime", uptimePct: 0.9, rankFlag: false, verified: true, severity: "ok" }],
      })],
    }];
    render(<RpbCardsView groups={groups} onRoleChange={vi.fn()} />);
    expect(screen.getByText(/Winter's Chill/)).toBeInTheDocument();
  });
});
