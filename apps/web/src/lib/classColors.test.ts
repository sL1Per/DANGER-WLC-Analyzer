import { describe, expect, it } from "vitest";
import { classColor, classColorVar, classSlug, CLASS_ORDER } from "./classColors";

describe("classColors", () => {
  it("returns the standard color for a known class", () => {
    expect(classColor("Mage")).toBe("#69CCF0");
    expect(classColor("Warlock")).toBe("#9482C9");
  });
  it("falls back to a neutral color for an unknown/missing class", () => {
    expect(classColor("Tinker")).toBe("#9aa3b2");
    expect(classColor("")).toBe("#9aa3b2");
  });
  it("lists the nine TBC classes in canonical order, Warrior first", () => {
    expect(CLASS_ORDER[0]).toBe("Warrior");
    expect(CLASS_ORDER).toContain("Druid");
    expect(CLASS_ORDER).toHaveLength(9);
  });
});

describe("classColorVar via CSS vars", () => {
  it("references the per-class CSS variable, not a raw hex", () => {
    expect(classColorVar("Mage")).toEqual({ "--class-color": "var(--cc-mage)" });
  });
  it("maps unknown classes to the neutral slug", () => {
    expect(classSlug("Tinkerer")).toBe("neutral");
    expect(classColorVar("Tinkerer")).toEqual({ "--class-color": "var(--cc-neutral)" });
  });
});
