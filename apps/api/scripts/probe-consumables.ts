/**
 * Diagnostic for the "buff consumables" JC-neck and suboptimal columns.
 * Usage:
 *   WCL_CLIENT_ID=xxx WCL_CLIENT_SECRET=yyy pnpm --filter @wcl/api exec tsx scripts/probe-consumables.ts <reportCode>
 *
 * Prints, per player: class, equipped neck, weapon temp-enchant, and the
 * consumable pull-auras (so we can see what each flagged player actually used),
 * then scans which WCL event type (Buffs / Casts / Healing) carries the JC-neck
 * on-use absorb — so we stop guessing the right signal.
 */
import { fetchToken, fetchRawReport, fetchCombatantInfo, fetchItemMeta } from "../../web/src/lib/wcl/wcl";

const API_URL = "https://classic.warcraftlogs.com/api/v2/client";
const code = process.argv[2];
const { WCL_CLIENT_ID, WCL_CLIENT_SECRET } = process.env;
if (!code || !WCL_CLIENT_ID || !WCL_CLIENT_SECRET) {
  console.error("usage: WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api exec tsx scripts/probe-consumables.ts <reportCode>");
  process.exit(1);
}

// on-use BUFF ids of the three JC necks (Braided Eternium Chain / Eye of the
// Night / Chain of the Twilight Owl) — what we now key JC-neck "used" on.
const NECK_ABSORB_IDS = [31025, 31033, 31035];
const JC_NECK_ITEM_IDS = [24114, 24116, 24121];

async function gql<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data!;
}

const EVENTS = `
query E($code:String!,$dt:EventDataType!,$filter:String,$start:Float){
  reportData{report(code:$code){events(dataType:$dt,filterExpression:$filter,startTime:$start,endTime:100000000000){data nextPageTimestamp}}}}`;

async function scan(dataType: string, token: string): Promise<Record<string, number>> {
  const filter = `ability.id IN (${NECK_ABSORB_IDS.join(", ")})`;
  const byType: Record<string, number> = {};
  let start = 0, pages = 0;
  for (; pages < 20; pages++) {
    const d = await gql<{ reportData: { report: { events: { data: { type: string; abilityGameID?: number }[]; nextPageTimestamp: number | null } } } }>(
      EVENTS, { code, dt: dataType, filter, start }, token);
    const page = d.reportData.report.events;
    for (const e of page.data) byType[`${e.type}/${e.abilityGameID}`] = (byType[`${e.type}/${e.abilityGameID}`] ?? 0) + 1;
    if (page.nextPageTimestamp == null || page.nextPageTimestamp <= start) break;
    start = page.nextPageTimestamp;
  }
  return byType;
}

const token = (await fetchToken(WCL_CLIENT_ID, WCL_CLIENT_SECRET)).accessToken;
const report = await fetchRawReport(code, token);
const classOf = new Map((report.masterData?.actors ?? []).map((a) => [a.id, { name: a.name, cls: a.subType }]));
const bossIds = report.fights.filter((f) => f.encounterID !== 0).map((f) => f.id);
console.log("zone:", report.zone?.name, "| boss fights:", bossIds.length);

// one combatantInfo per player (last boss fight that has it)
const combatants = await fetchCombatantInfo(code, token, bossIds);
const latest = new Map<number, typeof combatants[number]>();
for (const c of combatants) latest.set(c.sourceID, c); // later fights overwrite → last snapshot
const itemIds = new Set<number>();
for (const c of latest.values()) for (const g of c.gear ?? []) if (g.id) itemIds.add(g.id);
const meta = await fetchItemMeta([...itemIds], token).catch(() => ({} as Record<string, { name?: string }>));

console.log("\n=== players: class | neck | weapon tempEnchant | consumable auras ===");
for (const c of [...latest.values()].sort((a, b) => (classOf.get(a.sourceID)?.cls ?? "").localeCompare(classOf.get(b.sourceID)?.cls ?? ""))) {
  const who = classOf.get(c.sourceID);
  const neck = (c.gear ?? [])[1];
  const weapon = (c.gear ?? [])[15];
  const neckName = neck?.id ? (meta[String(neck.id)]?.name ?? `item ${neck.id}`) : "—";
  const isJc = neck?.id && JC_NECK_ITEM_IDS.includes(neck.id) ? " [JC]" : "";
  const auras = (c.auras ?? []).map((a) => a.ability).join(",");
  console.log(`${(who?.name ?? c.sourceID).toString().padEnd(16)} ${(who?.cls ?? "?").padEnd(8)} | neck=${neckName}${isJc} (${neck?.id ?? 0}) | wpnTempEnch=${weapon?.temporaryEnchant ?? "-"} | auras=[${auras}]`);
}

// Does the on-use buff actually land in combatantInfo pull-auras (what our
// detection reads)? Count, per player, how many boss fights carry 31025/33/35.
console.log("\n=== JC-neck on-use BUFF (31025/31033/31035) in pull-auras, per player per fight ===");
const jcByPlayer = new Map<number, number>();
for (const c of combatants) {
  if ((c.auras ?? []).some((a) => NECK_ABSORB_IDS.includes(a.ability))) {
    jcByPlayer.set(c.sourceID, (jcByPlayer.get(c.sourceID) ?? 0) + 1);
  }
}
if (jcByPlayer.size === 0) console.log("(none found in any pull-aura — the logged aura id differs from the tooltip use-spell id)");
for (const [pid, n] of jcByPlayer) console.log(`${classOf.get(pid)?.name ?? pid}: buff in pull-auras on ${n} boss fight(s)`);

console.log("\n=== event scan (Buffs/Casts/Healing) for 31025/31033/31035 ===");
for (const dt of ["Buffs", "Casts", "Healing"]) {
  try {
    const hits = await scan(dt, token);
    console.log(`${dt}:`, Object.keys(hits).length ? hits : "(none)");
  } catch (e) {
    console.log(`${dt}: error ${(e as Error).message}`);
  }
}
