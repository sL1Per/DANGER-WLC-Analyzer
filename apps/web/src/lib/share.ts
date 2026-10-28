import type { ReportData } from "@wcl/core";
import { ApiError } from "./api";
import { gunzip, publishSnapshotTo, shareUrlFor } from "./shareCore";

// Empty in dev → relative "/api/..." hits the Vite proxy. In production the API
// is a separate Worker on its own origin, so set VITE_API_BASE at build time to
// that origin, e.g. https://danger-wlc-api.<sub>.workers.dev. Trailing slashes
// are stripped so `${API_BASE}/api/share` never becomes a route-breaking
// "//api/share" (which misses the /api/* CORS handler → browser CORS error).
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

export async function publishSnapshot(data: ReportData): Promise<string> {
  try {
    return await publishSnapshotTo(API_BASE, data);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === undefined) throw e;
    throw new ApiError(status, "Could not publish this report for sharing.");
  }
}

export async function fetchSnapshot(shareId: string): Promise<ReportData> {
  const res = await fetch(`${API_BASE}/api/share/${shareId}`);
  if (!res.ok) throw new ApiError(res.status, "This shared report could not be found.");
  return JSON.parse(await gunzip(await res.arrayBuffer())) as ReportData;
}

export function shareUrl(shareId: string): string {
  return shareUrlFor(typeof window !== "undefined" ? window.location.origin : "", shareId);
}
