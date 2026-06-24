import { describe, expect, it } from "vitest";
import { reportFixture, rpb, consumables } from "@wcl/core";
import { buildRpbConfig, consumablesConfig, roleCastsConfig, roleSheetConfig } from "./analysisConfig";

describe("analysisConfig", () => {
  it("buildRpbConfig drives a successful rpb() run", () => {
    const out = rpb(reportFixture, buildRpbConfig());
    expect(out).not.toBeNull();
    expect(out!.rows.length).toBeGreaterThan(0);
  });
  it("consumablesConfig drives a successful consumables() run", () => {
    expect(consumables(reportFixture, consumablesConfig)).not.toBeNull();
  });
  it("builds role sheet and casts configs", () => {
    expect(roleCastsConfig().catalog.length).toBeGreaterThan(0);
    expect(roleSheetConfig().avoidableDebuffIds.length).toBeGreaterThan(0);
  });
});
