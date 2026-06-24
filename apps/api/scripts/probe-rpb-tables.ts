/* Usage: WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… REPORT=<code> FIGHT=<id> \
     npx tsx apps/api/scripts/probe-rpb-tables.ts
   Dumps the raw `table` JSON for the four dataTypes so we can read the exact
   hit-type / cast-count field names before writing normalization (RPB role
   sheets). The recorded field names feed wcl.ts's RawHitTableEntry/fetchHitTable
   and fetchCastsTable — adjust those if the keys printed here differ. */
import { fetchToken } from "../src/wcl";

const API = "https://classic.warcraftlogs.com/api/v2/client";

async function table(code: string, token: string, dataType: string, fightId: number) {
  const query = `query($code:String!,$dt:TableDataType!,$f:[Int]){
    reportData{report(code:$code){ table(dataType:$dt, fightIDs:$f, hostilityType: Friendlies) }}}`;
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { code, dt: dataType, f: [fightId] } }),
  });
  const json = (await res.json()) as {
    data?: { reportData?: { report?: { table?: unknown } } };
  };
  return json.data?.reportData?.report?.table;
}

async function main() {
  const { WCL_CLIENT_ID, WCL_CLIENT_SECRET, REPORT, FIGHT } = process.env;
  if (!WCL_CLIENT_ID || !WCL_CLIENT_SECRET || !REPORT || !FIGHT) {
    throw new Error("set WCL_CLIENT_ID, WCL_CLIENT_SECRET, REPORT, FIGHT");
  }
  const { accessToken } = await fetchToken(WCL_CLIENT_ID, WCL_CLIENT_SECRET);
  for (const dt of ["DamageDone", "DamageTaken", "Casts", "Buffs"]) {
    const t = (await table(REPORT, accessToken, dt, Number(FIGHT))) as
      | { data?: { entries?: Record<string, unknown>[] } }
      | undefined;
    const first = t?.data?.entries?.[0];
    console.log(`\n===== ${dt} — first entry keys:`, first ? Object.keys(first) : "(none)");
    console.log(JSON.stringify(first, null, 2)?.slice(0, 2000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
