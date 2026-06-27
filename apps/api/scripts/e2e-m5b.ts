/**
 * M5b end-to-end harness. Exercises the REAL code path against a live WCL report:
 *   real fetchers (scoped like app.ts) -> real normalizeReport -> real rpb()/classMetrics
 *   with the actual @wcl/data config. Prints a sanity report plus raw-shape
 *   diagnostics for the two ASSUMED shapes (enemy Debuffs, absorbs).
 *
 * Usage:
 *   WCL_CLIENT_ID=xxx WCL_CLIENT_SECRET=yyy \
 *     pnpm --filter @wcl/api exec tsx scripts/e2e-m5b.ts <reportCode>
 *
 * Pick a report with casters/warlocks (debuff uptime) and ideally an SR boss
 * (absorbs). The handoff used C4Zm2Rcgq6Tb7Mxn (SSC / TK, 25 players).
 */
import {
  fetchToken, fetchRawReport, fetchCombatantInfo, fetchBuffEvents, fetchCastEvents,
  fetchDeaths, fetchInterrupts, fetchDamageTaken, fetchDamageDone, fetchAllCasts,
  fetchTable, fetchEnemyDebuffs, fetchAbsorbs,
  type RawInterruptEvent, type RawDamageEvent,
} from "../../web/src/lib/wcl/wcl";
import { normalizeReport } from "../src/normalize";
import { rpb } from "@wcl/core";
import {
  consumableBuffs, drumSpells, jcNecks, suboptimalConsumables, hasteBuffs,
  battleShoutBuffIds, spellCastTimes, roleSignals, casterClasses, physicalSpecs, casterSpecs,
  engineeringDamageIds, oilOfImmolationSpellId, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
} from "@wcl/data";

const code = process.argv[2];
const { WCL_CLIENT_ID, WCL_CLIENT_SECRET } = process.env;
if (!code || !WCL_CLIENT_ID || !WCL_CLIENT_SECRET) {
  console.error("usage: WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api exec tsx scripts/e2e-m5b.ts <reportCode>");
  process.exit(1);
}

// Mirror app.ts's tracked-buff set so self-buff uptimes resolve.
const DRUM_BUFF_IDS = drumSpells.map((d) => d.buffId);
const DRUM_CAST_IDS = [...new Set(drumSpells.map((d) => d.castId))];
const TRACKED_BUFF_IDS = [...new Set([
  ...consumableBuffs.map((b) => b.spellId),
  ...DRUM_BUFF_IDS,
  ...jcNecks.map((n) => n.buffId),
  ...suboptimalConsumables.filter((s) => s.kind === "buff").map((s) => s.id),
  ...hasteBuffs.map((h) => h.spellId),
  ...battleShoutBuffIds,
  // M5b: include curated self-buff-uptime ability ids so they resolve
  ...classAbilities.filter((a) => a.measure === "self-buff-uptime").flatMap((a) => a.spellIds),
])];

const num = (n: number) => n.toLocaleString();
const ok = (b: boolean) => (b ? "✓" : "✗");

const token = (await fetchToken(WCL_CLIENT_ID, WCL_CLIENT_SECRET)).accessToken;
const raw = await fetchRawReport(code, token);
const bossFightIds = raw.fights.filter((f) => f.encounterID !== 0).map((f) => f.id);
console.log(`zone: ${raw.zone?.name} | fights: ${raw.fights.length} | boss fights: ${bossFightIds.length}`);
if (bossFightIds.length === 0) { console.error("no boss fights — pick another report"); process.exit(1); }

// ---- Stage A: raw-shape diagnostics for the two ASSUMED shapes ----
console.log("\n========== RAW SHAPE DIAGNOSTICS ==========");
const rawDebuffs = await fetchEnemyDebuffs(code, token, bossFightIds);
console.log(`\nDebuffs: ${rawDebuffs.length} apply/remove/refresh events`);
if (rawDebuffs.length > 0) {
  const keys = new Set<string>();
  for (const e of rawDebuffs) for (const k of Object.keys(e)) keys.add(k);
  console.log("  key union:", [...keys].sort().join(", "));
  console.log("  sample:", JSON.stringify(rawDebuffs[0]));
  const types = new Map<string, number>();
  for (const e of rawDebuffs) types.set(e.type, (types.get(e.type) ?? 0) + 1);
  console.log("  type counts:", Object.fromEntries(types));
}
const rawAbsorbs = await fetchAbsorbs(code, token, bossFightIds);
console.log(`\nAbsorbs (DamageTaken w/ absorbed>0): ${rawAbsorbs.length} events`);
if (rawAbsorbs.length > 0) {
  console.log("  key union:", [...new Set(rawAbsorbs.flatMap((e) => Object.keys(e)))].sort().join(", "));
  console.log("  sample:", JSON.stringify(rawAbsorbs[0]));
} else {
  console.log("  ⚠ NONE found — absorbs may use a distinct event type; needs investigation.");
}

