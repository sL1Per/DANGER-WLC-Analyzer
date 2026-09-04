import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Fight, ReportData } from "@wcl/core";
import { ALL_FIGHTS, ALL_TRASH } from "../lib/scopeReport";

function bossFights(report: ReportData): Fight[] {
  return report.fights.filter((f) => f.isBoss);
}

function trashFights(report: ReportData): Fight[] {
  return report.fights.filter((f) => !f.isBoss);
}

const secs = (f: Fight) => `${Math.round((f.endTime - f.startTime) / 1000)}s`;

interface LensBarProps {
  report: ReportData;
  fightId: number | null;
  onFight: (id: number) => void;
  actions?: ReactNode;
}

export function LensBar({ report, fightId, onFight, actions }: LensBarProps) {
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

  const currentFightLabel =
    fightId === ALL_FIGHTS ? "BOSSES" :
    fightId === ALL_TRASH ? "TRASH" :
    bosses.find((f) => f.id === fightId)?.name ?? trash.find((f) => f.id === fightId)?.name ?? "Select a fight";
  const currentFightDot =
    fightId === ALL_FIGHTS || fightId === ALL_TRASH ? "dot-all" :
    bosses.find((f) => f.id === fightId)?.kill ? "dot-kill" : "dot-wipe";

  function pickFight(id: number) {
    onFight(id);
    setOpen(false);
  }

  return (
    <div className="lens-bar">
      <div className="lens-controls">
        <div className="picker" ref={ref}>
          <button type="button" className="picker__trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span className={`picker__dot ${currentFightDot}`} aria-hidden />
            <span className="picker__label">{currentFightLabel}</span>
            <span className="picker__chevron" aria-hidden>▾</span>
          </button>

          {open && (
            <div className="picker__panel" role="listbox">
              <div className="picker__list">
                <button type="button" role="option" aria-selected={fightId === ALL_FIGHTS} data-testid="picker-row" className={`picker__row${fightId === ALL_FIGHTS ? " active" : ""}`} onClick={() => pickFight(ALL_FIGHTS)}>
                  <span className="picker__dot dot-all" aria-hidden />
                  <span className="picker__row-name">BOSSES</span>
                  <span className="picker__row-meta mono">{kills}/{bosses.length} kills</span>
                </button>
                {trash.length > 0 && (
                  <button type="button" role="option" aria-selected={fightId === ALL_TRASH} data-testid="picker-row" className={`picker__row${fightId === ALL_TRASH ? " active" : ""}`} onClick={() => pickFight(ALL_TRASH)}>
                    <span className="picker__dot dot-all" aria-hidden />
                    <span className="picker__row-name">TRASH</span>
                    <span className="picker__row-meta mono">{trash.length} pulls</span>
                  </button>
                )}
                {bosses.map((f) => (
                  <button type="button" role="option" aria-selected={f.id === fightId} key={f.id} data-testid="picker-row" className={`picker__row${f.id === fightId ? " active" : ""}`} onClick={() => pickFight(f.id)}>
                    <span className={`picker__dot ${f.kill ? "dot-kill" : "dot-wipe"}`} aria-hidden />
                    <span className="picker__row-name">{f.name}</span>
                    <span className="picker__row-meta mono">{secs(f)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="lens-hint">Reviewing one boss pull — everyone who was there.</span>
        {actions && <span className="lens-toggle__actions">{actions}</span>}
      </div>
    </div>
  );
}
