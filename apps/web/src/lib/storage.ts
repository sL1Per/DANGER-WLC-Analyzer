export interface Credentials { clientId: string; clientSecret: string; }
export interface StoredToken { accessToken: string; expiresAt: number; }

const CREDS_KEY = "wcl.credentials";
const TOKEN_KEY = "wcl.token";

export function saveCredentials(c: Credentials): void {
  localStorage.setItem(CREDS_KEY, JSON.stringify(c));
}
export function loadCredentials(): Credentials | null {
  const raw = localStorage.getItem(CREDS_KEY);
  return raw ? (JSON.parse(raw) as Credentials) : null;
}
export function saveToken(t: StoredToken): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}
export function loadToken(): StoredToken | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  const token = JSON.parse(raw) as StoredToken;
  if (token.expiresAt <= Date.now()) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}
