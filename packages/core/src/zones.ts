/** Validate by zone NAME, not id — WCL zone ids differ between classic re-releases. */
const TBC_RAID_ZONES = new Set([
  "Karazhan", "Gruul's Lair", "Magtheridon's Lair", "Gruul / Magtheridon",
  "Serpentshrine Cavern", "Tempest Keep", "SSC/TK",
  "Hyjal Summit", "Mount Hyjal", "Black Temple", "Zul'Aman", "Sunwell Plateau",
]);

export function isTbcRaidZone(zoneName: string): boolean {
  return TBC_RAID_ZONES.has(zoneName);
}
