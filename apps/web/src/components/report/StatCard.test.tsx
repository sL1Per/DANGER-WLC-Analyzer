import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard, StatCards } from "./StatCard";

describe("StatCard", () => {
  it("renders title and label/value rows with classNames", () => {
    render(
      <StatCard
        title="Thrall"
        rows={[
          { label: "Head", value: "Helm of Doom", className: "sev-major" },
          { label: "Neck", value: "Choker" },
        ]}
      />,
    );
    expect(screen.getByText("Thrall")).toBeInTheDocument();
    expect(screen.getByText("Head")).toBeInTheDocument();
    expect(screen.getByText("Helm of Doom").closest(".stat-card__row")).toHaveClass("sev-major");
  });

  it("StatCards wraps children in a grid container", () => {
    const { container } = render(<StatCards><div>x</div></StatCards>);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
  });
});
