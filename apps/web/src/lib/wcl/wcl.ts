const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
const API_URL = "https://classic.warcraftlogs.com/api/v2/client";

export class WclError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export interface Token { accessToken: string; expiresIn: number; }

export async function fetchToken(clientId: string, clientSecret: string): Promise<Token> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
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
      fights { id name encounterID kill startTime endTime friendlyPlayers }
      masterData {
        actors(type: "Player") { id name subType }
        npcs: actors(type: "NPC") { id gameID name }
        pets: actors(type: "Pet") { id petOwner }
        abilities { gameID name }
      }
    }
  }
}`;

export interface RawReport {
  title: string;
  startTime: number;
  endTime: number;
  zone: { name: string } | null;
  fights: { id: number; name: string; encounterID: number; kill: boolean | null;
            startTime: number; endTime: number; friendlyPlayers?: number[] | null }[];
  masterData: {
    actors: { id: number; name: string; subType: string }[];
    /** optional: absent on reports with no NPC actors / older fixtures (normalize falls back to []) */
    npcs?: { id: number; gameID: number; name?: string }[];
    /** pet actor id → owner player id, to attribute pet damage/healing to the owner */
    pets?: { id: number; petOwner: number }[];
    /** ability id → name, for damage-taken/death labels */
    abilities?: { gameID: number; name: string }[];
  } | null;
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
  // Classic logs omit `slot`: the entry's position in the gear array is the slot id.
  id: number; slot?: number; itemLevel?: number;
  permanentEnchant?: number; temporaryEnchant?: number;
  gems?: { id: number }[];
}
export interface RawAura { source: number; ability: number; name?: string; }
export interface RawCombatantInfo { sourceID: number; fight: number; gear: RawGearEntry[]; auras?: RawAura[]; }

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

const EVENTS_QUERY = `
query Events($code: String!, $dataType: EventDataType!, $filter: String, $start: Float, $fightIds: [Int], $hostilityType: HostilityType) {
  reportData {
    report(code: $code) {
      events(dataType: $dataType, filterExpression: $filter, fightIDs: $fightIds, startTime: $start, endTime: 100000000000, hostilityType: $hostilityType) {
        data
        nextPageTimestamp
      }
    }
  }
}`;

export interface RawBuffEvent {
  timestamp: number; type: string; sourceID: number; targetID: number;
  abilityGameID: number; fight: number;
}
export interface RawCastEvent {
  timestamp: number; type: string; sourceID: number; abilityGameID: number; fight: number;
}

async function fetchEvents(
  code: string, accessToken: string, dataType: string,
  abilityIds: number[], keepTypes: Set<string>,
): Promise<Record<string, unknown>[]> {
  const filter = `ability.id IN (${abilityIds.join(", ")})`;
  const out: Record<string, unknown>[] = [];
  let start = 0;
  for (;;) {
    const data = await gql<{ reportData: { report: { events: { data: Record<string, unknown>[]; nextPageTimestamp: number | null } } } }>(
      EVENTS_QUERY, { code, dataType, filter, start, fightIds: null }, accessToken);
    const page = data.reportData.report.events;
    for (const e of page.data) if (keepTypes.has(e.type as string)) out.push(e);
    if (page.nextPageTimestamp == null || page.nextPageTimestamp <= start) break;
    start = page.nextPageTimestamp;
  }
  return out;
}

export async function fetchBuffEvents(
  code: string, accessToken: string, abilityIds: number[],
): Promise<RawBuffEvent[]> {
  if (abilityIds.length === 0) return [];
  return await fetchEvents(code, accessToken, "Buffs", abilityIds,
    new Set(["applybuff", "removebuff", "refreshbuff"])) as unknown as RawBuffEvent[];
}

export async function fetchCastEvents(
  code: string, accessToken: string, abilityIds: number[],
): Promise<RawCastEvent[]> {
  if (abilityIds.length === 0) return [];
  return await fetchEvents(code, accessToken, "Casts", abilityIds,
    new Set(["cast"])) as unknown as RawCastEvent[];
}

export interface RawDeathEvent {
  timestamp: number; type: string; targetID: number; fight: number;
  /** the killing-blow ability (present on most WCL death events) */
  killingAbilityGameID?: number;
}

/** All enemy/player death events (whole report). targetID maps to a masterData actor. */
export async function fetchDeaths(code: string, accessToken: string): Promise<RawDeathEvent[]> {
  const out: RawDeathEvent[] = [];
  let start = 0;
  for (;;) {
    const data = await gql<{ reportData: { report: { events: { data: Record<string, unknown>[]; nextPageTimestamp: number | null } } } }>(
      EVENTS_QUERY, { code, dataType: "Deaths", filter: null, start, fightIds: null }, accessToken);
    const page = data.reportData.report.events;
    for (const e of page.data) if (e.type === "death") out.push(e as unknown as RawDeathEvent);
    if (page.nextPageTimestamp == null || page.nextPageTimestamp <= start) break;
    start = page.nextPageTimestamp;
  }
  return out;
}

export interface RawInterruptEvent {
  timestamp: number; type: string; sourceID: number; targetID: number;
  abilityGameID: number; extraAbilityGameID?: number; fight: number;
}
export interface RawDamageEvent {
  timestamp: number; type: string; sourceID: number; targetID: number;
  abilityGameID: number; amount: number; absorbed?: number; fight: number;
  sourceIsFriendly?: boolean; targetIsFriendly?: boolean;
  /** WCL hit-type code: 0 miss, 1 hit, 2 crit, 4/5 blocked, 7 dodge, 8 parry, 10 immune */
  hitType?: number;
  /** damage before mitigation (armor/resist/absorb) — the "raw" hit */
  unmitigatedAmount?: number;
}

/** All player casts (no ability filter) — paged. Used for activity cast-time sums. */
export async function fetchAllCasts(code: string, accessToken: string, fightIds?: number[]): Promise<RawCastEvent[]> {
  return await fetchAllEvents(code, accessToken, "Casts", new Set(["cast"]), fightIds) as unknown as RawCastEvent[];
}

/** Interrupt events (whole report). */
export async function fetchInterrupts(code: string, accessToken: string, fightIds?: number[]): Promise<RawInterruptEvent[]> {
  return await fetchAllEvents(code, accessToken, "Interrupts", new Set(["interrupt"]), fightIds) as unknown as RawInterruptEvent[];
}

/** Damage-taken events on players (DamageTaken dataType). */
export async function fetchDamageTaken(code: string, accessToken: string, fightIds?: number[]): Promise<RawDamageEvent[]> {
  return await fetchAllEvents(code, accessToken, "DamageTaken", new Set(["damage"]), fightIds) as unknown as RawDamageEvent[];
}

/** Damage-done events by players (DamageDone dataType). */
export async function fetchDamageDone(code: string, accessToken: string, fightIds?: number[]): Promise<RawDamageEvent[]> {
  return await fetchAllEvents(code, accessToken, "DamageDone", new Set(["damage"]), fightIds) as unknown as RawDamageEvent[];
}

/** Effective healing events by players. The WCL EventDataType enum has no
 *  "HealingDone" (unlike DamageDone) — the healing event type is just "Healing".
 *  Keeps `heal` (direct/HoT healing) and `absorbed` (shield absorbs, which WCL
 *  counts as healing, credited to the shield's caster via sourceID). Reuses the
 *  RawDamageEvent shape (sourceID/amount/fight). */
export async function fetchHealingDone(code: string, accessToken: string, fightIds?: number[]): Promise<RawDamageEvent[]> {
  return await fetchAllEvents(code, accessToken, "Healing", new Set(["heal", "absorbed"]), fightIds) as unknown as RawDamageEvent[];
}

export interface RawDebuffEvent {
  timestamp: number; type: string; sourceID: number; targetID: number;
  abilityGameID: number; fight: number;
}

/** Debuff apply/remove/refresh events on enemies, sourced by players. Scoped to
 *  the given fights. Used to compute per-player debuff uptime on the boss. */
export async function fetchEnemyDebuffs(
  code: string, accessToken: string, fightIds: number[],
): Promise<RawDebuffEvent[]> {
  // hostilityType: Enemies → debuffs ON enemy units (sourced by players). Without it
  // WCL defaults to Friendlies and returns debuffs on players (~all 797 in the Gruul
  // E2E), collapsing enemy-debuff uptime to ~0.
  return await fetchAllEvents(code, accessToken, "Debuffs",
    new Set(["applydebuff", "removedebuff", "refreshdebuff"]), fightIds, "Enemies") as unknown as RawDebuffEvent[];
}

/** Absorb amounts on players. WCL surfaces shield absorbs as DamageTaken events
 *  with a non-zero `absorbed` field; we keep those. (Validate via the probe — if
 *  WCL emits a distinct `absorbed` event type for your reports, add it here.) */
export async function fetchAbsorbs(
  code: string, accessToken: string, fightIds: number[],
): Promise<RawDamageEvent[]> {
  const events = await fetchAllEvents(code, accessToken, "DamageTaken",
    new Set(["damage", "absorbed"]), fightIds) as unknown as RawDamageEvent[];
  return events.filter((e) => (e.absorbed ?? 0) > 0);
}

/** Like fetchEvents but with no ability filter (filter: null). `hostilityType`
 *  defaults to WCL's Friendlies; pass "Enemies" for debuffs players apply to bosses. */
async function fetchAllEvents(
  code: string, accessToken: string, dataType: string, keepTypes: Set<string>,
  fightIds?: number[], hostilityType?: "Friendlies" | "Enemies",
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let start = 0;
  for (;;) {
    const data = await gql<{ reportData: { report: { events: { data: Record<string, unknown>[]; nextPageTimestamp: number | null } } } }>(
      EVENTS_QUERY, { code, dataType, filter: null, start, fightIds: fightIds ?? null, hostilityType: hostilityType ?? null }, accessToken);
    const page = data.reportData.report.events;
    for (const e of page.data) if (keepTypes.has(e.type as string)) out.push(e);
    if (page.nextPageTimestamp == null || page.nextPageTimestamp <= start) break;
    start = page.nextPageTimestamp;
  }
  return out;
}

export interface RawTableEntry {
  id: number;        // actor id
  total: number;     // effective total
  type?: string;     // damage school for DamageDone ("Physical", "Fire", ...)
}

/** Fetch a WCL summary table (DamageDone / Healing / DamageTaken) for boss fights.
 *  Returns per-actor totals. One query per call — far cheaper than raw events. */
export async function fetchTable(
  code: string, accessToken: string, dataType: "DamageDone" | "Healing" | "DamageTaken",
  fightIds: number[],
): Promise<RawTableEntry[]> {
  const query = `
  query Table($code: String!, $dataType: TableDataType!, $fightIds: [Int]) {
    reportData { report(code: $code) {
      table(dataType: $dataType, fightIDs: $fightIds, hostilityType: Friendlies)
    } }
  }`;
  const data = await gql<{ reportData: { report: { table: { data?: { entries?: RawTableEntry[] } } } } }>(
    query, { code, dataType, fightIds }, accessToken);
  return data.reportData.report.table?.data?.entries ?? [];
}

export interface RawHitTableEntry {
  id: number; total: number;
  hitCount?: number; critHitCount?: number; missCount?: number;
  dodgeCount?: number; parryCount?: number; resistCount?: number;
  blockCount?: number; crushingCount?: number; immuneCount?: number;
}

/** Per-actor hit-type breakdown from a Damage or Healing table (boss fights). */
export async function fetchHitTable(
  code: string, accessToken: string,
  dataType: "DamageDone" | "DamageTaken" | "Healing",
  fightIds: number[],
): Promise<RawHitTableEntry[]> {
  const query = `
  query HitTable($code: String!, $dataType: TableDataType!, $fightIds: [Int]) {
    reportData { report(code: $code) {
      table(dataType: $dataType, fightIDs: $fightIds, hostilityType: Friendlies)
    } }
  }`;
  const data = await gql<{ reportData: { report: { table: { data?: { entries?: RawHitTableEntry[] } } } } }>(
    query, { code, dataType, fightIds }, accessToken);
  return data.reportData.report.table?.data?.entries ?? [];
}

export interface RawCastTableEntry { id: number; guid: number; name: string; total: number; }

type CastsAbilityRow = { guid: number; name: string; total: number };
type CastsActorEntry = {
  id: number;
  /** flat shape: ability fields are on the actor entry itself */
  guid?: number; name?: string; total?: number;
  /** nested shapes: abilities under sub-array */
  abilities?: CastsAbilityRow[];
  entries?: CastsAbilityRow[];
};

/** Per-actor, per-ability cast counts from the Casts table (boss fights).
 *  `guid` is the ability gameID; used to match trinket/racial on-use ids.
 *  Handles both the flat shape (guid/name/total on the actor entry) and
 *  the nested shape (abilities[] or entries[] sub-array per actor). */
export async function fetchCastsTable(
  code: string, accessToken: string, fightIds: number[],
): Promise<RawCastTableEntry[]> {
  const query = `
  query CastsTable($code: String!, $fightIds: [Int]) {
    reportData { report(code: $code) {
      table(dataType: Casts, fightIDs: $fightIds, hostilityType: Friendlies)
    } }
  }`;
  const data = await gql<{ reportData: { report: { table: { data?: { entries?: CastsActorEntry[] } } } } }>(
    query, { code, fightIds }, accessToken);
  const out: RawCastTableEntry[] = [];
  for (const e of data.reportData.report.table?.data?.entries ?? []) {
    const sub = e.abilities ?? e.entries;
    if (sub) {
      // Nested shape: flatten per-ability rows, carrying actor id.
      for (const a of sub) out.push({ id: e.id, guid: a.guid, name: a.name, total: a.total });
    } else if (e.guid != null && e.name != null && e.total != null) {
      // Flat shape: entry already has ability fields.
      out.push({ id: e.id, guid: e.guid, name: e.name, total: e.total });
    }
  }
  return out;
}

// timeframe: Historical compares against rankings as they stood when the fight
// happened. WCL's server default (omitting the arg) is Today's live bracket —
// a report ages out of that as tiers reset / patches land, silently returning
// `{"data":[]}` even when warcraftlogs.com's own report view (which always
// uses Historical) shows real percentiles for the same kills.
const RANKINGS_QUERY = `
query Rankings($code: String!) {
  reportData {
    report(code: $code) {
      rankings(timeframe: Historical)
    }
  }
}`;

export interface RawRankingCharacter {
  name: string;
  /** WCL may key the class as `class` or `type` depending on the field set */
  class?: string;
  type?: string;
  spec?: string;
  rankPercent?: number;
  bracketPercent?: number;
  /** parse metric value (DPS for dps/tank rankings, HPS for healer rankings) */
  amount?: number;
}

export interface RawRankingEntry {
  encounter?: { id?: number; name?: string };
  fightID?: number;
  roles?: {
    tanks?: { characters?: RawRankingCharacter[] };
    healers?: { characters?: RawRankingCharacter[] };
    dps?: { characters?: RawRankingCharacter[] };
  };
}

/** Fetch WCL parse rankings (one JSON field, grouped per boss by role).
 *  Returns [] when the report has no rankings. */
export async function fetchRankings(code: string, accessToken: string): Promise<RawRankingEntry[]> {
  const data = await gql<{ reportData?: { report?: { rankings?: { data?: RawRankingEntry[] } | null } } }>(
    RANKINGS_QUERY, { code }, accessToken);
  return data.reportData?.report?.rankings?.data ?? [];
}

// WCL's GameItem type exposes only id/name/icon — there is no `quality` field, so we
// resolve names here and look gem quality up from a static table (@wcl/data) instead.
export async function fetchItemMeta(
  ids: number[], accessToken: string,
): Promise<Record<string, { name: string }>> {
  const meta: Record<string, { name: string }> = {};
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  for (const chunk of chunks) {
    const fields = chunk.map((id, i) => `i${i}: item(id: ${id}) { id name }`).join("\n");
    const data = (await gql<{ gameData: Record<string, { id: number; name: string } | null> }>(
      `{ gameData { ${fields} } }`, {}, accessToken)).gameData;
    for (const entry of Object.values(data)) {
      if (entry) meta[String(entry.id)] = { name: entry.name };
    }
  }
  return meta;
}
