import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { reportFixture } from "@wcl/core";
import { ReportHeader } from "./ReportHeader";

vi.mock("../lib/storage", async (orig) => ({
  ...(await orig<typeof import("../lib/storage")>()),
  loadCredentials: () => ({ clientId: "a", clientSecret: "b" }),
}));

describe("ReportHeader", () => {
  it("shows report identity and the nav buttons", () => {
    const report = reportFixture;
    render(
      <MemoryRouter>
        <ReportHeader report={report} onRefresh={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText(report.title)).toBeInTheDocument();
    expect(screen.getByText(report.zoneName, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: /refresh from wcl/i })).toBeInTheDocument();
  });
});
