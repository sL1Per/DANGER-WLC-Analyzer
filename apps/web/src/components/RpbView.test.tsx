import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RpbView } from "./RpbView";
import { reportFixture } from "@wcl/core";

describe("RpbView", () => {
  beforeEach(() => localStorage.clear());

  it("renders role groups and player rows", () => {
    render(<RpbView report={reportFixture} />);
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    expect(screen.getByText("Playertwo")).toBeInTheDocument();
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
});
