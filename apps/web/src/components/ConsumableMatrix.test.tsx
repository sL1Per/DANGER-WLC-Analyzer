import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { RpbConsumableRow } from "@wcl/core";
import { ConsumableMatrix } from "./ConsumableMatrix";

const catalog = [
  { key: "haste-potion", name: "Haste Potion" },
  { key: "flame-cap", name: "Flame Cap" },
];

const rows: RpbConsumableRow[] = [
  { playerId: 1, playerName: "Magey", className: "Mage", counts: { "haste-potion": 4, "flame-cap": 0 } },
  { playerId: 2, playerName: "Locky", className: "Warlock", counts: { "haste-potion": 0, "flame-cap": 0 } },
  { playerId: 3, playerName: "Warry", className: "Warrior", counts: { "haste-potion": 2, "flame-cap": 0 } },
];

describe("ConsumableMatrix", () => {
  afterEach(cleanup);

  it("renders one row per consumable", () => {
    render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    expect(screen.getByText("Haste Potion")).toBeInTheDocument();
    expect(screen.getByText("Flame Cap")).toBeInTheDocument();
  });

  it("renders one column per player, colored by class", () => {
    const { container } = render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    for (const name of ["Magey", "Locky", "Warry"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // every player column header carries its class color custom property
    const headers = container.querySelectorAll("thead th.player-col");
    expect(headers.length).toBe(3);
    headers.forEach((h) => expect(h.getAttribute("style")).toContain("--class-color"));
  });

  it("orders player columns by class (canonical), not roster order", () => {
    const { container } = render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    const headers = [...container.querySelectorAll("thead th.player-col")].map((h) => h.textContent?.trim());
    // canonical class order: Warrior, then Mage, then Warlock
    expect(headers).toEqual(["Warry", "Magey", "Locky"]);
  });

  it("applies a relative heatmap per row: row max → good, min → bad", () => {
    render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    const hasteRow = screen.getByText("Haste Potion").closest("tr")!;
    const cells = within(hasteRow).getAllByRole("cell");
    // cells are ordered Warry(2), Magey(4), Locky(0) after the label cell
    const [warry, magey, locky] = cells;
    expect(magey.className).toContain("sev-minor");   // max → good
    expect(locky.className).toContain("sev-major");   // min → bad
    expect(warry.className).toContain("sev-moderate"); // middle → watch
  });

  it("keeps an all-zero row neutral", () => {
    render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    const flameRow = screen.getByText("Flame Cap").closest("tr")!;
    within(flameRow).getAllByRole("cell").forEach((c) =>
      expect(c.className).toContain("sev-neutral"),
    );
  });

  it("shows a no-data note for an empty roster", () => {
    render(<ConsumableMatrix rows={[]} catalog={catalog} />);
    expect(screen.getByText(/no boss-fight data/i)).toBeInTheDocument();
  });
});
