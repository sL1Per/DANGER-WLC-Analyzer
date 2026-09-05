import type { ReactNode } from "react";

/** App-wide layout wrapper. The old CLA/RPB sidebar is gone — report navigation
 *  now lives in the in-report header (ReportHeader) and the Home/Settings screens
 *  provide their own full-viewport layouts. Light/dark mode lives in Settings. */
export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app">{children}</div>;
}
