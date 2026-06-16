import { describe, expect, it } from "vitest";
import { parseBand, parseClass } from "./parseColor";

describe("parseBand", () => {
  it("maps percentiles to WCL bands at the boundaries", () => {
    expect(parseBand(0)).toBe("common");
    expect(parseBand(24)).toBe("common");
    expect(parseBand(25)).toBe("uncommon");
    expect(parseBand(49)).toBe("uncommon");
    expect(parseBand(50)).toBe("rare");
    expect(parseBand(74)).toBe("rare");
    expect(parseBand(75)).toBe("epic");
    expect(parseBand(94)).toBe("epic");
    expect(parseBand(95)).toBe("legendary");
    expect(parseBand(98)).toBe("legendary");
    expect(parseBand(99)).toBe("astounding");
    expect(parseBand(100)).toBe("artifact");
  });
});

describe("parseClass", () => {
  it("prefixes the band with parse-", () => {
    expect(parseClass(95)).toBe("parse-legendary");
    expect(parseClass(10)).toBe("parse-common");
  });
});
