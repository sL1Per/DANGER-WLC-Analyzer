import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppFooter } from "./AppFooter";

describe("AppFooter", () => {
  it("shows the app version linked to the changelog", () => {
    render(<AppFooter />);
    const version = screen.getByRole("link", { name: `v${__APP_VERSION__}` });
    expect(version.getAttribute("href")).toMatch(/CHANGELOG\.md$/);
    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("links the GitHub repository and credits the original sheets", () => {
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe("https://github.com/sL1Per/DANGER-WLC-Analyzer");
    expect(screen.getByText(/Inspired by Shariva/)).toBeTruthy();
  });
});
