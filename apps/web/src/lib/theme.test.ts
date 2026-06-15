import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, resolveInitialTheme, setTheme } from "./theme";
import { loadTheme } from "./storage";

beforeEach(() => localStorage.clear());
afterEach(() => {
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

function stubPrefersDark(matches: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("dark") ? matches : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe("resolveInitialTheme", () => {
  it("prefers a stored choice over the OS preference", () => {
    localStorage.setItem("wcl.theme", "light");
    stubPrefersDark(true);
    expect(resolveInitialTheme()).toBe("light");
  });
  it("falls back to the OS dark preference when nothing stored", () => {
    stubPrefersDark(true);
    expect(resolveInitialTheme()).toBe("dark");
  });
  it("defaults to light when nothing stored and OS is not dark", () => {
    stubPrefersDark(false);
    expect(resolveInitialTheme()).toBe("light");
  });
});

describe("applyTheme / setTheme", () => {
  it("applyTheme sets the data-theme attribute", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("setTheme persists and applies", () => {
    setTheme("dark");
    expect(loadTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
