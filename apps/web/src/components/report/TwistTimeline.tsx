import type { TwistSegment } from "@wcl/core";

/** viewBox width — slot windows are scaled into [0, W]. */
const W = 1000;
const pct = (f: number) => `${Math.round(f * 100)}%`;

/**
 * Air-totem twist timeline for one Shaman: one compact strip per fight showing
 * which totem held the (single) air-totem slot over time — Windfury in warm,
 * Grace of Air in cool. The per-fight split is printed on the right.
 */
export function TwistTimeline({
  playerName,
  segments,
}: {
  playerName: string;
  segments: TwistSegment[];
}) {
  if (segments.length === 0) return null;

  return (
    <figure className="twist-timeline">
      <figcaption>
        <span className="twist-who">{playerName}</span>
      </figcaption>
      {segments.map((s) => {
        const x = (t: number) => (s.durationMs > 0 ? (t / s.durationMs) * W : 0);
        return (
          <div className="twist-strip" key={s.fightId}>
            <span className="twist-fight">{s.fightName}</span>
            <svg
              className="twist-svg"
              viewBox={`0 0 ${W} 20`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${s.fightName}: air slot held Windfury ${pct(s.windfuryPct)}, Grace of Air ${pct(s.gracePct)}`}
            >
              <rect className="twist-lane-bg" x={0} y={0} width={W} height={20} />
              {s.slots.map((sl, i) => (
                <rect
                  key={i}
                  data-totem={sl.totem}
                  className={sl.totem === "windfury" ? "twist-seg twist-seg-wf" : "twist-seg twist-seg-goa"}
                  x={x(sl.start)}
                  y={0}
                  width={Math.max(x(sl.end) - x(sl.start), 0.5)}
                  height={20}
                />
              ))}
            </svg>
            <span className="twist-pct">
              <span className="twist-wf">{pct(s.windfuryPct)}</span>
              {" / "}
              <span className="twist-goa">{pct(s.gracePct)}</span>
            </span>
          </div>
        );
      })}
    </figure>
  );
}
