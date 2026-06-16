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

/**
 * Inline style exposing the class color as the `--class-color` custom property.
 * CSS uses it for the class dot, left border, and `color-mix` header tints so a
 * single property drives every class-tinted element (and dark mode can adapt the
 * surrounding surface vars without per-class overrides).
 */
export function classColorVar(className: string): CSSProperties {
  return { "--class-color": classColor(className) } as CSSProperties;
}
