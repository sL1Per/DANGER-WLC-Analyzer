import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { TimelineView } from "./TimelineView";

const ensureToken = vi.fn();
const fetchFriendlyBuffs = vi.fn();
const fetchFriendlyDebuffs = vi.fn();

vi.mock("../../lib/api", () => ({ ensureToken: () => ensureToken() }));
vi.mock("../../lib/wcl/wcl", () => ({
  fetchFriendlyBuffs: (...args: unknown[]) => fetchFriendlyBuffs(...args),
  fetchFriendlyDebuffs: (...args: unknown[]) => fetchFriendlyDebuffs(...args),
}));

const FIGHT_ID = 3; // Hydross the Unstable, per reportFixture

// Row text is split across colored spans (player name, ability name), so it
// can't be matched with a single getByText regex — check the <li>'s full
// textContent instead.
function findRow(text: string | RegExp) {
  return screen.queryAllByRole("listitem").find((li) => (li.textContent ?? "").match(text));
}

beforeEach(() => {
  ensureToken.mockReset().mockResolvedValue("token-123");
  fetchFriendlyBuffs.mockReset().mockResolvedValue([]);
  fetchFriendlyDebuffs.mockReset().mockResolvedValue([]);
});

describe("TimelineView", () => {
  it("degrades gracefully with no stored WCL token: casts/deaths/damage still render, buffs/debuffs don't fetch", async () => {
    // The scenario this covers: a shared /s/:shareId viewer with no WCL key of
    // their own — the tab must not block on that, since most of its content
    // (casts/deaths/interrupts/damage) is already part of the published report.
    ensureToken.mockResolvedValue(null);
    render(<TimelineView report={reportFixture} fightId={FIGHT_ID} />);
    await waitFor(() => expect(findRow(/Playerone casts Arcane Blast/)).toBeTruthy());

    expect(findRow(/Playertwo dies to Frostbolt/)).toBeTruthy();
    expect(screen.getByText(/Buffs and debuffs need your own WCL credentials/i)).toBeInTheDocument();
    expect(fetchFriendlyBuffs).not.toHaveBeenCalled();
    expect(fetchFriendlyDebuffs).not.toHaveBeenCalled();
  });

  it("merges cached casts/deaths with fetched buffs/debuffs into one chronological list", async () => {
    fetchFriendlyBuffs.mockResolvedValue([
      { timestamp: 151_100, type: "applybuff", sourceID: 1, targetID: 1, abilityGameID: 30451, fight: FIGHT_ID },
    ]);
    render(<TimelineView report={reportFixture} fightId={FIGHT_ID} />);
    await waitFor(() => expect(findRow(/Playerone casts Arcane Blast/)).toBeTruthy());
    expect(findRow(/Playerone gains Arcane Blast/)).toBeTruthy();
    expect(findRow(/Playertwo dies to Frostbolt/)).toBeTruthy();
    expect(fetchFriendlyBuffs).toHaveBeenCalledWith(reportFixture.reportId, "token-123", [FIGHT_ID]);
    expect(fetchFriendlyDebuffs).toHaveBeenCalledWith(reportFixture.reportId, "token-123", [FIGHT_ID]);
  });

  it("colors the player name by their class and the ability name by event category", async () => {
    render(<TimelineView report={reportFixture} fightId={FIGHT_ID} />);
    await waitFor(() => expect(findRow(/Playerone casts Arcane Blast/)).toBeTruthy());
    const castRow = findRow(/Playerone casts Arcane Blast/)!;
    expect(castRow.querySelector(".tl-player")).toHaveStyle({ "--class-color": "var(--cc-mage)" });
    expect(castRow.querySelector(".tl-spell-cast")).toHaveTextContent("Arcane Blast");
  });

  it("filters rows by free-text search across player and spell names", async () => {
    render(<TimelineView report={reportFixture} fightId={FIGHT_ID} />);
    await waitFor(() => expect(findRow(/Playerone casts Arcane Blast/)).toBeTruthy());

    fireEvent.change(screen.getByRole("searchbox", { name: /search timeline/i }), { target: { value: "frostbolt" } });
    expect(findRow(/Playerone casts Arcane Blast/)).toBeFalsy();
    expect(findRow(/Playertwo dies to Frostbolt/)).toBeTruthy();
  });

  it("hides a category's rows when its filter pill is toggled off", async () => {
    render(<TimelineView report={reportFixture} fightId={FIGHT_ID} />);
    await waitFor(() => expect(findRow(/Playerone casts Arcane Blast/)).toBeTruthy());

    fireEvent.click(screen.getByRole("checkbox", { name: "Casts" }));
    expect(findRow(/Playerone casts Arcane Blast/)).toBeFalsy();
    expect(findRow(/Playertwo dies to Frostbolt/)).toBeTruthy();
  });

  it("starts with every category on, including damage dealt and damage taken", async () => {
    const report = {
      ...reportFixture,
      damageTakenEvents: [{ ...reportFixture.damageTakenEvents![0]!, timestamp: 151_400 }],
    };
    render(<TimelineView report={report} fightId={FIGHT_ID} />);
    await waitFor(() => expect(findRow(/Playerone casts Arcane Blast/)).toBeTruthy());

    expect(screen.getByRole("checkbox", { name: "Damage taken" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Damage dealt" })).toBeChecked();
    expect(findRow(/Environment hits Playerone with Frostbolt/)).toBeTruthy();
    expect(findRow(/Playerone hits #900 with Spell #11350/)).toBeTruthy();
  });

  it("caps rendered rows and reveals more via the 'Show more' button", async () => {
    const manyCasts = Array.from({ length: 320 }, (_, i) => (
      { fightId: FIGHT_ID, playerId: 1, spellId: 30451, timestamp: 151_000 + i }
    ));
    const report = { ...reportFixture, playerCasts: manyCasts, playerDamage: [], playerDeaths: [] };
    render(<TimelineView report={report} fightId={FIGHT_ID} />);
    await waitFor(() => expect(screen.queryAllByRole("listitem").length).toBeGreaterThan(0));

    expect(screen.queryAllByRole("listitem")).toHaveLength(300);
    expect(screen.getByText(/Showing 300 of 320 events/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show 20 more/ }));
    expect(screen.queryAllByRole("listitem")).toHaveLength(320);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it("does not refetch when switching back to an already-loaded fight", async () => {
    const { rerender } = render(<TimelineView report={reportFixture} fightId={FIGHT_ID} />);
    await waitFor(() => expect(fetchFriendlyBuffs).toHaveBeenCalledTimes(1));

    const otherFightId = reportFixture.fights.find((f) => f.isBoss && f.id !== FIGHT_ID)?.id ?? FIGHT_ID;
    rerender(<TimelineView report={reportFixture} fightId={otherFightId} />);
    rerender(<TimelineView report={reportFixture} fightId={FIGHT_ID} />);

    expect(fetchFriendlyBuffs).toHaveBeenCalledTimes(1);
  });
});
