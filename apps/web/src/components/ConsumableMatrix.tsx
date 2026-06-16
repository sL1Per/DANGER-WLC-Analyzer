import type { RpbConsumableRow } from "@wcl/core";
import { CLASS_ORDER, classColorVar } from "../lib/classColors";
import { relativeHeat, heatClass } from "../lib/heatmap";

const classRank = (c: string): number => {
  const i = (CLASS_ORDER as readonly string[]).indexOf(c);
  return i === -1 ? CLASS_ORDER.length : i;
};

/**
 * Per-player consumable use counts on boss fights. Rows = consumables (catalog
 * order); columns = players grouped and colored by class (canonical WoW order).
 * Each row is a relative heatmap: min-max scaled across the raid, so non-users
 * sit at the red end and the heaviest user at the green end. An all-zero row
 * (nobody used it) stays neutral rather than painting everyone red.
 */
export function ConsumableMatrix({
  rows,
  catalog,
}: {
  rows: RpbConsumableRow[];
  catalog: { key: string; name: string }[];
}) {
  if (rows.length === 0) {
    return <p className="muted">No boss-fight data for consumables.</p>;
  }

  const players = [...rows].sort(
    (a, b) => classRank(a.className) - classRank(b.className) || a.playerName.localeCompare(b.playerName),
  );

  return (
    <div className="scroll-x">
      <table className="consumable-matrix">
        <thead>
          <tr>
            <th />
            {players.map((p) => (
              <th key={p.playerId} className="player-col" style={classColorVar(p.className)}>
                <span className="class-dot" /> {p.playerName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {catalog.map((c) => {
            const vals = players.map((p) => p.counts[c.key] ?? 0);
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            return (
              <tr key={c.key}>
                <th scope="row" className="consumable-label">{c.name}</th>
                {players.map((p, i) => (
                  <td key={p.playerId} className={heatClass(relativeHeat(vals[i], min, max))}>
                    {vals[i] || ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
