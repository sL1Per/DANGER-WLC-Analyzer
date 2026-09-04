import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DensityToggle } from "./DensityToggle";

describe("DensityToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-density");
  });

  it("renders comfortable and compact options", () => {
    render(<DensityToggle />);
    expect(screen.getByRole("button", { name: /comfortable/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compact/i })).toBeInTheDocument();
  });

  it("switches to compact on click", () => {
    render(<DensityToggle />);
    fireEvent.click(screen.getByRole("button", { name: /compact/i }));
    expect(document.documentElement.dataset.density).toBe("compact");
  });
});
