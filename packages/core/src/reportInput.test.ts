import { describe, expect, it } from "vitest";
import { parseReportInput } from "./reportInput";

describe("parseReportInput", () => {
  it("accepts a bare report id", () => {
    expect(parseReportInput("a1B2c3D4e5F6g7H8")).toBe("a1B2c3D4e5F6g7H8");
  });
  it("extracts the id from a classic WCL url with fragment", () => {
    expect(parseReportInput("https://classic.warcraftlogs.com/reports/a1B2c3D4e5F6g7H8#fight=28"))
      .toBe("a1B2c3D4e5F6g7H8");
  });
  it("extracts from fresh/vanilla hosts and trailing slash", () => {
    expect(parseReportInput("https://fresh.warcraftlogs.com/reports/a1B2c3D4e5F6g7H8/"))
      .toBe("a1B2c3D4e5F6g7H8");
  });
  it("rejects garbage", () => {
    expect(parseReportInput("not a report")).toBeNull();
    expect(parseReportInput("")).toBeNull();
  });
  it("rejects lookalike domains", () => {
    expect(parseReportInput("https://fake-warcraftlogs.com/reports/a1B2c3D4e5F6g7H8")).toBeNull();
  });
});
