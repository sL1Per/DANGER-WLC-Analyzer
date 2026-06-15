import { loadTheme, saveTheme, type Theme } from "./storage";

export type { Theme };

// First visit follows the OS preference; once the user toggles, their choice
// is remembered (saved by setTheme) and wins over the OS preference.
export function resolveInitialTheme(): Theme {
  const stored = loadTheme();
  if (stored) return stored;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme): void {
  saveTheme(theme);
  applyTheme(theme);
}
