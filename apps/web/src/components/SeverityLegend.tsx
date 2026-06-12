/** Color key shared by every analysis tab (same scheme as the original sheet). */
export function SeverityLegend() {
  return (
    <p className="sev-legend">
      <span className="chip sev-major">red = big issue</span>
      <span className="chip sev-moderate">yellow = intermediate</span>
      <span className="chip sev-minor">green = small thing</span>
    </p>
  );
}
