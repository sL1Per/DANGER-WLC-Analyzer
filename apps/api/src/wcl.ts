const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
const API_URL = "https://classic.warcraftlogs.com/api/v2/client";

export class WclError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface Token { accessToken: string; expiresIn: number; }

export async function fetchToken(clientId: string, clientSecret: string): Promise<Token> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new WclError(res.status, `WCL token request failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

/** M1 query: report metadata, fights, players. Extended with tables/events in M2+. */
const REPORT_QUERY = `
query Report($code: String!) {
  reportData {
    report(code: $code) {
      title
      startTime
      endTime
      zone { name }
      fights { id name encounterID kill startTime endTime }
      masterData { actors(type: "Player") { id name subType } }
    }
  }
}`;

export interface RawReport {
  title: string;
  startTime: number;
  endTime: number;
  zone: { name: string } | null;
  fights: { id: number; name: string; encounterID: number; kill: boolean | null;
            startTime: number; endTime: number }[];
  masterData: { actors: { id: number; name: string; subType: string }[] };
}

export async function fetchRawReport(code: string, accessToken: string): Promise<RawReport> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: REPORT_QUERY, variables: { code } }),
  });
  if (!res.ok) throw new WclError(res.status, `WCL API request failed (${res.status})`);
  const json = (await res.json()) as { data?: { reportData?: { report: RawReport | null } }; errors?: { message: string }[] };
  if (json.errors?.length) throw new WclError(502, json.errors.map((e) => e.message).join("; "));
  const report = json.data?.reportData?.report;
  if (!report) throw new WclError(404, "Report not found or not accessible with these credentials");
  return report;
}