// ---- Stage B: full real pipeline (fetch -> normalize -> rpb) ----
console.log("\n========== FULL PIPELINE ==========");
const none = Promise.resolve([] as never[]);
const [combatantsR, buffR, drumCastR, deathR] = await Promise.allSettled([
  fetchCombatantInfo(code, token, bossFightIds),
  fetchBuffEvents(code, token, TRACKED_BUFF_IDS),
  fetchCastEvents(code, token, DRUM_CAST_IDS),
  fetchDeaths(code, token),
]);
const [intR, dtR, ddR, castR, ddtR, htR, dttR] = await Promise.allSettled([
  fetchInterrupts(code, token, bossFightIds),
  fetchDamageTaken(code, token, bossFightIds),
  fetchDamageDone(code, token, bossFightIds),
  fetchAllCasts(code, token, bossFightIds),
  fetchTable(code, token, "DamageDone", bossFightIds),
  fetchTable(code, token, "Healing", bossFightIds),
  fetchTable(code, token, "DamageTaken", bossFightIds),
]);
const val = <T>(r: PromiseSettledResult<T>, d: T): T => (r.status === "fulfilled" ? r.value : d);

const rawInterrupts = (intR.status === "fulfilled" ? intR.value : []) as RawInterruptEvent[];
const rawDamageTaken = (dtR.status === "fulfilled" ? dtR.value : []) as RawDamageEvent[];

const actorNames: Record<number, string> = {};
for (const a of raw.masterData?.actors ?? []) actorNames[a.id] = a.name;

const data = normalizeReport(code, raw, val(combatantsR, []) as never, {}, {
  buffEvents: val(buffR, []) as never, castEvents: val(drumCastR, []) as never, deaths: val(deathR, []) as never,
  trackedBuffIds: TRACKED_BUFF_IDS, drumBuffIds: DRUM_BUFF_IDS,
  interrupts: rawInterrupts as never, damageTaken: rawDamageTaken as never, damageDone: val(ddR, []) as never,
  allCasts: val(castR, []) as never,
  damageDoneTable: val(ddtR, []) as never, healingTable: val(htR, []) as never, damageTakenTable: val(dttR, []) as never,
  actorNames,
  enemyDebuffs: rawDebuffs, absorbEvents: rawAbsorbs,
});

console.log(`players: ${data.players.length} | enemyDebuffs intervals: ${data.enemyDebuffs?.length ?? 0} | absorbs: ${data.absorbs?.length ?? 0}`);

const result = rpb(data, {
  roles: { signals: roleSignals, casterClasses, physicalSpecs, casterSpecs },
  activity: { castTimes: spellCastTimes, hasteBuffs, aoeWindowMs: 500 },
  engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
});
if (!result) { console.error("rpb() returned null — RPB fields missing"); process.exit(1); }

// role distribution + finite-number guard
const roleDist: Record<string, number> = {};
let nanCount = 0;
const isFinite2 = (n: number | undefined) => n === undefined || Number.isFinite(n);
for (const r of result.rows) {
  roleDist[r.role] = (roleDist[r.role] ?? 0) + 1;
  for (const v of [r.totalAvoidableDamageTaken, r.totalPartlyAvoidable, r.totalAbsorbed, r.damageReflected, r.damageToHostilePlayers, r.battleShoutUptime]) if (!isFinite2(v)) nanCount++;
  for (const c of r.classRows) if (!isFinite2(c.uptimePct) || !isFinite2(c.castCount)) nanCount++;
}
console.log("role distribution:", roleDist);
console.log(`NaN/Infinity in numeric fields: ${nanCount} ${ok(nanCount === 0)}`);
console.log(`absorbs populated: ${ok((data.absorbs?.length ?? 0) > 0)} | total absorbed across raid: ${num(result.rows.reduce((s, r) => s + r.totalAbsorbed, 0))}`);

// which curated abilities actually fired (>0 uptime or >0 casts) — candidates to verify & flip
console.log("\n========== CLASS ABILITIES OBSERVED (candidates to flip verified:true) ==========");
const seen = new Map<string, { name: string; cls: string; max: number; kind: string }>();
for (const r of result.rows) {
  for (const c of r.classRows) {
    const metric = c.measure === "cast-count" ? (c.castCount ?? 0) : (c.uptimePct ?? 0);
    const prev = seen.get(c.key);
    if (!prev || metric > prev.max) seen.set(c.key, { name: c.name, cls: r.className, max: metric, kind: c.measure });
  }
}
for (const [key, v] of [...seen.entries()].sort((a, b) => b[1].max - a[1].max)) {
  const shown = v.kind === "cast-count" ? `${v.max} casts` : `${(v.max * 100).toFixed(0)}% max uptime`;
  console.log(`  ${v.max > 0 ? "●" : "○"} ${v.name} (${v.cls}, ${key}) — ${shown}`);
}

// sample one player per role with class rows
console.log("\n========== SAMPLE ROWS ==========");
for (const role of ["tank", "healer", "caster", "physical"] as const) {
  const r = result.rows.find((x) => x.role === role && x.classRows.length > 0);
  if (!r) continue;
  console.log(`\n[${role}] ${r.playerName} (${r.className}) — deaths ${r.deaths}, absorbed ${num(r.totalAbsorbed)}, avoidable ${num(r.totalAvoidableDamageTaken)}/${num(r.totalPartlyAvoidable)}`);
  for (const c of r.classRows) {
    const m = c.measure === "cast-count" ? `${c.castCount} casts` : `${((c.uptimePct ?? 0) * 100).toFixed(0)}% uptime`;
    console.log(`    - ${c.name}: ${m}${c.rankFlag ? " ⚠low-rank" : ""}`);
  }
}

