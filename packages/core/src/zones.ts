/** Validate by zone NAME, not id — WCL zone ids differ between classic re-releases. */
const TBC_RAID_ZONES = new Set([
  "Karazhan", "Gruul's Lair", "Magtheridon's Lair", "Gruul / Magtheridon",
  "Serpentshrine Cavern", "Tempest Keep", "SSC / TK",
  "Hyjal Summit", "Mount Hyjal", "Black Temple", "Zul'Aman", "Sunwell Plateau",
]);

/** Collapse whitespace around slashes + lowercase, so "SSC / TK", "SSC/TK", and
 *  "ssc /tk" all compare equal — WCL's spacing for combined-instance zones varies. */
const normalizeZone = (zoneName: string): string =>
  zoneName.trim().replace(/\s*\/\s*/g, "/").toLowerCase();

const TBC_RAID_ZONES_NORMALIZED = new Set([...TBC_RAID_ZONES].map(normalizeZone));

export function isTbcRaidZone(zoneName: string): boolean {
  return TBC_RAID_ZONES_NORMALIZED.has(normalizeZone(zoneName));
}
