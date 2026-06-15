import { describe, expect, it } from "vitest";
import {
  heatClass, deathsHeat, friendlyFireHeat, uptimeHeat, activeHeat, severityHeat,
} from "./heatmap";

describe("heatmap", () => {
  it("flags any death as bad, none as good", () => {
    expect(deathsHeat(0)).toBe("good");
    expect(deathsHeat(2)).toBe("bad");
  });
  it("maps friendly fire to watch when present", () => {
    expect(friendlyFireHeat(0)).toBe("good");
    expect(friendlyFireHeat(5)).toBe("watch");
  });
  it("buckets uptime fractions", () => {
    expect(uptimeHeat(0.95)).toBe("good");
    expect(uptimeHeat(0.6)).toBe("watch");
    expect(uptimeHeat(0.2)).toBe("bad");
  });
  it("buckets activity fractions", () => {
    expect(activeHeat(0.9)).toBe("good");
    expect(activeHeat(0.7)).toBe("watch");
    expect(activeHeat(0.4)).toBe("bad");
  });
  it("maps core severity buckets to heat", () => {
    expect(severityHeat("major")).toBe("bad");
    expect(severityHeat("moderate")).toBe("watch");
    expect(severityHeat("minor")).toBe("good");
    expect(severityHeat("ok")).toBe("good");
  });
  it("maps heat buckets to sev css classes", () => {
    expect(heatClass("good")).toBe("sev-minor");
    expect(heatClass("watch")).toBe("sev-moderate");
    expect(heatClass("bad")).toBe("sev-major");
    expect(heatClass("neutral")).toBe("sev-neutral");
  });
});
