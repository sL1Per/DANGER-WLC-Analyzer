import { type ReportData, isStaleSchema } from "@wcl/core";
import { loadCredentials, loadToken, saveToken } from "./storage";
import { loadReport } from "./wcl/loadReport";
import { getCachedReport, setCachedReport, deleteCachedReport } from "./reportCache";

const WCL_TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";

export class ApiError extends Error {
  status: number;
  needsKey: boolean;
  constructor(status: number, message: string, needsKey = false) {
    super(message);
    this.status = status;
    this.needsKey = needsKey;
  }
}

export interface ReportResponse { data: ReportData; cachedAt: number; stale?: boolean; }

// Exchange the user's stored credentials for a WCL access token, directly with
// WCL (CORS-enabled) — the secret never touches any server we host. Returns null
// when no credentials are stored, so callers can surface a needsKey error.
async function ensureToken(): Promise<string | null> {
  const existing = loadToken();
  if (existing) return existing.accessToken;
  const creds = loadCredentials();
  if (!creds) return null;
  const res = await fetch(WCL_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${creds.clientId}:${creds.clientSecret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) {
    const msg = res.status === 401
      ? "WCL rejected the credentials. Check your client ID and secret."
      : `WCL token request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  saveToken({ accessToken: access_token, expiresAt: Date.now() + (expires_in - 300) * 1000 });
  return access_token;
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  // WclError carries a numeric status; map a couple to friendly copy.
  const status = typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : 500;
  const friendly: Record<number, string> = {
    401: "WCL rejected the credentials. Check your client ID and secret.",
    429: "WCL rate limit reached. Wait for your hourly points to reset (see your WCL profile).",
  };
  return new ApiError(status, friendly[status] ?? (e instanceof Error ? e.message : "Unexpected error"));
}

export async function fetchReport(reportId: string): Promise<ReportResponse> {
  const cached = await getCachedReport(reportId);
  if (cached) {
    return { data: cached.data, cachedAt: cached.cachedAt, stale: isStaleSchema(cached.data.schemaVersion) };
  }
  const token = await ensureToken();
  if (!token) {
    throw new ApiError(401, "Add your WCL credentials in Settings to load this report.", true);
  }
  try {
    const data = await loadReport(reportId, token);
    await setCachedReport(reportId, data);
    const stored = await getCachedReport(reportId);
    return { data, cachedAt: stored?.cachedAt ?? Date.now(), stale: false };
  } catch (e) {
    throw toApiError(e);
  }
}

export async function refreshReport(reportId: string): Promise<ReportResponse> {
  await deleteCachedReport(reportId);
  return fetchReport(reportId);
}
