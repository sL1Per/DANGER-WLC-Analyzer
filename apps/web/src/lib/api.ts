import type { ReportData } from "@wcl/core";
import { loadCredentials, loadToken, saveToken } from "./storage";

export class ApiError extends Error {
  constructor(public status: number, message: string, public needsKey = false) { super(message); }
}

async function ensureToken(): Promise<string | null> {
  const existing = loadToken();
  if (existing) return existing.accessToken;
  const creds = loadCredentials();
  if (!creds) return null;
  const res = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Token request failed");
  const { accessToken, expiresIn } = body;
  // refresh 5 minutes before actual expiry
  saveToken({ accessToken, expiresAt: Date.now() + (expiresIn - 300) * 1000 });
  return accessToken;
}

export interface ReportResponse { data: ReportData; cachedAt: number; }

export async function fetchReport(reportId: string): Promise<ReportResponse> {
  const token = await ensureToken();
  const res = await fetch(`/api/report/${reportId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Request failed", body.needsKey ?? false);
  return body as ReportResponse;
}

export async function refreshReport(reportId: string): Promise<ReportResponse> {
  await fetch(`/api/report/${reportId}`, { method: "DELETE" });
  return fetchReport(reportId);
}
