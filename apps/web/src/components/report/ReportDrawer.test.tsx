import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ReportDrawer } from "./ReportDrawer";

const setup = () =>
  render(
    <MemoryRouter>
      <ReportDrawer title="My Raid" activeLabel="Gear · BOSSES">
        <button>Inside drawer</button>
      </ReportDrawer>
    </MemoryRouter>,
  );

describe("ReportDrawer", () => {
  it("starts closed: menu button shows aria-expanded=false and content is not visible", () => {
    setup();
    const btn = screen.getByRole("button", { name: /menu/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Inside drawer")).not.toBeInTheDocument();
  });

  it("opens on menu click and shows children", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    expect(screen.getByRole("button", { name: /menu/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Inside drawer")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Inside drawer")).not.toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    fireEvent.click(screen.getByTestId("drawer-backdrop"));
    expect(screen.queryByText("Inside drawer")).not.toBeInTheDocument();
  });

  it("renders the title and active label in the slim bar", () => {
    setup();
    expect(screen.getByText("My Raid")).toBeInTheDocument();
    expect(screen.getByText("Gear · BOSSES")).toBeInTheDocument();
  });
});
