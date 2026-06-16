/**
 * M4 end-to-end harness. Exercises the REAL code path against a live WCL report:
 *   real fetchers -> real normalizeReport -> real validate()/shadowResistance()/compareTimelines()
 *   with the actual @wcl/data config. Validates the M4 shapes that were assumed at
 *   build time (Deaths events -> npcKills, combatantInfo auras -> SR-from-buffs) and
 *   dumps the per-zone NPC kill counts needed to correct the verified:false
 *   MH/BT/ZA speedrun npc ids.
 *
 * Usage:
 *   WCL_CLIENT_ID=xxx WCL_CLIENT_SECRET=yyy \
 *     pnpm --filter @wcl/api exec tsx scripts/e2e-m4.ts <reportCode> [secondReportCode]
 *
 * Pick a SPEEDRUN report (MH/BT/ZA/SW) for validate, ideally one whose zone has a
 * Shahraz/Kaz'rogal/Azgalor kill for shadow-resi. Pass an optional second report
 * code to also exercise the two-log timeline comparison.
 */
import { fetchToken, fetchRawReport, fetchCombatantInfo, fetchDeaths, type RawDeathEvent } from "../src/wcl";
import { normalizeReport } from "../src/normalize";
import { validate, shadowResistance, compareTimelines, SR_BOSSES } from "@wcl/core";
import {
  validateRules, zoneCodeByName,
  itemShadowRes, shadowResEnchants, shadowResBuffs, SR_SOFT_TARGET,
} from "@wcl/data";

const API_URL = "https://classic.warcraftlogs.com/api/v2/client";
const code = process.argv[2];
const code2 = process.argv[3];
const { WCL_CLIENT_ID, WCL_CLIENT_SECRET } = process.env;
if (!code || !WCL_CLIENT_ID || !WCL_CLIENT_SECRET) {
  console.error("usage: WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api exec tsx scripts/e2e-m4.ts <reportCode> [secondReportCode]");
  process.exit(1);
}

const num = (n: number) => n.toLocaleString();
const ok = (b: boolean) => (b ? "✓" : "✗");

const token = (await fetchToken(WCL_CLIENT_ID, WCL_CLIENT_SECRET)).accessToken;

/** Fetch NPC actors WITH names (the app's report query only pulls id+gameID). */
async function fetchNpcNames(reportCode: string): Promise<Map<number, string>> {
  const query = `query N($code:String!){reportData{report(code:$code){masterData{actors(type:"NPC"){gameID name}}}}}`;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { code: reportCode } }),
  });
  const json = (await res.json()) as { data?: { reportData: { report: { masterData: { actors: { gameID: number; name: string }[] } } } } };
  const m = new Map<number, string>();
  for (const a of json.data?.reportData.report.masterData.actors ?? []) if (!m.has(a.gameID)) m.set(a.gameID, a.name);
  return m;
}

async function load(reportCode: string) {
  const raw = await fetchRawReport(reportCode, token);
  const bossFightIds = raw.fights.filter((f) => f.encounterID !== 0).map((f) => f.id);
  const [combatants, deaths] = await Promise.all([
    fetchCombatantInfo(reportCode, token, bossFightIds),
    fetchDeaths(reportCode, token),
  ]);
  const data = normalizeReport(reportCode, raw, combatants, {}, { deaths });
  return { raw, data, deaths };
}

const { raw, data, deaths } = await load(code);
console.log(`zone: ${raw.zone?.name} | fights: ${raw.fights.length} | players: ${data.players.length}`);
console.log(`mapped zone code: ${zoneCodeByName[raw.zone?.name ?? ""] ?? "(none — falls back to zone name)"}`);

// ---- Stage A: raw Deaths shape + npcKills resolution ----
console.log("\n========== DEATHS / npcKills DIAGNOSTICS ==========");
console.log(`raw death events: ${deaths.length}`);
if (deaths.length > 0) {
  console.log("  key union:", [...new Set(deaths.flatMap((e: RawDeathEvent) => Object.keys(e)))].sort().join(", "));
  console.log("  sample:", JSON.stringify(deaths[0]));
}
const npcKills = data.npcKills ?? {};
const npcActorIds = new Set((raw.masterData?.npcs ?? []).map((n) => n.id));
const mapped = deaths.filter((d) => npcActorIds.has(d.targetID)).length;
console.log(`  deaths whose targetID resolves to an NPC actor: ${mapped}/${deaths.length} (rest are player deaths / unmapped)`);
console.log(`  distinct NPC gameIds killed: ${Object.keys(npcKills).length}`);
console.log(`  firstPullNpcIds (valid-start check): ${(data.firstPullNpcIds ?? []).join(", ") || "(none)"}`);

