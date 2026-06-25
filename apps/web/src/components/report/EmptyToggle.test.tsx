import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EmptyToggle } from "./EmptyToggle";

function Sample() {
  return (
    <table>
      <tbody>
        <tr data-testid="full"><th>Crit</th><td>5</td></tr>
        <tr data-testid="empty"><th>Dodge</th><td>—</td></tr>
      </tbody>
    </table>
  );
}

describe("EmptyToggle", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("renders the toggle and leaves tables untouched by default", () => {
    render(<EmptyToggle><Sample /></EmptyToggle>);
    expect(screen.getByText(/hide empty rows/i)).toBeInTheDocument();
    expect(screen.getByTestId("empty").classList.contains("eh-hidden")).toBe(false);
  });

  it("hides empty rows when toggled on, and restores when toggled off", () => {
    render(<EmptyToggle><Sample /></EmptyToggle>);
    const box = screen.getByRole("checkbox");

    fireEvent.click(box);
    expect(screen.getByTestId("empty").classList.contains("eh-hidden")).toBe(true);
    expect(screen.getByTestId("full").classList.contains("eh-hidden")).toBe(false);

    fireEvent.click(box);
    expect(screen.getByTestId("empty").classList.contains("eh-hidden")).toBe(false);
  });

  it("starts hidden when the preference was persisted", () => {
    localStorage.setItem("wcl.hideEmpty", "1");
    render(<EmptyToggle><Sample /></EmptyToggle>);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByTestId("empty").classList.contains("eh-hidden")).toBe(true);
  });
});
