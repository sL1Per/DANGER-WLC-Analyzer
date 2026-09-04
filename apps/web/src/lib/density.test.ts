import { describe, expect, it, beforeEach } from "vitest";
import { resolveInitialDensity, applyDensity, setDensity } from "./density";

describe("density lib", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-density");
  });

  it("defaults to comfortable with nothing stored", () => {
    expect(resolveInitialDensity()).toBe("comfortable");
  });

  it("resolves a previously-saved density", () => {
    localStorage.setItem("wcl.density", "compact");
    expect(resolveInitialDensity()).toBe("compact");
  });

  it("applyDensity sets data-density on the document root", () => {
    applyDensity("compact");
    expect(document.documentElement.dataset.density).toBe("compact");
  });

  it("setDensity persists and applies", () => {
    setDensity("compact");
    expect(localStorage.getItem("wcl.density")).toBe("compact");
    expect(document.documentElement.dataset.density).toBe("compact");
  });
});
