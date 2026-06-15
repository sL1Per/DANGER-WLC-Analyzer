import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { loadLastReportId } from "../lib/storage";
import { ThemeToggle } from "./ThemeToggle";

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 21v-6h5v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCla() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M4 4v15a1 1 0 0 0 1 1h15" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="11" width="3" height="6" rx="0.5" />
      <rect x="12" y="7" width="3" height="10" rx="0.5" />
      <rect x="17" y="13" width="3" height="4" rx="0.5" />
    </svg>
  );
}

function IconRpb() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="9" cy="8" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20a6 6 0 0 1 12 0" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 14.2A6 6 0 0 1 21 20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H1.8a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V1.8a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const lastReportId = loadLastReportId();
  const path = useLocation().pathname;
  const onCla = path.startsWith("/cla/");
  const onRpb = path.startsWith("/rpb/");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__mark" aria-hidden>
            W
          </div>
          <div>
            <div className="sidebar__title">WCL Raid Analyzer</div>
            <div className="sidebar__subtitle">TBC log analytics</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          <NavLink to="/" end className="navitem">
            <IconHome />
            Home
          </NavLink>
          {lastReportId ? (
            <Link
              to={`/cla/${lastReportId}`}
              className={onCla ? "navitem active" : "navitem"}
            >
              <IconCla />
              CLA
            </Link>
          ) : (
            <span
              className="navitem navitem--disabled"
              title="Analyze a report from Home first"
              aria-disabled
            >
              <IconCla />
              CLA
            </span>
          )}
          {lastReportId ? (
            <Link
              to={`/rpb/${lastReportId}`}
              className={onRpb ? "navitem active" : "navitem"}
            >
              <IconRpb />
              RPB
            </Link>
          ) : (
            <span
              className="navitem navitem--disabled"
              title="Analyze a report from Home first"
              aria-disabled
            >
              <IconRpb />
              RPB
            </span>
          )}
          <NavLink to="/settings" className="navitem">
            <IconSettings />
            Settings
          </NavLink>
        </nav>

        <div className="sidebar__footer">
          <ThemeToggle />
          <div>Rebuild of Shariva&apos;s CLA &amp; RPB tools</div>
        </div>
      </aside>

      <main className="main">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
