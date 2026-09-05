import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TwistTimeline } from "./TwistTimeline";
import type { TwistSegment } from "@wcl/core";

const seg = (over: Partial<TwistSegment> = {}): TwistSegment => ({
  fightId: 1,
  fightName: "Teron Gorefiend",
  durationMs: 1000,
  windfuryPct: 0.6,
  gracePct: 0.4,
  slots: [
    { start: 0, end: 400, totem: "windfury" },
    { start: 400, end: 600, totem: "grace" },
    { start: 600, end: 1000, totem: "windfury" },
  ],
  ...over,
});

describe("TwistTimeline", () => {
  it("renders a strip per fight with the fight name and a per-fight split", () => {
    render(
      <TwistTimeline
        playerName="Blindberserk"
        segments={[seg(), seg({ fightId: 2, fightName: "Gurtogg Bloodboil", windfuryPct: 0.5, gracePct: 0.5 })]}
      />,
    );
    expect(screen.getByText("Blindberserk")).toBeInTheDocument();
    expect(screen.getByText("Teron Gorefiend")).toBeInTheDocument();
    expect(screen.getByText("Gurtogg Bloodboil")).toBeInTheDocument();
    // per-fight split for the first strip (Windfury / Grace of Air)
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("draws one slot rect per occupancy segment, scaled to the fight width", () => {
    const { container } = render(<TwistTimeline playerName="X" segments={[seg()]} />);
    const wf = container.querySelectorAll('rect[data-totem="windfury"]');
    const goa = container.querySelectorAll('rect[data-totem="grace"]');
    expect(wf).toHaveLength(2);
    expect(goa).toHaveLength(1);
    // the grace slot [400,600] on a 1000ms fight → x=40%, width=20% of a 1000-unit viewBox
    expect(goa[0]!.getAttribute("x")).toBe("400");
    expect(goa[0]!.getAttribute("width")).toBe("200");
  });

  it("renders nothing when there are no segments", () => {
    const { container } = render(<TwistTimeline playerName="X" segments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
