import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RpbView } from "./RpbView";
import { reportFixture } from "@wcl/core";

// The role view now lives under the "Roles" tab; switch to it before asserting.
const showRoles = () => fireEvent.click(screen.getByLabelText(/roles tab/i));

describe("RpbView", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("defaults to the General tab showing the consumable matrix", () => {
    render(<RpbView report={reportFixture} />);
    expect(document.querySelector(".consumable-matrix")).not.toBeNull();
    // a curated consumable row label is present
    expect(screen.getByText("Haste Potion")).toBeInTheDocument();
  });

  it("switches to the Roles tab and persists the choice", () => {
    render(<RpbView report={reportFixture} />);
    expect(document.querySelector(".consumable-matrix")).not.toBeNull();
    showRoles();
    expect(document.querySelector(".consumable-matrix")).toBeNull();
    expect(document.querySelector("details.role-section")).not.toBeNull();
    expect(localStorage.getItem("wcl.rpbTab")).toBe("roles");
  });

  it("starts on the Roles tab when that was persisted", () => {
    localStorage.setItem("wcl.rpbTab", "roles");
    render(<RpbView report={reportFixture} />);
    expect(document.querySelector("details.role-section")).not.toBeNull();
    expect(document.querySelector(".consumable-matrix")).toBeNull();
  });

  it("renders players grouped under their class band (Roles tab)", () => {
    render(<RpbView report={reportFixture} />);
    showRoles();
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    expect(screen.getByText("Playertwo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mage" })).toBeInTheDocument();
  });

  it("shows a refresh notice for a pre-RPB report", () => {
    const r = structuredClone(reportFixture);
    delete (r as { playerTotals?: unknown }).playerTotals;
    delete (r as { playerCasts?: unknown }).playerCasts;
    render(<RpbView report={r} />);
    expect(screen.getByText(/cached before/i)).toBeInTheDocument(); // General tab
    showRoles();
    expect(screen.getByText(/cached before/i)).toBeInTheDocument(); // Roles tab
  });

  it("persists a manual role override (Roles tab)", () => {
    render(<RpbView report={reportFixture} />);
    showRoles();
    const select = screen.getAllByLabelText(/role for/i)[0]!;
    fireEvent.change(select, { target: { value: "tank" } });
    expect(JSON.parse(localStorage.getItem("wcl.roles")!)).toMatchObject({ Playerone: "tank" });
  });

  it("renders class-specific ability metrics (Roles tab)", () => {
    render(<RpbView report={reportFixture} />);
    showRoles();
    expect(screen.getAllByText(/Winter's Chill/).length).toBeGreaterThan(0);
  });

  it("toggles to cards view and persists the choice (Roles tab)", () => {
    render(<RpbView report={reportFixture} />);
    showRoles();
    expect(document.querySelector(".cardgrid")).toBeNull(); // rows by default
    fireEvent.click(screen.getByLabelText(/cards view/i));
    expect(document.querySelector(".cardgrid")).not.toBeNull();
    expect(localStorage.getItem("wcl.rpbViewMode")).toBe("cards");
  });

  it("starts in cards view when that was persisted (Roles tab)", () => {
    localStorage.setItem("wcl.rpbViewMode", "cards");
    render(<RpbView report={reportFixture} />);
    showRoles();
    expect(document.querySelector(".cardgrid")).not.toBeNull();
  });

  it("applies a class color to a player marker (Roles tab)", () => {
    const { container } = render(<RpbView report={reportFixture} />);
    showRoles();
    const dot = container.querySelector(".class-dot") as HTMLElement | null;
    expect(dot).not.toBeNull();
    const band = screen.getByRole("heading", { name: "Mage" });
    expect(band.getAttribute("style")).toContain("--class-color");
  });

  it("renders each role section as a disclosure that is open by default and collapses (Roles tab)", () => {
    const { container } = render(<RpbView report={reportFixture} />);
    showRoles();
    const sections = container.querySelectorAll<HTMLDetailsElement>("details.role-section");
    expect(sections.length).toBeGreaterThan(0);

    const first = sections[0]!;
    expect(first.open).toBe(true); // expanded by default
    const summary = first.querySelector("summary")!;
    fireEvent.click(summary);
    expect(first.open).toBe(false); // collapses on click
    fireEvent.click(summary);
    expect(first.open).toBe(true); // and expands again
  });
});
