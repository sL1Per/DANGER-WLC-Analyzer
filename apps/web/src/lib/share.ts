import type { ReportData } from "@wcl/core";
import { ApiError } from "./api";

// Empty in dev → relative "/api/..." hits the Vite proxy. In production the API
// is a separate Worker on its own origin, so set VITE_API_BASE at build time to
// that origin, e.g. https://danger-wlc-api.<sub>.workers.dev. Trailing slashes
// are stripped so `${API_BASE}/api/share` never becomes a route-breaking
// "//api/share" (which misses the /api/* CORS handler → browser CORS error).
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

export async function publishSnapshot(data: ReportData): Promise<string> {
  const res = await fetch(`${API_BASE}/api/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new ApiError(res.status, "Could not publish this report for sharing.");
  return (await res.json() as { shareId: string }).shareId;
}

export async function fetchSnapshot(shareId: string): Promise<ReportData> {
  const res = await fetch(`${API_BASE}/api/share/${shareId}`);
  if (!res.ok) throw new ApiError(res.status, "This shared report could not be found.");
  return await res.json() as ReportData;
}

export function shareUrl(shareId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/s/${shareId}`;
}
