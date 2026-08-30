import type { ItemMeta, ReportData } from "@wcl/core";
import {
  consumableBuffs, drumSpells, jcNecks, suboptimalConsumables, hasteBuffs,
  battleShoutBuffIds,
} from "@wcl/data";
import { normalizeReport } from "./normalize";
import {
  fetchRawReport, fetchCombatantInfo, fetchItemMeta, fetchBuffEvents, fetchCastEvents,
  fetchDeaths, fetchInterrupts, fetchDamageTaken, fetchDamageDone, fetchHealingDone,
  fetchAllCasts, fetchTable, fetchEnemyDebuffs, fetchAbsorbs, fetchRankings,
  type RawBuffEvent, type RawCastEvent, type RawCombatantInfo, type RawDeathEvent,
  type RawInterruptEvent, type RawDamageEvent, type RawTableEntry, type RawDebuffEvent,
  type RawRankingEntry,
} from "./wcl";

const DRUM_BUFF_IDS = drumSpells.map((d) => d.buffId);
const DRUM_CAST_IDS = [...new Set(drumSpells.map((d) => d.castId))];
const TRACKED_BUFF_IDS = [...new Set([
  ...consumableBuffs.map((b) => b.spellId),
  ...DRUM_BUFF_IDS,
  ...jcNecks.map((n) => n.buffId),
  ...suboptimalConsumables.filter((s) => s.kind === "buff").map((s) => s.id),
  ...hasteBuffs.map((h) => h.spellId),
  ...battleShoutBuffIds,
])];

/** Fetch + normalize a full report in the browser using the caller's own WCL
 *  token. Ported from the old apps/api GET /api/report handler — same parallel
 *  best-effort fetch strategy, minus the HTTP/cache shell. */
export async function loadReport(id: string, token: string): Promise<ReportData> {
  const rawReport = await fetchRawReport(id, token);
  const bossFightIds = rawReport.fights.filter((f) => f.encounterID !== 0).map((f) => f.id);

  let combatants: RawCombatantInfo[] = [];
  let itemMeta: Record<string, ItemMeta> = {};
  let buffEvents: RawBuffEvent[] = [];
  let castEvents: RawCastEvent[] = [];
  let deaths: RawDeathEvent[] | undefined;
  {
    const none = Promise.resolve([]);
    const [combatantsR, buffR, castR, deathR] = await Promise.allSettled([
      bossFightIds.length > 0 ? fetchCombatantInfo(id, token, bossFightIds) : none,
      bossFightIds.length > 0 ? fetchBuffEvents(id, token, TRACKED_BUFF_IDS) : none,
      fetchCastEvents(id, token, DRUM_CAST_IDS),
      fetchDeaths(id, token),
    ]);
    if (combatantsR.status === "fulfilled") combatants = combatantsR.value as RawCombatantInfo[];
    if (buffR.status === "fulfilled") buffEvents = buffR.value as RawBuffEvent[];
    if (castR.status === "fulfilled") castEvents = castR.value as RawCastEvent[];
    if (deathR.status === "fulfilled") deaths = deathR.value as RawDeathEvent[];
    const ids = new Set<number>();
    for (const c of combatants) for (const g of c.gear ?? []) {
      if (g.id !== 0) ids.add(g.id);
      for (const gem of g.gems ?? []) ids.add(gem.id);
    }
    if (ids.size > 0) {
      try { itemMeta = await fetchItemMeta([...ids], token); } catch { /* names degrade to "item #id" */ }
    }
  }

  let interrupts: RawInterruptEvent[] = [];
  let damageTaken: RawDamageEvent[] = [];
  let damageDone: RawDamageEvent[] = [];
  let healingDone: RawDamageEvent[] = [];
  let allCasts: RawCastEvent[] = [];
  let damageDoneTable: RawTableEntry[] = [];
  let healingTable: RawTableEntry[] = [];
  let damageTakenTable: RawTableEntry[] = [];
  let enemyDebuffs: RawDebuffEvent[] = [];
  let absorbEvents: RawDamageEvent[] = [];
  let rankings: RawRankingEntry[] = [];
  const allFightIds = rawReport.fights.map((f) => f.id);
  const hasBoss = bossFightIds.length > 0;
  if (allFightIds.length > 0) {
    const none = Promise.resolve([]);
    const [intR, dtR, ddR, castR, ddtR, htR, dttR, edR, absR, rankR, hdR] = await Promise.allSettled([
      fetchInterrupts(id, token, allFightIds),
      fetchDamageTaken(id, token, allFightIds),
      fetchDamageDone(id, token, allFightIds),
      fetchAllCasts(id, token, allFightIds),
      hasBoss ? fetchTable(id, token, "DamageDone", bossFightIds) : none,
      hasBoss ? fetchTable(id, token, "Healing", bossFightIds) : none,
      hasBoss ? fetchTable(id, token, "DamageTaken", bossFightIds) : none,
      fetchEnemyDebuffs(id, token, allFightIds),
      fetchAbsorbs(id, token, allFightIds),
      hasBoss ? fetchRankings(id, token) : none,
      fetchHealingDone(id, token, allFightIds),
    ]);
    if (intR.status === "fulfilled") interrupts = intR.value as RawInterruptEvent[];
    if (dtR.status === "fulfilled") damageTaken = dtR.value as RawDamageEvent[];
    if (ddR.status === "fulfilled") damageDone = ddR.value as RawDamageEvent[];
    if (castR.status === "fulfilled") allCasts = castR.value as RawCastEvent[];
    if (ddtR.status === "fulfilled") damageDoneTable = ddtR.value as RawTableEntry[];
    if (htR.status === "fulfilled") healingTable = htR.value as RawTableEntry[];
    if (dttR.status === "fulfilled") damageTakenTable = dttR.value as RawTableEntry[];
    if (edR.status === "fulfilled") enemyDebuffs = edR.value as RawDebuffEvent[];
    if (absR.status === "fulfilled") absorbEvents = absR.value as RawDamageEvent[];
    if (rankR.status === "fulfilled") rankings = rankR.value as RawRankingEntry[];
    if (hdR.status === "fulfilled") healingDone = hdR.value as RawDamageEvent[];
  }

  const actorNames: Record<number, string> = {};
  for (const a of rawReport.masterData?.actors ?? []) actorNames[a.id] = a.name;
  for (const n of rawReport.masterData?.npcs ?? []) actorNames[n.id] = actorNames[n.id] ?? n.name ?? `NPC ${n.gameID}`;
  const abilityMeta: Record<string, { name: string }> = {};
  for (const a of rawReport.masterData?.abilities ?? []) abilityMeta[String(a.gameID)] = { name: a.name };
  const petOwners: Record<number, number> = {};
  for (const p of rawReport.masterData?.pets ?? []) petOwners[p.id] = p.petOwner;

  return normalizeReport(id, rawReport, combatants, itemMeta, {
    buffEvents, castEvents, deaths,
    trackedBuffIds: TRACKED_BUFF_IDS, drumBuffIds: DRUM_BUFF_IDS,
    interrupts, damageTaken, damageDone, allCasts,
    damageDoneTable, healingTable, damageTakenTable, actorNames,
    enemyDebuffs, absorbEvents, rankings, healingDone, abilityMeta, petOwners,
  });
}
