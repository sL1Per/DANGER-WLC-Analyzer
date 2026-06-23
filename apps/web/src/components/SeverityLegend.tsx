/** Color key shared by every analysis tab (same scheme as the original sheet). */
export function SeverityLegend() {
  return (
    <p className="sev-legend">
      <span className="sev-legend__item sev-major"><span className="sev-legend__dot" aria-hidden />problem</span>
      <span className="sev-legend__item sev-moderate"><span className="sev-legend__dot" aria-hidden />watch</span>
      <span className="sev-legend__item sev-minor"><span className="sev-legend__dot" aria-hidden />fine</span>
    </p>
  );
}
