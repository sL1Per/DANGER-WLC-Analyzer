import { isTbcRaidZone, type ItemMeta, type ReportData } from "@wcl/core";
import { WclError, type RawCombatantInfo, type RawReport } from "./wcl";

export function normalizeReport(
  reportId: string,
  raw: RawReport,
  combatants: RawCombatantInfo[] = [],
  itemMeta: Record<string, ItemMeta> = {},
): ReportData {
  if (!raw.zone?.name) {
    throw new WclError(422, "The zone of the report was not recognized by WCL.");
  }
  if (!isTbcRaidZone(raw.zone.name)) {
    throw new WclError(422,
      `This is the TBC analyzer; report zone "${raw.zone.name}" is not a TBC raid.`);
  }
  if (!raw.masterData?.actors) {
    throw new WclError(422, "Report has no player data (it may be private or restricted).");
  }
  return {
    reportId,
    title: raw.title,
    zoneName: raw.zone.name,
    startTime: raw.startTime,
    endTime: raw.endTime,
    fights: raw.fights.map((f) => ({
      id: f.id,
      name: f.name,
      encounterId: f.encounterID,
      isBoss: f.encounterID !== 0,
      kill: f.encounterID !== 0 ? (f.kill ?? false) : undefined,
      startTime: f.startTime,
      endTime: f.endTime,
    })),
    players: filterToParticipants(raw),
    gear: combatants.map((c) => ({
      fightId: c.fight,
      playerId: c.sourceID,
      // map before dropping id-0 placeholders: Classic logs omit `slot`, so the
      // array index IS the slot id, and empty slots must still consume their index
      items: (c.gear ?? [])
        .map((g, index) => ({
          slot: g.slot ?? index,
          itemId: g.id,
          itemLevel: g.itemLevel,
          permanentEnchantId: g.permanentEnchant,
          temporaryEnchantId: g.temporaryEnchant,
          gemIds: (g.gems ?? []).map((gem) => gem.id),
        }))
        .filter((i) => i.itemId !== 0),
    })),
    itemMeta,
  };
}

/**
 * Classic combat logs record every player the logger walks past (e.g. in
 * Shattrath), so masterData lists far more "players" than the raid had.
 * Keep only actors that appear in some fight's friendlyPlayers; if WCL gave
 * us no participation info at all, fall back to the full actor list.
 */
function filterToParticipants(raw: RawReport) {
  const participants = new Set<number>();
  let hasInfo = false;
  for (const f of raw.fights) {
    if (f.friendlyPlayers == null) continue;
    hasInfo = true;
    for (const id of f.friendlyPlayers) participants.add(id);
  }
  const actors = raw.masterData!.actors;
  const kept = hasInfo ? actors.filter((a) => participants.has(a.id)) : actors;
  return kept.map((a) => ({ id: a.id, name: a.name, class: a.subType }));
}
