import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { reportFixture, type ReportData } from "@wcl/core";
import { DrumsView } from "./DrumsView";

afterEach(cleanup);

/** Drums need no fight filtering — the raw fixture's numbers hold as-is. */
function baseReport(): ReportData {
  return structuredClone(reportFixture);
}

describe("DrumsView", () => {
  it("renders one row per drum-using player with per-kind stats", () => {
    render(<DrumsView report={baseReport()} />);
    const row = screen.getByText("Playerone").closest("tr")!;
    const cells = [...row.querySelectorAll("td")];
    expect(cells[1]!.textContent).toBe("2 (⌀ 1.50)"); // battle drums
    expect(cells[4]!.textContent).toBe("1"); // on Tinnitus
    expect(cells[4]!.className).toBe("sev-major");
    expect(cells[7]!.textContent).toBe("3"); // weighted score
    expect(screen.queryByText("Playertwo")).toBeNull();
  });
  it("flags lesser (non-Greater) drum usage below the table", () => {
    render(<DrumsView report={baseReport()} />);
    const note = screen.getByText(/lesser/i);
    expect(note.textContent).toMatch(/2 times/);
    expect(note.className).toBe("sev-moderate");
  });
  it("shows a refresh notice for reports cached before drum support", () => {
    const report = baseReport();
    delete report.drumCasts;
    delete report.drumApplications;
    render(<DrumsView report={report} />);
    expect(screen.getByText(/cached before drum support/i)).toBeTruthy();
  });
  it("shows a notice when no drums were used", () => {
    const report = baseReport();
    report.drumCasts = [];
    report.drumApplications = [];
    render(<DrumsView report={report} />);
    expect(screen.getByText(/no drums were used/i)).toBeTruthy();
  });
});
