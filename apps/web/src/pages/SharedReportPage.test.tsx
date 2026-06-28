import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SharedReportPage } from "./SharedReportPage";
import type { ReportData } from "@wcl/core";

const snapshot = {
  reportId: "abc", title: "Shared T5", zoneName: "Karazhan", startTime: 0,
  players: [], fights: [], schemaVersion: 1,
} as unknown as ReportData;

const fetchSnapshot = vi.fn().mockResolvedValue(snapshot);
vi.mock("../lib/share", () => ({ fetchSnapshot: (id: string) => fetchSnapshot(id) }));

it("renders a snapshot without any WCL fetch or key prompt", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  render(
    <MemoryRouter initialEntries={["/s/xyz123"]}>
      <Routes><Route path="/s/:shareId" element={<SharedReportPage />} /></Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(fetchSnapshot).toHaveBeenCalledWith("xyz123"));
  expect(screen.queryByText(/WCL credentials/i)).not.toBeInTheDocument();
  // no direct WCL token/GraphQL calls from the shared view
  expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining("warcraftlogs.com"), expect.anything());
});
