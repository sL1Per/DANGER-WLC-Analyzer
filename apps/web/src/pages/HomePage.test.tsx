import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./HomePage";

function setup() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/report/:reportId" element={<div>REPORT PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  it("navigates to the report when a valid id is analyzed", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/report url or id/i), { target: { value: "abcdEFGH12345678" } });
    fireEvent.click(screen.getByRole("button", { name: /analyze/i }));
    expect(screen.getByText("REPORT PAGE")).toBeInTheDocument();
  });
  it("rejects junk input", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/report url or id/i), { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: /analyze/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
