import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "../test-utils/matchMedia";
import { ConsumableMatrix } from "./ConsumableMatrix";
import type { RpbConsumableRow } from "@wcl/core";

const rows = [
  { playerId: 1, playerName: "Thrall", className: "Shaman", counts: { drums: 3 }, uptimes: {} },
] as unknown as RpbConsumableRow[];
const catalog = [{ key: "drums", name: "Drums of Battle" }];

afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("ConsumableMatrix mobile", () => {
  it("renders one card per player on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
    expect(screen.getByText("Drums of Battle")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
