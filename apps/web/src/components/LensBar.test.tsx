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
  it("shows a BOSSES chip first that selects all bosses combined", () => {
    const p = setup();
    const names = screen.getAllByText(/.+/).filter((n) => n.className === "fight-chip__name");
    expect(names[0]).toHaveTextContent("BOSSES");
    fireEvent.click(screen.getByText("BOSSES"));
    expect(p.onFight).toHaveBeenCalledWith(-1);
  });
  it("selects a fight chip", () => {
    const p = setup();
    const boss = p.report.fights.find((f) => f.isBoss)!;
    fireEvent.click(screen.getAllByText(boss.name)[0]);
    expect(p.onFight).toHaveBeenCalledWith(boss.id);
  });
  it("shows a TRASH chip that selects all trash combined", () => {
    const p = setup();
    fireEvent.click(screen.getByText("TRASH"));
    expect(p.onFight).toHaveBeenCalledWith(-2);
  });
  it("omits the TRASH chip when the report has no trash fights", () => {
    const bossOnly = { ...reportFixture, fights: reportFixture.fights.filter((f) => f.isBoss) };
    setup({ report: bossOnly });
    expect(screen.queryByText("TRASH")).not.toBeInTheDocument();
  });
  it("renders the roster search in the player lens", () => {
    setup({ lens: "player" });
    expect(screen.getByPlaceholderText(/filter raiders/i)).toBeInTheDocument();
  });
});
