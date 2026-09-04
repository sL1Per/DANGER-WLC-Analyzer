export interface Credentials { clientId: string; clientSecret: string; }
export interface StoredToken { accessToken: string; expiresAt: number; }

const CREDS_KEY = "wcl.credentials";
const TOKEN_KEY = "wcl.token";
const LAST_REPORT_KEY = "wcl.lastReportId";
const WEBHOOK_KEY = "wcl.discordWebhook";
const THEME_KEY = "wcl.theme";
const DENSITY_KEY = "wcl.density";

export type Theme = "light" | "dark";
export type Density = "comfortable" | "compact";

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

export function saveDensity(d: Density): void {
  localStorage.setItem(DENSITY_KEY, d);
}
export function loadDensity(): Density | null {
  const v = localStorage.getItem(DENSITY_KEY);
  return v === "comfortable" || v === "compact" ? v : null;
}

export function saveLastReportId(id: string): void {
  localStorage.setItem(LAST_REPORT_KEY, id);
}
export function loadLastReportId(): string | null {
  return localStorage.getItem(LAST_REPORT_KEY);
}

// Recently-viewed reports for this browser. The API cache is in-memory and
// keyed by id with no per-client listing, so the "cached raids" the user can
// switch between are the ones they've opened here, most-recent first.
const RECENT_REPORTS_KEY = "wcl.recentReports";
const RECENT_REPORTS_MAX = 12;

export interface RecentReport {
  id: string;
  title: string;
  zoneName: string;
  players: number;
  startTime: number;
  viewedAt: number;
}

export function loadRecentReports(): RecentReport[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_REPORTS_KEY) ?? "[]");
    return Array.isArray(list) ? (list as RecentReport[]) : [];
  } catch {
    localStorage.removeItem(RECENT_REPORTS_KEY);
    return [];
  }
}

export function addRecentReport(r: Omit<RecentReport, "viewedAt">): void {
  const others = loadRecentReports().filter((e) => e.id !== r.id);
  const next = [{ ...r, viewedAt: Date.now() }, ...others].slice(0, RECENT_REPORTS_MAX);
  localStorage.setItem(RECENT_REPORTS_KEY, JSON.stringify(next));
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
// The access token lives in sessionStorage, not localStorage: it's short-lived
// and silently re-fetched from the stored credentials, so there's no reason to
// persist it to disk across sessions. (The secret stays in localStorage so the
// per-browser key survives — an accepted tradeoff.)
export function saveToken(t: StoredToken): void {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}
export function loadToken(): StoredToken | null {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  let token: StoredToken;
  try {
    token = JSON.parse(raw) as StoredToken;
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
  if (token.expiresAt <= Date.now()) {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}
