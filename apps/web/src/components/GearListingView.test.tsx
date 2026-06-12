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
  it("shows a notice when the report has no gear data", () => {
    render(<GearListingView report={{ ...reportFixture, gear: [] }} />);
    expect(screen.getByText(/no gear data/i)).toBeTruthy();
  });
});
