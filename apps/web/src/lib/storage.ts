import type { Role } from "@wcl/core";

export interface Credentials { clientId: string; clientSecret: string; }
export interface StoredToken { accessToken: string; expiresAt: number; }

const CREDS_KEY = "wcl.credentials";
const TOKEN_KEY = "wcl.token";
const LAST_REPORT_KEY = "wcl.lastReportId";

export function saveLastReportId(id: string): void {
  localStorage.setItem(LAST_REPORT_KEY, id);
}
export function loadLastReportId(): string | null {
  return localStorage.getItem(LAST_REPORT_KEY);
}

export function saveCredentials(c: Credentials): void {
  localStorage.setItem(CREDS_KEY, JSON.stringify(c));
}
export function loadCredentials(): Credentials | null {
  const raw = localStorage.getItem(CREDS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Credentials;
  } catch {
    localStorage.removeItem(CREDS_KEY);
    return null;
  }
}
export function saveToken(t: StoredToken): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}
export function loadToken(): StoredToken | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  let token: StoredToken;
  try {
    token = JSON.parse(raw) as StoredToken;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  if (token.expiresAt <= Date.now()) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

const ROLE_KEY = "wcl.roles";

export function loadRoleOverrides(): Record<string, Role> {
  try { return JSON.parse(localStorage.getItem(ROLE_KEY) ?? "{}"); } catch { return {}; }
}

export function saveRoleOverride(characterName: string, role: Role): void {
  const all = loadRoleOverrides();
  all[characterName] = role;
  localStorage.setItem(ROLE_KEY, JSON.stringify(all));
}
