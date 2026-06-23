import type { Fight, ReportData } from "@wcl/core";
import { CLASS_ORDER, classColorVar, classSlug } from "../lib/classColors";
import { ALL_FIGHTS } from "../lib/scopeReport";

export type Lens = "fight" | "player";

export function bossFights(report: ReportData): Fight[] {
  return report.fights.filter((f) => f.isBoss);
}

const secs = (f: Fight) => `${Math.round((f.endTime - f.startTime) / 1000)}s`;
const classRank = (c: string) => {
  const i = (CLASS_ORDER as readonly string[]).indexOf(c);
  return i === -1 ? CLASS_ORDER.length : i;
};

interface LensBarProps {
  report: ReportData;
  lens: Lens;
  fightId: number | null;
  playerId: number | null;
  query: string;
  onLens: (l: Lens) => void;
  onFight: (id: number) => void;
  onPlayer: (id: number) => void;
  onQuery: (q: string) => void;
}

export function LensBar({ report, lens, fightId, playerId, query, onLens, onFight, onPlayer, onQuery }: LensBarProps) {
  const players = [...report.players]
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => classRank(a.class) - classRank(b.class) || a.name.localeCompare(b.name));

  return (
    <div className="lens-bar">
      <div className="lens-toggle" role="group" aria-label="Report lens">
        <button className={lens === "fight" ? "active" : ""} onClick={() => onLens("fight")}>By Boss Fight</button>
        <button className={lens === "player" ? "active" : ""} onClick={() => onLens("player")}>By Player</button>
        <span className="lens-hint">
          {lens === "fight"
            ? "Reviewing one boss pull — everyone who was there."
            : "Reviewing one raider — everything they did, all night."}
        </span>
      </div>

      {lens === "fight" ? (
        <div className="lens-strip">
          {(() => {
            const bosses = bossFights(report);
            const totalSecs = Math.round(
              bosses.reduce((s, f) => s + (f.endTime - f.startTime), 0) / 1000,
            );
            const kills = bosses.filter((f) => f.kill).length;
            return (
              <button
                key="all"
                className={`fight-chip fight-chip--all${fightId === ALL_FIGHTS ? " selected" : ""}`}
                onClick={() => onFight(ALL_FIGHTS)}
              >
                <span className="fight-chip__name">ALL</span>
                <span className="pill pill--all">{kills}/{bosses.length} kills</span>
                <span className="mono fight-chip__meta">{totalSecs}s · {report.players.length} players</span>
              </button>
            );
          })()}
          {bossFights(report).map((f) => (
            <button
              key={f.id}
              className={`fight-chip${f.id === fightId ? " selected" : ""}`}
              onClick={() => onFight(f.id)}
            >
              <span className="fight-chip__name">{f.name}</span>
              <span className={`pill ${f.kill ? "pill--kill" : "pill--wipe"}`}>{f.kill ? "Kill" : "Wipe"}</span>
              <span className="mono fight-chip__meta">{secs(f)} · {report.players.length} players</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="lens-roster">
          <input
            className="roster-search"
            placeholder="Filter raiders…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Filter raiders"
          />
          <div className="lens-strip">
            {players.map((p) => (
              <button
                key={p.id}
                className={`player-chip cc-${classSlug(p.class)}${p.id === playerId ? " selected" : ""}`}
                style={classColorVar(p.class)}
                onClick={() => onPlayer(p.id)}
              >
                <span className="class-dot" /> {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
