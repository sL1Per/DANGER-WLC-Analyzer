import { isTbcRaidZone, type ReportData } from "@wcl/core";
import { WclError, type RawReport } from "./wcl";

export function normalizeReport(reportId: string, raw: RawReport): ReportData {
  if (!raw.zone?.name) {
    throw new WclError(422, "The zone of the report was not recognized by WCL.");
  }
  if (!isTbcRaidZone(raw.zone.name)) {
    throw new WclError(422,
      `This is the TBC analyzer; report zone "${raw.zone.name}" is not a TBC raid.`);
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
    players: raw.masterData.actors.map((a) => ({ id: a.id, name: a.name, class: a.subType })),
  };
}