const npcNames = await fetchNpcNames(code);
console.log("\n  top 30 killed NPC gameIds (gameId → kills | name) — use to correct verified:false ids:");
for (const [id, n] of Object.entries(npcKills).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`    ${id}: ${n}  ${npcNames.get(Number(id)) ?? "(name not in masterData)"}`);
}

// ---- Stage B: validate() ----
console.log("\n========== VALIDATE ==========");
const vres = validate(data, { rules: validateRules, zoneCodeByName });
if (!vres) {
  console.log("validate() returned null (npcKills missing — refresh report from WCL).");
} else if (vres.unsupportedZone) {
  console.log(`unsupported zone "${vres.zone}" — no speedrun rule.`);
} else {
  console.log(`zone ${vres.zone} (rules verified: ${ok(vres.zoneVerified)}) | valid start: ${ok(vres.validStartingPoint)} | bosses ${vres.bosses.killed}/${vres.bosses.required} ${ok(vres.bosses.enough)} | chars ${vres.totalCharacters}`);
  console.log(`OVERALL VALID: ${ok(vres.isValid)}`);
  console.log("  trash requirements (name | required npcIds | killed | enough):");
  const rule = validateRules.find((r) => r.zone === vres.zone);
  for (const row of vres.trash) {
    const ruleRow = rule?.trash.find((t) => t.name === row.name);
    const ids = ruleRow?.npcIds ?? [];
    const idsWithHits = ids.filter((id) => (npcKills[String(id)] ?? 0) > 0);
    console.log(`    ${ok(row.enough)} ${row.name}: need ${row.minKills}, killed ${row.killed} | ids [${ids.join(",")}] | ids actually seen in kills: [${idsWithHits.join(",") || "NONE — likely wrong ids"}]`);
  }
}

// ---- Stage C: shadowResistance() ----
console.log("\n========== SHADOW RESISTANCE ==========");
const srPresent = SR_BOSSES.filter((b) => data.fights.some((f) => f.isBoss && f.name === b));
console.log(`SR bosses present: ${srPresent.join(", ") || "(none — SR tab N/A for this report)"}`);
const srCfg = { itemShadowRes, enchantShadowRes: shadowResEnchants, buffShadowRes: shadowResBuffs, softTarget: SR_SOFT_TARGET };
for (const boss of srPresent) {
  const sr = shadowResistance(data, srCfg, { boss });
  if (!sr) { console.log(`  ${boss}: shadowResistance() returned null`); continue; }
  console.log(`\n  [${boss}] fight ${sr.fightId} (${sr.isKill ? "KILL" : "wipe"}) — ${sr.players.length} players:`);
  for (const p of sr.players.sort((a, b) => b.total - a.total)) {
    console.log(`    ${p.name}: total ${p.total} (gear ${p.fromGear} + buffs ${p.fromBuffs}) [${p.severity}]`);
  }
  const withGear = sr.players.filter((p) => p.fromGear > 0).length;
  const withBuffs = sr.players.filter((p) => p.fromBuffs > 0).length;
  console.log(`  → ${withGear}/${sr.players.length} have gear SR, ${withBuffs}/${sr.players.length} have buff SR (0 buff SR across the board may mean the priest/mage-buff logging gap).`);
}

// ---- Stage D: two-log timeline ----
if (code2) {
  console.log("\n========== TIMELINE (two-log compare) ==========");
  const b = await load(code2);
  console.log(`A: ${data.reportId} (${data.fights.length} pulls) vs B: ${b.data.reportId} (${b.data.fights.length} pulls)`);
  const cmp = compareTimelines(data, b.data);
  console.log(`A total idle ${num(cmp.a.totalIdle ?? 0)} | B total idle ${num(cmp.b.totalIdle ?? 0)}`);
  console.log("  per-boss cumulative diff:");
  for (const d of cmp.bossDiffs) console.log("    ", JSON.stringify(d));
} else {
  console.log("\n(no second report code given — skipping timeline; pass one as the 2nd arg to test it)");
}

console.log("\ndone.");
