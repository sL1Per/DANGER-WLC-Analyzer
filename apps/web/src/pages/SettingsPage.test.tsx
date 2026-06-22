import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("saves credentials and confirms", () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/client id/i), { target: { value: "id" } });
    fireEvent.change(screen.getByLabelText(/client secret/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByText(/saved to this browser/i)).toBeInTheDocument();
  });
  it("rejects an invalid webhook url", () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/webhook url/i), { target: { value: "http://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /save webhook/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
