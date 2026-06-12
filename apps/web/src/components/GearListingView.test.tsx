import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { GearListingView } from "./GearListingView";

afterEach(cleanup);

describe("GearListingView", () => {
  it("renders the gear table for the default fight", () => {
    render(<GearListingView report={reportFixture} />);
    expect(screen.getByText("Spellstrike Hood")).toBeTruthy();
    expect(screen.getByText("Playerone")).toBeTruthy();
    // fight selector shows the boss fight
    expect((screen.getByLabelText("boss fight") as HTMLSelectElement).value).toBe("3");
  });
  it("color-codes item cells by their worst issue and empty required slots red", () => {
    render(<GearListingView report={reportFixture} />);
    // Spellfire Robe is missing a gem (major) and has a cheap enchant (moderate) → red
    expect(screen.getByText("Spellfire Robe").closest("td")?.className).toBe("sev-major");
    // Playerone has no weapon equipped → empty required slot is red
    const row = screen.getByText("Playerone").closest("tr")!;
    const emptyMajor = Array.from(row.querySelectorAll("td"))
      .filter((td) => td.textContent === "" && td.className === "sev-major");
    expect(emptyMajor.length).toBeGreaterThan(0);
  });
  it("shows a notice when the report has no gear data", () => {
    render(<GearListingView report={{ ...reportFixture, gear: [] }} />);
    expect(screen.getByText(/no gear data/i)).toBeTruthy();
  });
});
