import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { RpbView } from "./RpbView";
import { reportFixture } from "@wcl/core";

describe("RpbView", () => {
  beforeEach(() => localStorage.clear());

  it("renders players grouped under their class band", () => {
    render(<RpbView report={reportFixture} />);
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    expect(screen.getByText("Playertwo")).toBeInTheDocument();
    // class bands present (Mage for Playerone, Warrior for Playertwo)
    expect(screen.getByRole("heading", { name: "Mage" })).toBeInTheDocument();
  });

  it("shows a refresh notice for a pre-M5 report", () => {
    const r = structuredClone(reportFixture);
    delete (r as { playerTotals?: unknown }).playerTotals;
    render(<RpbView report={r} />);
    expect(screen.getByText(/cached before/i)).toBeInTheDocument();
  });

  it("persists a manual role override", () => {
    render(<RpbView report={reportFixture} />);
    const select = screen.getAllByLabelText(/role for/i)[0]!;
    fireEvent.change(select, { target: { value: "tank" } });
    expect(JSON.parse(localStorage.getItem("wcl.roles")!)).toMatchObject({ Playerone: "tank" });
  });

  it("renders class-specific ability metrics", () => {
    render(<RpbView report={reportFixture} />);
    expect(screen.getAllByText(/Winter's Chill/).length).toBeGreaterThan(0);
  });

  it("toggles to cards view and persists the choice", () => {
    render(<RpbView report={reportFixture} />);
    expect(document.querySelector(".cardgrid")).toBeNull(); // rows by default
    fireEvent.click(screen.getByLabelText(/cards view/i));
    expect(document.querySelector(".cardgrid")).not.toBeNull();
    expect(localStorage.getItem("wcl.rpbViewMode")).toBe("cards");
  });

  it("starts in cards view when that was persisted", () => {
    localStorage.setItem("wcl.rpbViewMode", "cards");
    render(<RpbView report={reportFixture} />);
    expect(document.querySelector(".cardgrid")).not.toBeNull();
  });

  it("applies a class color to a player marker", () => {
    const { container } = render(<RpbView report={reportFixture} />);
    const dot = container.querySelector(".class-dot") as HTMLElement | null;
    expect(dot).not.toBeNull();
    // the --class-color custom property is set on the band/cell via inline style
    const band = screen.getByRole("heading", { name: "Mage" });
    expect(band.getAttribute("style")).toContain("--class-color");
  });
});
