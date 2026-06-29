import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { PlayerProfile, wowheadItem } from "./PlayerProfile";

describe("wowheadItem", () => {
  it("always yields an https: URL, even for a hostile itemId from a shared snapshot", () => {
    // Shared-snapshot ReportData is attacker-controlled JSON; a malicious itemId
    // must never be able to produce a javascript:/data: href.
    const hostile = "javascript:alert(document.cookie)" as unknown as number;
    const url = wowheadItem(hostile);
    expect(new URL(url).protocol).toBe("https:");
    expect(url.startsWith("https://www.wowhead.com/tbc/item=")).toBe(true);
  });
});

describe("PlayerProfile", () => {
  it("renders the player's name and the stat tiles", () => {
    const report = reportFixture;
    const player = report.players[0];
    render(<PlayerProfile report={report} playerId={player.id} />);
    expect(screen.getByRole("heading", { name: new RegExp(player.name) })).toBeInTheDocument();
    expect(screen.getAllByText(/Deaths/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gear flags/i).length).toBeGreaterThan(0);
  });
  it("shows a refresh notice when RPB data is missing", () => {
    const report = { ...reportFixture, playerTotals: undefined };
    render(<PlayerProfile report={report} playerId={report.players[0].id} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
  it("lists combat consumables the player used (haste/destruction potions, drums…)", () => {
    const player = reportFixture.players[0];
    const report = {
      ...reportFixture,
      playerCasts: [
        ...(reportFixture.playerCasts ?? []),
        { fightId: 3, playerId: player.id, spellId: 28507, timestamp: 160_000 }, // Haste Potion
        { fightId: 3, playerId: player.id, spellId: 28507, timestamp: 200_000 }, // Haste Potion
        { fightId: 3, playerId: player.id, spellId: 35476, timestamp: 151_000 }, // Drums of Battle
      ],
    };
    render(<PlayerProfile report={report} playerId={player.id} />);
    expect(screen.getByText("Haste Potion")).toBeInTheDocument();
    expect(screen.getByText("Drums of Battle")).toBeInTheDocument();
  });
  it("colors flagged gear and shows the issue in its own column", () => {
    // Playerone (id 1) wears Onyxia Scale Cloak (excluded) → "useless/fun item" (major)
    render(<PlayerProfile report={reportFixture} playerId={1} />);
    const issue = screen.getByText(/useless\/fun item/i);
    expect(issue).toBeInTheDocument();
    expect(issue.closest("li")).toHaveClass("sev-major");
    // Bracers (slot 8) aren't a "primary" slot but still carry a flag → must show
    expect(screen.getByText(/no enchant/i)).toBeInTheDocument();
  });
  it("links each gear item to its Wowhead TBC page", () => {
    render(<PlayerProfile report={reportFixture} playerId={1} />);
    // Onyxia Scale Cloak = item 15138
    const link = screen.getByRole("link", { name: /Onyxia Scale Cloak/i });
    expect(link).toHaveAttribute("href", "https://www.wowhead.com/tbc/item=15138");
  });
  it("renders per-boss hit-type columns from per-fight hit stats", () => {
    const player = reportFixture.players[0];
    // 3 of 4 outgoing swings crit on a boss fight (id 3) → 75%
    const report = {
      ...reportFixture,
      hitStatsByFight: [{
        playerId: player.id, fightId: 3,
        outgoing: { hit: 1, crit: 3, dodge: 0, miss: 0, parry: 0, resist: 0 },
        incomingMelee: { hit: 0, crit: 0, crushing: 0, blocked: 0, dodge: 0, immune: 0, miss: 0, parry: 0 },
        heal: { hit: 0, crit: 0 }, extraWindfury: 0, battleSquawk: 0,
      }],
    };
    render(<PlayerProfile report={report} playerId={player.id} />);
    expect(screen.getAllByText("Out: Crit").length).toBeGreaterThan(0);
    expect(screen.getByText("3 (75%)")).toBeInTheDocument();
  });
});
