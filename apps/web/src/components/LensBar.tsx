import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Fight, ReportData } from "@wcl/core";
import { classColorVar, CLASS_ORDER } from "../lib/classColors";
import { ALL_FIGHTS, ALL_TRASH } from "../lib/scopeReport";

export type Lens = "fight" | "player";

function bossFights(report: ReportData): Fight[] {
  return report.fights.filter((f) => f.isBoss);
}

function trashFights(report: ReportData): Fight[] {
  return report.fights.filter((f) => !f.isBoss);
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
  actions?: ReactNode;
}

export function LensBar({ report, lens, fightId, playerId, query, onLens, onFight, onPlayer, onQuery, actions }: LensBarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const bosses = bossFights(report);
  const trash = trashFights(report);
  const kills = bosses.filter((f) => f.kill).length;
  const players = [...report.players]
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => classRank(a.class) - classRank(b.class) || a.name.localeCompare(b.name));

  const currentFightLabel =
    fightId === ALL_FIGHTS ? "BOSSES" :
    fightId === ALL_TRASH ? "TRASH" :
    bosses.find((f) => f.id === fightId)?.name ?? trash.find((f) => f.id === fightId)?.name ?? "Select a fight";
  const currentFightDot =
    fightId === ALL_FIGHTS || fightId === ALL_TRASH ? "dot-all" :
    bosses.find((f) => f.id === fightId)?.kill ? "dot-kill" : "dot-wipe";
  const currentPlayerName = report.players.find((p) => p.id === playerId)?.name ?? "Select a raider";

  function pickFight(id: number) {
    onFight(id);
    setOpen(false);
  }
  function pickPlayer(id: number) {
    onPlayer(id);
    setOpen(false);
  }

  return (
    <div className="lens-bar">
      <div className="lens-toggle" role="group" aria-label="Report lens">
        <button className={lens === "fight" ? "active" : ""} onClick={() => onLens("fight")}>Boss fights</button>
        <button className={lens === "player" ? "active" : ""} onClick={() => onLens("player")}>Players details</button>
        <span className="lens-hint">
          {lens === "fight"
            ? "Reviewing one boss pull — everyone who was there."
            : "Reviewing one raider — everything they did, all night."}
        </span>
      </div>

      <div className="lens-controls">
        <div className="picker" ref={ref}>
          {lens === "fight" ? (
            <button type="button" className="picker__trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <span className={`picker__dot ${currentFightDot}`} aria-hidden />
              <span className="picker__label">{currentFightLabel}</span>
              <span className="picker__chevron" aria-hidden>▾</span>
            </button>
          ) : (
            <button type="button" className="picker__trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={classColorVar(report.players.find((p) => p.id === playerId)?.class ?? "")}>
              <span className="picker__dot" style={{ background: "var(--class-color, var(--text-subtle))" }} aria-hidden />
              <span className="picker__label">{currentPlayerName}</span>
              <span className="picker__chevron" aria-hidden>▾</span>
            </button>
          )}

          {open && lens === "fight" && (
            <div className="picker__panel" role="listbox">
              <div className="picker__list">
                <button type="button" data-testid="picker-row" className={`picker__row${fightId === ALL_FIGHTS ? " active" : ""}`} onClick={() => pickFight(ALL_FIGHTS)}>
                  <span className="picker__dot dot-all" aria-hidden />
                  <span className="picker__row-name">BOSSES</span>
                  <span className="picker__row-meta mono">{kills}/{bosses.length} kills</span>
                </button>
                {trash.length > 0 && (
                  <button type="button" data-testid="picker-row" className={`picker__row${fightId === ALL_TRASH ? " active" : ""}`} onClick={() => pickFight(ALL_TRASH)}>
                    <span className="picker__dot dot-all" aria-hidden />
                    <span className="picker__row-name">TRASH</span>
                    <span className="picker__row-meta mono">{trash.length} pulls</span>
                  </button>
                )}
                {bosses.map((f) => (
                  <button type="button" key={f.id} data-testid="picker-row" className={`picker__row${f.id === fightId ? " active" : ""}`} onClick={() => pickFight(f.id)}>
                    <span className={`picker__dot ${f.kill ? "dot-kill" : "dot-wipe"}`} aria-hidden />
                    <span className="picker__row-name">{f.name}</span>
                    <span className="picker__row-meta mono">{secs(f)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {open && lens === "player" && (
            <div className="picker__panel" role="listbox">
              <input
                className="picker__search"
                placeholder="Filter raiders…"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                aria-label="Filter raiders"
              />
              <div className="picker__list">
                {players.map((p) => (
                  <button type="button" key={p.id} data-testid="picker-row" className={`picker__row${p.id === playerId ? " active" : ""}`} style={classColorVar(p.class)} onClick={() => pickPlayer(p.id)}>
                    <span className="picker__dot" style={{ background: "var(--class-color, var(--text-subtle))" }} aria-hidden />
                    <span className="picker__row-name" style={{ color: "var(--class-color, inherit)" }}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {actions && <span className="lens-toggle__actions">{actions}</span>}
      </div>
    </div>
  );
}
