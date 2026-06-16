import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { RankingsGrid } from "./RankingsGrid";

afterEach(() => cleanup());

describe("RankingsGrid", () => {
  it("renders a refresh notice when rankings are absent (old cache)", () => {
    render(<RankingsGrid report={{ ...reportFixture, rankings: undefined }} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeTruthy();
  });

  it("renders the three role sections", () => {
    render(<RankingsGrid report={reportFixture} />);
    expect(screen.getByRole("heading", { name: "Damage Dealers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Healers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tanks" })).toBeTruthy();
  });

  it("colors each parse cell on the WCL band scale", () => {
    render(<RankingsGrid report={reportFixture} />);
    expect(screen.getByText("95").className).toBe("parse-legendary");
    expect(screen.getByText("99").className).toBe("parse-astounding");
    expect(screen.getByText("40").className).toBe("parse-uncommon");
  });

  it("shows an em dash where a player has no parse for a boss", () => {
    render(<RankingsGrid report={reportFixture} />);
    const tanksHeading = screen.getByRole("heading", { name: "Tanks" });
    const tankTable = tanksHeading.parentElement!.querySelector("table")!;
    expect(within(tankTable).getByText("—")).toBeTruthy();
  });
});
