import type { Role } from "@wcl/core";

export interface Credentials { clientId: string; clientSecret: string; }
export interface StoredToken { accessToken: string; expiresAt: number; }

const CREDS_KEY = "wcl.credentials";
const TOKEN_KEY = "wcl.token";
const LAST_REPORT_KEY = "wcl.lastReportId";
const WEBHOOK_KEY = "wcl.discordWebhook";
const THEME_KEY = "wcl.theme";
const RPB_VIEW_KEY = "wcl.rpbViewMode";

export type Theme = "light" | "dark";

// Discord webhook URL — stored only in this browser, like credentials. The
// browser posts share links straight to Discord (it allows cross-origin
// webhook posts), so the URL never reaches our API.
export function saveWebhookUrl(url: string): void {
  const trimmed = url.trim();
  if (trimmed) localStorage.setItem(WEBHOOK_KEY, trimmed);
  else clearWebhookUrl();
}
export function loadWebhookUrl(): string | null {
  return localStorage.getItem(WEBHOOK_KEY);
}
export function clearWebhookUrl(): void {
  localStorage.removeItem(WEBHOOK_KEY);
}

export function saveTheme(t: Theme): void {
  localStorage.setItem(THEME_KEY, t);
}
export function loadTheme(): Theme | null {
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export type RpbViewMode = "rows" | "cards";

export function saveRpbViewMode(m: RpbViewMode): void {
  localStorage.setItem(RPB_VIEW_KEY, m);
}
export function loadRpbViewMode(): RpbViewMode {
  return localStorage.getItem(RPB_VIEW_KEY) === "cards" ? "cards" : "rows";
}

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
