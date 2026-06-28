import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface ReportDrawerProps {
  title: string;
  activeLabel: string;
  children: ReactNode;
}

export function ReportDrawer({ title, activeLabel, children }: ReportDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="report-slimbar">
      <div className="report-slimbar__brand">
        <Link to="/" className="report-slimbar__logo">
          <img src="/favicon.svg" alt="" className="report-slimbar__logo-icon" />
          <span className="report-slimbar__logo-text">DANGER Raid Analyzer</span>
        </Link>
        <button
          type="button"
          className="report-slimbar__menu"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="report-drawer"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden>☰</span>
        </button>
      </div>
      <div className="report-slimbar__info">
        <span className="report-slimbar__title">{title}</span>
        <span className="report-slimbar__active">{activeLabel}</span>
      </div>

      {open && (
        <>
          <div className="report-drawer__backdrop" data-testid="drawer-backdrop" onClick={() => setOpen(false)} />
          <div
            id="report-drawer"
            className="report-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Report navigation"
            onClick={() => setOpen(false)}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
