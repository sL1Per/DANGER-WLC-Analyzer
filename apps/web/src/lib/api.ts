import type { ReportData } from "@wcl/core";
import { loadCredentials, loadToken, saveToken } from "./storage";

export class ApiError extends Error {
  status: number;
  needsKey: boolean;
  constructor(status: number, message: string, needsKey = false) {
    super(message);
    this.status = status;
    this.needsKey = needsKey;
  }
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
  const token = await ensureToken();
  const res = await fetch(`/api/report/${reportId}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = "Cache eviction failed";
    try { message = (await res.json()).error ?? message; } catch { /* non-JSON body */ }
    throw new ApiError(res.status, message);
  }
  return fetchReport(reportId);
}
