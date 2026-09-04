import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { RpbConsumableRow } from "@wcl/core";
import { ConsumableMatrix } from "./ConsumableMatrix";

const catalog = [
  { key: "haste-potion", name: "Haste Potion" },
  { key: "flame-cap", name: "Flame Cap" },
];

const rows: RpbConsumableRow[] = [
  { playerId: 1, playerName: "Magey", className: "Mage", counts: { "haste-potion": 4, "flame-cap": 0 }, uptimes: {} },
  { playerId: 2, playerName: "Locky", className: "Warlock", counts: { "haste-potion": 0, "flame-cap": 0 }, uptimes: {} },
  { playerId: 3, playerName: "Warry", className: "Warrior", counts: { "haste-potion": 2, "flame-cap": 0 }, uptimes: {} },
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

  it("applies a relative heatmap per row, leaving empty cells neutral", () => {
    render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    const hasteRow = screen.getByText("Haste Potion").closest("tr")!;
    const cells = within(hasteRow).getAllByRole("cell");
    // cells are ordered Warry(2), Magey(4), Locky(0) after the label cell
    const [warry, magey, locky] = cells;
    expect(magey.className).toContain("sev-minor");    // max → good
    expect(warry.className).toContain("sev-moderate"); // middle → watch
    expect(locky.className).toContain("sev-neutral");  // empty → no background
  });

  it("keeps an all-zero row neutral", () => {
    render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    const flameRow = screen.getByText("Flame Cap").closest("tr")!;
    within(flameRow).getAllByRole("cell").forEach((c) =>
      expect(c.className).toContain("sev-neutral"),
    );
  });

  it("renders player names as plain text, not a button", () => {
    render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    expect(screen.getByText("Magey")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Magey" })).not.toBeInTheDocument();
  });

  it("renders buff-uptime rows as 'count (uptime%)'", () => {
    const upCatalog = [{ key: "gift-of-arthas", name: "Gift of Arthas", uptime: true }];
    const upRows: RpbConsumableRow[] = [
      { playerId: 1, playerName: "Tanky", className: "Warrior", counts: { "gift-of-arthas": 3 }, uptimes: { "gift-of-arthas": 0.46 } },
      { playerId: 2, playerName: "Locky", className: "Warlock", counts: { "gift-of-arthas": 0 }, uptimes: { "gift-of-arthas": 0 } },
    ];
    render(<ConsumableMatrix rows={upRows} catalog={upCatalog} />);
    const row = screen.getByText("Gift of Arthas").closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    expect(cells[0].textContent).toBe("3 (46%)"); // Tanky (warrior sorts first)
    expect(cells[1].textContent).toBe("");        // non-user stays blank
  });

  it("shows a no-data note for an empty roster", () => {
    render(<ConsumableMatrix rows={[]} catalog={catalog} />);
    expect(screen.getByText(/no boss-fight data/i)).toBeInTheDocument();
  });
});
