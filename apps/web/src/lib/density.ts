import { loadDensity, saveDensity, type Density } from "./storage";

export type { Density };

export function resolveInitialDensity(): Density {
  return loadDensity() ?? "comfortable";
}

export function applyDensity(density: Density): void {
  document.documentElement.dataset.density = density;
}

export function setDensity(density: Density): void {
  saveDensity(density);
  applyDensity(density);
}
