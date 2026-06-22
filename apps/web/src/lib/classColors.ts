import type { CSSProperties } from "react";

// Canonical WoW Classic TBC class order (no Death Knight in TBC).
export const CLASS_ORDER = [
  "Warrior", "Paladin", "Hunter", "Rogue", "Priest",
  "Shaman", "Mage", "Warlock", "Druid",
] as const;

// Standard WoW class colors (WCL `Player.class` strings → hex).
const CLASS_COLORS: Record<string, string> = {
  Warrior: "#C79C6E",
  Paladin: "#F58CBA",
  Hunter: "#ABD473",
  Rogue: "#FFF569",
  Priest: "#FFFFFF",
  Shaman: "#0070DE",
  Mage: "#69CCF0",
  Warlock: "#9482C9",
  Druid: "#FF7D0A",
};

const NEUTRAL = "#9aa3b2";

export function classColor(className: string): string {
  return CLASS_COLORS[className] ?? NEUTRAL;
}

const KNOWN = new Set((CLASS_ORDER as readonly string[]).map((c) => c.toLowerCase()));

/** CSS-var slug for a class, e.g. "Mage" → "mage"; unknown → "neutral". */
export function classSlug(className: string): string {
  const s = className.toLowerCase();
  return KNOWN.has(s) ? s : "neutral";
}

/**
 * Inline style exposing the class color as the `--class-color` custom property.
 * It points at a per-class CSS variable (`--cc-<slug>`) defined in theme.css so
 * dark mode can lighten individual classes without per-class JS branches. CSS
 * uses `--class-color` for the class dot, left border, and `color-mix` header
 * tints so a single property drives every class-tinted element.
 */
export function classColorVar(className: string): CSSProperties {
  return { "--class-color": `var(--cc-${classSlug(className)})` } as CSSProperties;
}
