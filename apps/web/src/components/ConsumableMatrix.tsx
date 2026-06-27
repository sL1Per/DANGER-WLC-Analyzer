import type { RpbConsumableRow } from "@wcl/core";
import { CLASS_ORDER, classColorVar } from "../lib/classColors";
import { relativeHeat, heatClass } from "../lib/heatmap";
import { useIsPhone } from "../lib/useMediaQuery";
import { StatCard, StatCards } from "./report/StatCard";

const classRank = (c: string): number => {
  const i = (CLASS_ORDER as readonly string[]).indexOf(c);
  return i === -1 ? CLASS_ORDER.length : i;
};

/**
 * Per-player consumable use counts on boss fights. Rows = consumables (catalog
 * order); columns = players grouped and colored by class (canonical WoW order).
 * Each row is a relative heatmap: min-max scaled across the raid, so the
 * lightest user sits at the red end and the heaviest at the green end. Empty
 * (zero) cells stay neutral rather than painting non-users red, and an all-zero
 * row (nobody used it) is neutral throughout.
 */
export function ConsumableMatrix({
  rows,
  catalog,
  onPlayer,
}: {
  rows: RpbConsumableRow[];
  catalog: { key: string; name: string; uptime?: boolean }[];
  onPlayer?: (name: string) => void;
}) {
  const isPhone = useIsPhone();

  if (rows.length === 0) {
    return <p className="muted">No boss-fight data for consumables.</p>;
  }

  const players = [...rows].sort(
    (a, b) => classRank(a.className) - classRank(b.className) || a.playerName.localeCompare(b.playerName),
  );

  if (isPhone) {
    return (
      <StatCards>
        {players.map((p) => (
          <StatCard
            key={p.playerId}
            title={p.playerName}
            titleStyle={classColorVar(p.className)}
            onTitleClick={onPlayer ? () => onPlayer(p.playerName) : undefined}
            rows={catalog
              .map((c) => {
                const count = p.counts[c.key] ?? 0;
                if (count === 0) return null;
                const value = c.uptime
                  ? `${count} (${Math.round((p.uptimes?.[c.key] ?? 0) * 100)}%)`
                  : String(count);
                return { label: c.name, value };
              })
              .filter((r): r is { label: string; value: string } => r !== null)}
          />
        ))}
      </StatCards>
    );
  }

  return (
    <div className="consumable-card scroll-x">
      <table className="consumable-matrix">
        <thead>
          <tr>
            <th className="consumable-corner" scope="col">Consumable</th>
            {players.map((p) => (
              <th key={p.playerId} className="player-col" style={classColorVar(p.className)} scope="col">
                {onPlayer ? (
                  <button className="player-col__name player-link" onClick={() => onPlayer(p.playerName)}>{p.playerName}</button>
                ) : (
                  <span className="player-col__name">{p.playerName}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {catalog.map((c) => {
            const counts = players.map((p) => p.counts[c.key] ?? 0);
            // Uptime rows heat-scale on the uptime fraction (the meaningful signal),
            // count rows on the cast count. Display differs too: "N (P%)" vs "N".
            const vals = c.uptime ? players.map((p) => p.uptimes?.[c.key] ?? 0) : counts;
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            return (
              <tr key={c.key}>
                <th scope="row" className="consumable-label">{c.name}</th>
                {players.map((p, i) => (
                  <td
                    key={p.playerId}
                    className={heatClass(counts[i] > 0 ? relativeHeat(vals[i], min, max) : "neutral")}
                  >
                    {counts[i] > 0
                      ? c.uptime
                        ? `${counts[i]} (${Math.round((p.uptimes?.[c.key] ?? 0) * 100)}%)`
                        : counts[i]
                      : ""}
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
