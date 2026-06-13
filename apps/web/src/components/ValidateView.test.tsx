import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { reportFixture, type ReportData } from "@wcl/core";
import { ValidateView } from "./ValidateView";

afterEach(cleanup);

function report(): ReportData {
  // fixture zone is SSC, which has no curated rules → unsupported-zone path
  return structuredClone({ ...reportFixture, npcKills: { "21508": 1 }, firstPullNpcIds: [21508] });
}

describe("ValidateView", () => {
  it("shows a refresh notice for reports cached before M4", () => {
    const r = structuredClone(reportFixture); // no npcKills
    render(<ValidateView report={r} />);
    expect(screen.getByText(/cached before/i)).toBeTruthy();
  });
  it("shows an unsupported-zone message when no rules match", () => {
    render(<ValidateView report={report()} />);
    expect(screen.getByText(/no speedrun rules/i)).toBeTruthy();
  });
  it("renders trash rows and the verdict for a supported zone (SW, verified)", () => {
    const r = structuredClone({
      ...reportFixture, zoneName: "Sunwell Plateau",
      npcKills: { "25507": 5, "25363": 70, "25372": 4, "25373": 26, "25592": 1, "25509": 6, "25593": 4, "25599": 2, "25508": 2 },
      firstPullNpcIds: [25507],
    });
    render(<ValidateView report={r} />);
    expect(screen.getByText("Sunblade Protector")).toBeTruthy();
    // SW is verified:true, so NO unverified badge shows
    expect(screen.queryByText(/unverified speedrun rules/i)).toBeNull();
  });
  it("badges unverified zones (override to a verified:false zone)", () => {
    const verifiedFalseZone = "MH"; // any non-SW curated zone is verified:false
    const r = structuredClone({ ...reportFixture, npcKills: {}, firstPullNpcIds: [] });
    render(<ValidateView report={r} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: verifiedFalseZone } });
    expect(screen.getByText(/unverified speedrun rules/i)).toBeTruthy();
  });
});
