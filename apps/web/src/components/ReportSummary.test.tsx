import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { ReportSummary } from "./ReportSummary";

// vitest does not expose afterEach as a global (globals:true is off), so
// testing-library cannot auto-register its cleanup. Wire it explicitly.
afterEach(() => cleanup());

describe("ReportSummary", () => {
  it("shows report metadata, fights and players", () => {
    render(<ReportSummary report={reportFixture} cachedAt={Date.now()} />);
    expect(screen.getByText("T5 fun")).toBeTruthy();
    expect(screen.getByText("Serpentshrine Cavern", { exact: false })).toBeTruthy();
    expect(screen.getAllByText("Hydross the Unstable").length).toBe(2);
    expect(screen.getByText("Playerone")).toBeTruthy();
  });
  it("color-codes kills green and wipes red", () => {
    render(<ReportSummary report={reportFixture} cachedAt={Date.now()} />);
    const cells = screen.getAllByRole("cell");
    expect(cells.some((c) => c.textContent?.trim() === "kill" && c.className === "sev-ok")).toBe(true);
    expect(cells.some((c) => c.textContent?.trim() === "wipe" && c.className === "sev-major")).toBe(true);
  });
  it("filters to bosses without wipes via the controls", async () => {
    const { getByLabelText, queryAllByText } = render(
      <ReportSummary report={reportFixture} cachedAt={Date.now()} />,
    );
    // fireEvent wraps in act and drives React 19 state updates synchronously
    await act(async () => {
      fireEvent.click(getByLabelText("only bosses") as HTMLInputElement);
    });
    await act(async () => {
      fireEvent.click(getByLabelText("no wipes") as HTMLInputElement);
    });
    // wipe fight 2 disappears, kill fight 3 stays
    expect(queryAllByText("Hydross the Unstable").length).toBe(1);
    expect(queryAllByText("Underbog Colossus").length).toBe(0);
  });
});
