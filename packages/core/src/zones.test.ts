import { describe, expect, it } from "vitest";
import { isTbcRaidZone } from "./zones";

describe("isTbcRaidZone", () => {
  it.each([
    "Karazhan", "Gruul's Lair", "Magtheridon's Lair", "Serpentshrine Cavern",
    "Tempest Keep", "Hyjal Summit", "Black Temple", "Zul'Aman", "Sunwell Plateau",
  ])("accepts %s", (z) => expect(isTbcRaidZone(z)).toBe(true));

  it.each(["Molten Core", "Naxxramas", "Icecrown Citadel", ""])(
    "rejects %s", (z) => expect(isTbcRaidZone(z)).toBe(false));
});
