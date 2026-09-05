import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RoleSheetTable } from "./RoleSheetTable";
import { reportFixture } from "@wcl/core";
import { ALL_FIGHTS } from "../../lib/scopeReport";
import type { ReportData } from "@wcl/core";

/**
 * The shared reportFixture has:
 *  - Playerone (id 1) — Mage → detected as "caster" (Mage is in casterClasses)
 *  - Playertwo (id 2) — Warrior → detected as "physical"
 *
 * Neither has hitStats or trinketUses by default, so those cells render "—".
 * roleSheet returns rows because the fixture has playerTotals.
 */

/** A fixture with per-fight hit counts for Playerone (id 1, caster) on a boss
 *  fight (id 3 = Hydross kill). roleSheet aggregates the scoped boss fights;
 *  outgoing crit = 35 of 100 → "35 (35%)". */
const reportWithHitStats: ReportData = {
  ...reportFixture,
  hitStatsByFight: [
    {
      playerId: 1,
      fightId: 3,
      outgoing: { hit: 65, crit: 35, dodge: 0, miss: 0, parry: 0, resist: 0 },
      incomingMelee: { hit: 97, crit: 0, crushing: 3, blocked: 0, dodge: 0, immune: 0, miss: 0, parry: 0 },
      heal: { hit: 80, crit: 20 },
      extraWindfury: 2,
    },
  ],
};

describe("RoleSheetTable", () => {
  it("renders a row per player in the role with a deaths cell header", () => {
    render(
      <RoleSheetTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    // Playerone is the Mage → caster role
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    // Required by test spec
    expect(screen.getByText("# of deaths in total")).toBeInTheDocument();
  });

  it("renders the stale-cache notice when roleSheet returns null", () => {
    // A report without playerTotals triggers roleSheet → null
    const staleReport: ReportData = { ...reportFixture, playerTotals: undefined };
    render(
      <RoleSheetTable
        report={staleReport}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );
    expect(screen.getByText(/cached before RPB support/)).toBeInTheDocument();
  });

  it("renders player names as plain text, not a link", () => {
    render(
      <RoleSheetTable
        report={reportFixture}
        fightId={ALL_FIGHTS}
        role="physical"
      />,
    );
    // Playertwo (Warrior) is in the physical role
    expect(screen.getByText("Playertwo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Playertwo" })).not.toBeInTheDocument();
  });

  it("surfaces Windfury / Grace of Air twist rows and a per-fight timeline for a twisting Shaman", () => {
    const twistReport: ReportData = {
      ...reportFixture,
      players: [...reportFixture.players, { id: 3, name: "Twistarn", class: "Shaman" }],
      playerTotals: [
        ...(reportFixture.playerTotals ?? []),
        { playerId: 3, healingDone: 0, damageDone: 90_000, damageTaken: 3_000, magicDamageDone: 1_000 },
      ],
      playerCasts: [
        ...(reportFixture.playerCasts ?? []),
        // fight 3 is [150_000, 250_000]: Windfury holds the air slot for the
        // first half, Grace of Air for the second → ~50% / ~50%.
        { fightId: 3, playerId: 3, spellId: 8512, timestamp: 150_000 },
        { fightId: 3, playerId: 3, spellId: 8835, timestamp: 200_000 },
      ],
      abilityMeta: {
        ...reportFixture.abilityMeta,
        "8512": { name: "Windfury Totem" },
        "8835": { name: "Grace of Air Totem" },
      },
      // Enhancement parse → detected as physical DPS (not the Shaman caster default)
      rankings: (reportFixture.rankings ?? []).map((rk, i) =>
        i === 0
          ? { ...rk, dps: [...rk.dps, { name: "Twistarn", class: "Shaman", spec: "Enhancement", rankPercent: 80, bracketPercent: 75, parse: 900 }] }
          : rk,
      ),
    };
    // scope to the Hydross kill (fight 3) so uptime% denominator is that one fight
    render(
      <RoleSheetTable report={twistReport} fightId={3} role="physical" />,
    );
    expect(screen.getByText("Windfury Totem uptime% (air slot)")).toBeInTheDocument();
    expect(screen.getByText("Grace of Air Totem uptime% (air slot)")).toBeInTheDocument();
    // "Twistarn" appears twice: the player column header and the timeline caption
    expect(screen.getAllByText("Twistarn").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Hydross the Unstable").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all Stats & Misc columns including new ones when hitStats is present", () => {
    render(
      <RoleSheetTable
        report={reportWithHitStats}
        fightId={ALL_FIGHTS}
        role="caster"
      />,
    );

    // Column headers for newly-added columns must be present
    expect(
      screen.getByText("# of extra Windfury Weapon attacks"),
    ).toBeInTheDocument();
    expect(screen.getByText("Crit Heals")).toBeInTheDocument();
    expect(screen.getByText("In: Blocked")).toBeInTheDocument();
    expect(screen.getByText("In: Dodge")).toBeInTheDocument();
    expect(screen.getByText("In: Immune")).toBeInTheDocument();
    expect(screen.getByText("In: Miss")).toBeInTheDocument();
    expect(screen.getByText("In: Parry")).toBeInTheDocument();

    // Outgoing crit cell: 35 hits at 35%
    expect(screen.getByText("35 (35%)")).toBeInTheDocument();

    // extraWindfury cell: integer 2
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
