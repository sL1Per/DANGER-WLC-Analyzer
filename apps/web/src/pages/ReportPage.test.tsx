import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { reportFixture } from "@wcl/core";
import { ReportPage } from "./ReportPage";

vi.mock("../lib/useReport", () => ({
  useReport: () => ({ result: { data: reportFixture, cachedAt: Date.now() }, error: null, loading: false, reload: vi.fn() }),
}));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/report/:reportId" element={<ReportPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe("ReportPage", () => {
  it("defaults to the Rankings category", () => {
    renderAt("/report/abc");
    expect(screen.getByText(/Damage Dealers/i)).toBeInTheDocument();
  });
  it("switches category from the subnav", async () => {
    renderAt("/report/abc");
    fireEvent.click(screen.getByRole("button", { name: /^Summary$/i }));
    await waitFor(() => expect(screen.getAllByText("Deaths").length).toBeGreaterThan(0));
  });
  it("renders the Performance tab and shows panel titles when clicked", async () => {
    renderAt("/report/abc");
    expect(screen.getByRole("button", { name: /^Summary$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Performance$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Performance$/i }));
    await waitFor(() => expect(screen.getByText("Damage Done By Source")).toBeInTheDocument());
  });
  it("hides combatantInfo-only tabs on the TRASH card and falls back from a hidden tab", () => {
    // fight=-2 is ALL_TRASH; cat=gear is hidden there, so it must fall back to a visible tab
    renderAt("/report/abc?fight=-2&cat=gear");
    expect(screen.queryByRole("button", { name: /^Rankings$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Gear$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Shadow Resi$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Summary$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Consumables$/i })).toBeInTheDocument();
    // the event-sourced Performance tab has trash data, so it stays visible here
    expect(screen.getByRole("button", { name: /^Performance$/i })).toBeInTheDocument();
  });
  it("honors ?lens=player by showing the profile", () => {
    const report = reportFixture;
    renderAt(`/report/abc?lens=player&player=${report.players[0].id}`);
    expect(screen.getByRole("heading", { name: new RegExp(report.players[0].name) })).toBeInTheDocument();
  });
});
