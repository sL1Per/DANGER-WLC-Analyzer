import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PublishShare } from "./PublishShare";
import type { ReportData } from "@wcl/core";

vi.mock("../lib/share", () => ({
  publishSnapshot: vi.fn().mockResolvedValue("xyz123"),
  shareUrl: (id: string) => `https://app.test/s/${id}`,
}));

const report = { reportId: "abc", title: "T5", zoneName: "Karazhan" } as unknown as ReportData;

describe("PublishShare", () => {
  it("publishes on click and reveals the key-free share link", async () => {
    render(<MemoryRouter><PublishShare report={report} /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));
    await waitFor(() => expect(screen.getByDisplayValue("https://app.test/s/xyz123")).toBeInTheDocument());
  });
});
