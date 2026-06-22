import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

/** App-wide layout wrapper. The old CLA/RPB sidebar is gone — report navigation
 *  now lives in the in-report header (ReportHeader) and the Home/Settings screens
 *  provide their own full-viewport layouts. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="app-theme"><ThemeToggle /></div>
      {children}
    </div>
  );
}
