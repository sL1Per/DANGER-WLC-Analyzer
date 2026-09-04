import type { TwistSegment } from "@wcl/core";

/** viewBox width — buff windows and cast marks are scaled into [0, W]. */
const W = 1000;
const pct = (f: number) => `${Math.round(f * 100)}%`;

/**
 * Windfury / Grace of Air totem twist timeline for one Shaman: one strip per
 * fight, two lanes (Windfury on top, Grace of Air below) showing when each totem
 * ally-buff was on the shaman, with a tick at every totem drop. All input times
 * are fight-relative ms; each strip is scaled to its own fight length so strips
 * of different fights line up visually.
 */
export function TwistTimeline({
  playerName,
  windfuryUptime,
  graceUptime,
  segments,
}: {
  playerName: string;
  windfuryUptime: number;
  graceUptime: number;
  segments: TwistSegment[];
}) {
  if (segments.length === 0) return null;

  return (
    <figure className="twist-timeline">
      <figcaption>
        <span className="twist-who">{playerName}</span> totem twist —{" "}
        <span className="twist-key twist-wf">Windfury {pct(windfuryUptime)}</span>
        {" · "}
        <span className="twist-key twist-goa">Grace of Air {pct(graceUptime)}</span>
      </figcaption>
      {segments.map((s) => {
        const x = (t: number) => (s.durationMs > 0 ? (t / s.durationMs) * W : 0);
        return (
          <div className="twist-strip" key={s.fightId}>
            <span className="twist-fight">{s.fightName}</span>
            <svg
              className="twist-svg"
              viewBox={`0 0 ${W} 40`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${s.fightName}: Windfury and Grace of Air totem coverage`}
            >
              <rect className="twist-lane-bg" x={0} y={2} width={W} height={16} />
              <rect className="twist-lane-bg" x={0} y={22} width={W} height={16} />
              {s.windfury.map((w, i) => (
                <rect
                  key={`w${i}`}
                  data-lane="windfury"
                  className="twist-win twist-win-wf"
                  x={x(w.start)}
                  y={2}
                  width={Math.max(x(w.end) - x(w.start), 0.5)}
                  height={16}
                />
              ))}
              {s.grace.map((w, i) => (
                <rect
                  key={`g${i}`}
                  data-lane="grace"
                  className="twist-win twist-win-goa"
                  x={x(w.start)}
                  y={22}
                  width={Math.max(x(w.end) - x(w.start), 0.5)}
                  height={16}
                />
              ))}
              {s.windfuryCastAt.map((t, i) => (
                <line
                  key={`wc${i}`}
                  data-mark="windfury"
                  className="twist-mark twist-mark-wf"
                  x1={x(t)}
                  x2={x(t)}
                  y1={0}
                  y2={20}
                />
              ))}
              {s.graceCastAt.map((t, i) => (
                <line
                  key={`gc${i}`}
                  data-mark="grace"
                  className="twist-mark twist-mark-goa"
                  x1={x(t)}
                  x2={x(t)}
                  y1={20}
                  y2={40}
                />
              ))}
            </svg>
          </div>
        );
      })}
    </figure>
  );
}
