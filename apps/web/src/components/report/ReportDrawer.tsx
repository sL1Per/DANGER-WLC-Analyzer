import { useEffect, useState, type ReactNode } from "react";

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
      <span className="report-slimbar__title">{title}</span>
      <span className="report-slimbar__active">{activeLabel}</span>
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
