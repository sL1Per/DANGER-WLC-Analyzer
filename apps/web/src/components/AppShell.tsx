import type { ReactNode } from "react";
import { AppFooter } from "./AppFooter";

/** App-wide layout wrapper. The old CLA/RPB sidebar is gone — report navigation
 *  now lives in the in-report header (ReportHeader) and the Home/Settings screens
 *  provide their own full-viewport layouts. Light/dark mode lives in Settings.
 *  The footer sits below every page; `.app__main` grows so it stays at the bottom. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="app__main">{children}</div>
      <AppFooter />
    </div>
  );
}
