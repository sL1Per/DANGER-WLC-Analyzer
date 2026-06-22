import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { LensBar } from "./LensBar";

function setup(over: Partial<ComponentProps<typeof LensBar>> = {}) {
  const report = reportFixture;
  const props = {
    report, lens: "fight" as const, fightId: report.fights.find((f) => f.isBoss)!.id,
    playerId: report.players[0].id, query: "",
    onLens: vi.fn(), onFight: vi.fn(), onPlayer: vi.fn(), onQuery: vi.fn(), ...over,
  };
  render(<LensBar {...props} />);
  return props;
}

describe("LensBar", () => {
  it("toggles to the player lens", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /by player/i }));
    expect(p.onLens).toHaveBeenCalledWith("player");
  });
  it("selects a fight chip", () => {
    const p = setup();
    const boss = p.report.fights.find((f) => f.isBoss)!;
    fireEvent.click(screen.getAllByText(boss.name)[0]);
    expect(p.onFight).toHaveBeenCalledWith(boss.id);
  });
  it("renders the roster search in the player lens", () => {
    setup({ lens: "player" });
    expect(screen.getByPlaceholderText(/filter raiders/i)).toBeInTheDocument();
  });
});
