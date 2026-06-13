import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { reportFixture, type ReportData } from "@wcl/core";

vi.mock("../lib/api", () => ({
  fetchReport: vi.fn(async (): Promise<{ data: ReportData; cachedAt: number }> => ({
    data: structuredClone(reportFixture), cachedAt: Date.now(),
  })),
  ApiError: class extends Error { status: number; constructor(s = 500, m = "") { super(m); this.status = s; } },
}));

import { TimelineView } from "./TimelineView";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("TimelineView", () => {
  it("prompts for a second report id", () => {
    render(<TimelineView report={reportFixture} />);
    expect(screen.getByPlaceholderText(/report/i)).toBeTruthy();
  });
  it("renders the comparison after fetching the second report", async () => {
    render(<TimelineView report={reportFixture} />);
    fireEvent.change(screen.getByPlaceholderText(/report/i), { target: { value: "b2C3d4E5f6G7h8I9" } });
    fireEvent.click(screen.getByRole("button", { name: /compare/i }));
    await waitFor(() => expect(screen.getAllByText(/Hydross the Unstable/).length).toBeGreaterThan(0));
  });
});
