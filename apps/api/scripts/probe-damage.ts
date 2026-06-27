/**
 * One-shot DAMAGE-event schema probe for M5b (combat-table stats + role school).
 * Usage:
 *   WCL_CLIENT_ID=xxx WCL_CLIENT_SECRET=yyy pnpm --filter @wcl/api exec tsx scripts/probe-damage.ts <reportCode>
 * Dumps, for the first boss fight: the key set of a raw DamageDone and DamageTaken
 * event, a few samples, and the distinct `hitType` values seen — so the M5b
 * enrichment (school + hitType) can be designed against the real shapes.
 */
import { fetchRawReport, fetchToken } from "../../web/src/lib/wcl/wcl";

const API_URL = "https://classic.warcraftlogs.com/api/v2/client";
const code = process.argv[2];
const { WCL_CLIENT_ID, WCL_CLIENT_SECRET } = process.env;
if (!code || !WCL_CLIENT_ID || !WCL_CLIENT_SECRET) {
  console.error("usage: WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api exec tsx scripts/probe-damage.ts <reportCode>");
  process.exit(1);
}

const token = (await fetchToken(WCL_CLIENT_ID, WCL_CLIENT_SECRET)).accessToken;
const report = await fetchRawReport(code, token);
const bossId = report.fights.find((f) => f.encounterID !== 0)?.id ?? report.fights[0]?.id;
console.log("zone:", report.zone?.name, "| probing fight:", bossId);

async function firstPage(dataType: string) {
  const query = `query E($code:String!,$dt:EventDataType!,$f:[Int]){reportData{report(code:$code){events(dataType:$dt,fightIDs:$f,startTime:0,endTime:100000000000,limit:300){data}}}}`;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { code, dt: dataType, f: [bossId] } }),
  });
  const json = (await res.json()) as { data?: { reportData: { report: { events: { data: Record<string, unknown>[] } } } }; errors?: unknown };
  if (json.errors) { console.dir(json.errors, { depth: 5 }); return []; }
  return json.data?.reportData.report.events.data ?? [];
}

for (const dt of ["DamageDone", "DamageTaken"] as const) {
  const events = await firstPage(dt);
  console.log(`\n===== ${dt}: ${events.length} events on fight ${bossId} =====`);
  if (events.length === 0) continue;
  const keys = new Set<string>();
  for (const e of events) for (const k of Object.keys(e)) keys.add(k);
  console.log("union of keys:", [...keys].sort().join(", "));
  const byType = new Map<string, number>();
  const byHit = new Map<string, number>();
  for (const e of events) {
    byType.set(String(e.type), (byType.get(String(e.type)) ?? 0) + 1);
    if ("hitType" in e) byHit.set(String(e.hitType), (byHit.get(String(e.hitType)) ?? 0) + 1);
  }
  console.log("event `type` counts:", Object.fromEntries(byType));
  console.log("`hitType` value counts:", Object.fromEntries(byHit));
}

// --- WCL summary table: does it give ready-made crit/miss/dodge/parry/block counts? ---
async function table(dataType: string) {
  const query = `query T($code:String!,$dt:TableDataType!,$f:[Int]){reportData{report(code:$code){table(dataType:$dt,fightIDs:$f,hostilityType:Friendlies)}}}`;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { code, dt: dataType, f: [bossId] } }),
  });
  const json = (await res.json()) as { data?: { reportData: { report: { table: unknown } } }; errors?: unknown };
  if (json.errors) { console.dir(json.errors, { depth: 5 }); return null; }
  return json.data?.reportData.report.table ?? null;
}

for (const dt of ["DamageDone", "DamageTaken"] as const) {
  const t = (await table(dt)) as { data?: { entries?: Record<string, unknown>[] } } | null;
  console.log(`\n===== ${dt} TABLE =====`);
  const entries = t?.data?.entries ?? [];
  console.log("entry count:", entries.length);
  if (entries.length === 0) { console.dir(t, { depth: 2 }); continue; }
  console.log("first entry keys:", Object.keys(entries[0]!).sort().join(", "));
  console.log("first entry (depth 4):");
  console.dir(entries[0], { depth: 4 });
}
