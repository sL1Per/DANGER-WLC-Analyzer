import type { ReportData } from "../types";

export const reportFixture: ReportData = {
  reportId: "a1B2c3D4e5F6g7H8",
  title: "T5 fun",
  zoneName: "Serpentshrine Cavern",
  startTime: 1_700_000_000_000,
  endTime: 1_700_000_400_000,
  fights: [
    { id: 1, name: "Underbog Colossus", encounterId: 0, isBoss: false, startTime: 0, endTime: 60_000 },
    { id: 2, name: "Hydross the Unstable", encounterId: 623, isBoss: true, kill: false, startTime: 70_000, endTime: 130_000 },
    { id: 3, name: "Hydross the Unstable", encounterId: 623, isBoss: true, kill: true, startTime: 150_000, endTime: 250_000 },
    { id: 4, name: "Coilfang Shatterer", encounterId: 0, isBoss: false, startTime: 260_000, endTime: 290_000 },
    { id: 5, name: "The Lurker Below", encounterId: 624, isBoss: true, kill: true, startTime: 300_000, endTime: 380_000 },
  ],
  players: [
    { id: 1, name: "Playerone", class: "Mage" },
    { id: 2, name: "Playertwo", class: "Warrior" },
  ],
};
