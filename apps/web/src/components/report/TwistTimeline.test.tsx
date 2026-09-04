import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TwistTimeline } from "./TwistTimeline";
import type { TwistSegment } from "@wcl/core";

const seg = (over: Partial<TwistSegment> = {}): TwistSegment => ({
  fightId: 1,
  fightName: "Teron Gorefiend",
  durationMs: 1000,
  windfury: [
    { start: 0, end: 260 },
    { start: 400, end: 560 },
  ],
  grace: [{ start: 250, end: 410 }],
  windfuryCastAt: [0, 400],
  graceCastAt: [250],
  ...over,
});

describe("TwistTimeline", () => {
  it("renders a strip per fight with the fight name and the uptime summary", () => {
    render(
      <TwistTimeline
        playerName="Blindberserk"
        windfuryUptime={0.62}
        graceUptime={0.47}
        segments={[seg(), seg({ fightId: 2, fightName: "Gurtogg Bloodboil" })]}
      />,
    );
    expect(screen.getByText("Teron Gorefiend")).toBeInTheDocument();
    expect(screen.getByText("Gurtogg Bloodboil")).toBeInTheDocument();
    // uptime summary, rounded to whole percent
    expect(screen.getByText(/Windfury 62%/)).toBeInTheDocument();
    expect(screen.getByText(/Grace of Air 47%/)).toBeInTheDocument();
  });

  it("draws a buff-window rect per interval and a tick per cast, scaled to the fight width", () => {
    const { container } = render(
      <TwistTimeline playerName="X" windfuryUptime={0.5} graceUptime={0.3} segments={[seg()]} />,
    );
    expect(container.querySelectorAll('rect[data-lane="windfury"]')).toHaveLength(2);
    expect(container.querySelectorAll('rect[data-lane="grace"]')).toHaveLength(1);
    expect(container.querySelectorAll('line[data-mark="windfury"]')).toHaveLength(2);
    expect(container.querySelectorAll('line[data-mark="grace"]')).toHaveLength(1);
    // the [400,560] windfury window on a 1000ms fight → x=40%, width=16% of a 1000-unit viewBox
    const second = container.querySelectorAll('rect[data-lane="windfury"]')[1]!;
    expect(second.getAttribute("x")).toBe("400");
    expect(second.getAttribute("width")).toBe("160");
  });

  it("renders nothing when there are no segments", () => {
    const { container } = render(
      <TwistTimeline playerName="X" windfuryUptime={0} graceUptime={0} segments={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
