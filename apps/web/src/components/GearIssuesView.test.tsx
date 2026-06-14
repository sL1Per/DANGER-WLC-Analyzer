import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { GearIssuesView } from "./GearIssuesView";

afterEach(cleanup);

describe("GearIssuesView", () => {
  it("lists players with their gear issues", () => {
    render(<GearIssuesView report={reportFixture} />);
    expect(screen.getByText("Playerone")).toBeTruthy();
    expect(screen.getAllByText(/no enchant/).length).toBeGreaterThan(0);
  });
  it("color-codes issues by severity", () => {
    render(<GearIssuesView report={reportFixture} />);
    const major = screen.getAllByText(/no enchant/)[0]!.closest("li");
    expect(major?.className).toBe("sev-major");
    const minor = screen.getAllByText(/uncommon gem used/)[0]!.closest("li");
    expect(minor?.className).toBe("sev-minor");
  });
  it("min gem quality select changes flagged gems", () => {
    render(<GearIssuesView report={reportFixture} />);
    expect(screen.getAllByText(/uncommon gem used/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("minimum gem quality"), { target: { value: "2" } });
    expect(screen.queryAllByText(/uncommon gem used/).length).toBe(0);
  });
});