// ---- Stage D: tuning diagnostics (drive the post-run live M7 commit) ----
console.log("\n========== TUNING DIAGNOSTICS (for the post-run live commit) ==========");
const playerIdSet = new Set(data.players.map((p) => p.id));

// 0. enemyDebuff filter breakdown — replicates normalize's filter to explain the interval count.
console.log(`\n[enemyDebuffs] raw ${rawDebuffs.length} events; normalize produced ${data.enemyDebuffs?.length ?? 0} intervals`);
{
  const srcPlayer = rawDebuffs.filter((e) => playerIdSet.has(e.sourceID)).length;
  const tgtPlayer = rawDebuffs.filter((e) => playerIdSet.has(e.targetID)).length;
  const p2e = rawDebuffs.filter((e) => playerIdSet.has(e.sourceID) && !playerIdSet.has(e.targetID));
  const p2eApplies = p2e.filter((e) => e.type === "applydebuff");
  console.log(`  source-is-player ${srcPlayer} | target-is-player ${tgtPlayer} | player→enemy ${p2e.length} (applies ${p2eApplies.length})`);
  const p2eSpells = new Map<number, number>();
  for (const e of p2e) p2eSpells.set(e.abilityGameID, (p2eSpells.get(e.abilityGameID) ?? 0) + 1);
  console.log("  player→enemy debuff spellIds (id: events):",
    JSON.stringify(Object.fromEntries([...p2eSpells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30))));
  const curatedDebuffIds = new Set(classAbilities.filter((a) => a.measure === "enemy-debuff-uptime").flatMap((a) => a.spellIds));
  console.log("  curated debuff ids seen player→enemy:", [...p2eSpells.keys()].filter((id) => curatedDebuffIds.has(id)).join(", ") || "NONE");
  const combos = new Set(p2eApplies.map((e) => `${e.fight}:${e.targetID}:${e.abilityGameID}`));
  console.log(`  distinct (fight:enemy:spell) combos among player→enemy applies = ${combos.size} (lower bound; reapplies after a removedebuff add more intervals)`);
  console.log("  → near-zero player→enemy here means the fetch returned friendly-target debuffs (need hostilityType: Enemies).");
}

// 1. Interrupt direction — proves source=player vs target=player (the 'interrupts always 0' bug).
console.log(`\n[interrupts] ${rawInterrupts.length} events`);
if (rawInterrupts.length > 0) {
  console.log("  key union:", [...new Set(rawInterrupts.flatMap((e) => Object.keys(e)))].sort().join(", "));
  console.log("  sample:", JSON.stringify(rawInterrupts[0]));
  const srcIsPlayer = rawInterrupts.filter((i) => playerIdSet.has(i.sourceID)).length;
  const tgtIsPlayer = rawInterrupts.filter((i) => playerIdSet.has(i.targetID)).length;
  console.log(`  sourceID is a player: ${srcIsPlayer}/${rawInterrupts.length} | targetID is a player: ${tgtIsPlayer}/${rawInterrupts.length}`);
  console.log("  → the LARGER side is the interrupter; normalize.ts should key interrupts by that id.");
}

// 2. Per-boss top DamageTaken abilities — avoidable candidates + confirm seeded ids appear.
console.log("\n[avoidable] top DamageTaken ability ids across boss fights (id → total dmg / hits):");
const byAbility = new Map<number, { total: number; hits: number }>();
for (const d of rawDamageTaken) {
  const e = byAbility.get(d.abilityGameID) ?? { total: 0, hits: 0 };
  e.total += d.amount ?? 0; e.hits++; byAbility.set(d.abilityGameID, e);
}
for (const [id, e] of [...byAbility.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 25)) {
  console.log(`  ${avoidableAbilityIds.has(id) ? "★" : " "} ${id}: ${num(e.total)} dmg / ${e.hits} hits`);
}
const seededHit = [...avoidableAbilityIds].filter((id) => byAbility.has(id));
console.log(`  ★ = currently curated avoidable. Seeded ids present in this report: ${seededHit.length ? seededHit.join(", ") : "NONE (pick this zone's real avoidable ids from the list above)"}`);

// 3. Role assignment by class — surfaces tank under-detection (warriors landing 'physical').
console.log("\n[roles] assignment by class (warriors/feral druids in 'physical' that should be 'tank' need a better signal):");
const byClassRole = new Map<string, Record<string, number>>();
for (const r of result.rows) {
  const m = byClassRole.get(r.className) ?? {};
  m[r.role] = (m[r.role] ?? 0) + 1; byClassRole.set(r.className, m);
}
for (const [cls, m] of byClassRole) console.log(`  ${cls}: ${JSON.stringify(m)}`);

console.log("\ndone.");
