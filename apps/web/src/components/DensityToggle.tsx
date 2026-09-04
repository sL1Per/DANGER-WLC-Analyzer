import { useState } from "react";
import { resolveInitialDensity, setDensity, type Density } from "../lib/density";

export function DensityToggle() {
  const [density, setDensityState] = useState<Density>(resolveInitialDensity);

  function pick(d: Density) {
    setDensity(d);
    setDensityState(d);
  }

  return (
    <div className="toggle" role="group" aria-label="Table density">
      <button type="button" className={density === "comfortable" ? "active" : ""} aria-pressed={density === "comfortable"} onClick={() => pick("comfortable")}>
        Comfortable
      </button>
      <button type="button" className={density === "compact" ? "active" : ""} aria-pressed={density === "compact"} onClick={() => pick("compact")}>
        Compact
      </button>
    </div>
  );
}
