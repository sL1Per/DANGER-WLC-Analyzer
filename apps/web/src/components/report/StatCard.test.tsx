import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("renders a clickable title when onTitleClick is given", () => {
    const onClick = vi.fn();
    render(<StatCard title="Thrall" onTitleClick={onClick} rows={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Thrall" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("StatCards wraps children in a grid container", () => {
    const { container } = render(<StatCards><div>x</div></StatCards>);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
  });
});
