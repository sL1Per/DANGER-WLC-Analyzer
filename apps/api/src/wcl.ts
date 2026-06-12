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
  masterData: { actors: { id: number; name: string; subType: string }[] } | null;
}

async function gql<T>(query: string, variables: Record<string, unknown>, accessToken: string): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new WclError(res.status, `WCL API request failed (${res.status})`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new WclError(502, json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new WclError(502, "Empty WCL response");
  return json.data;
}

export async function fetchRawReport(code: string, accessToken: string): Promise<RawReport> {
  const data = await gql<{ reportData?: { report: RawReport | null } }>(
    REPORT_QUERY, { code }, accessToken);
  const report = data.reportData?.report;
  if (!report) throw new WclError(404, "Report not found or not accessible with these credentials");
  return report;
}

const COMBATANT_QUERY = `
query CombatantInfo($code: String!, $fightIds: [Int], $start: Float) {
  reportData {
    report(code: $code) {
      events(dataType: CombatantInfo, fightIDs: $fightIds, startTime: $start, endTime: 100000000000) {
        data
        nextPageTimestamp
      }
    }
  }
}`;

export interface RawGearEntry {
  id: number; slot: number; itemLevel?: number;
  permanentEnchant?: number; temporaryEnchant?: number;
  gems?: { id: number }[];
}
export interface RawCombatantInfo { sourceID: number; fight: number; gear: RawGearEntry[]; }

export async function fetchCombatantInfo(
  code: string, accessToken: string, fightIds: number[],
): Promise<RawCombatantInfo[]> {
  const events: RawCombatantInfo[] = [];
  let start = 0;
  for (;;) {
    const data = await gql<{ reportData: { report: { events: { data: Record<string, unknown>[]; nextPageTimestamp: number | null } } } }>(
      COMBATANT_QUERY, { code, fightIds, start }, accessToken);
    const page = data.reportData.report.events;
    for (const e of page.data) {
      if (e.type === "combatantinfo") events.push(e as unknown as RawCombatantInfo);
    }
    if (page.nextPageTimestamp == null || page.nextPageTimestamp <= start) break;
    start = page.nextPageTimestamp;
  }
  return events;
}

export async function fetchItemMeta(
  ids: number[], accessToken: string,
): Promise<Record<string, { name: string; quality?: number }>> {
  const meta: Record<string, { name: string; quality?: number }> = {};
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  for (const chunk of chunks) {
    const fields = (withQuality: boolean) =>
      chunk.map((id, i) => `i${i}: item(id: ${id}) { id name${withQuality ? " quality" : ""} }`).join("\n");
    let data: Record<string, { id: number; name: string; quality?: number } | null>;
    try {
      data = (await gql<{ gameData: typeof data }>(`{ gameData { ${fields(true)} } }`, {}, accessToken)).gameData;
    } catch (e) {
      // schema may not expose quality; retry name-only (documented fallback)
      if (e instanceof WclError && e.status === 502 && /quality/i.test(e.message)) {
        data = (await gql<{ gameData: typeof data }>(`{ gameData { ${fields(false)} } }`, {}, accessToken)).gameData;
      } else throw e;
    }
    for (const entry of Object.values(data)) {
      if (entry) meta[String(entry.id)] = { name: entry.name, quality: entry.quality };
    }
  }
  return meta;
}
