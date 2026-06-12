import { useMemo, useState } from "react";
import { gearListing, listGearFights, LISTING_SLOTS, SLOT_NAMES, type ReportData } from "@wcl/core";

export function GearListingView({ report }: { report: ReportData }) {
  const fights = useMemo(() => listGearFights(report), [report]);
  const [fightId, setFightId] = useState<number | undefined>(undefined);
  const { fight, rows } = useMemo(() => gearListing(report, fightId), [report, fightId]);

  if (!fight) {
    return <p>No gear data in this report (combatantInfo missing — loggers may have been too far from the boss at pull).</p>;
  }
  return (
    <div>
      <label>
        Boss fight:{" "}
        <select aria-label="boss fight" value={fight.id}
          onChange={(e) => setFightId(Number(e.target.value))}>
          {fights.map((f) => (
            <option key={f.id} value={f.id}>{f.name} ({f.kill ? "kill" : "wipe"})</option>
          ))}
        </select>
      </label>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>player</th>
              {LISTING_SLOTS.map((s) => <th key={s}>{SLOT_NAMES[s]}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId}>
                <td>{r.playerName}</td>
                {LISTING_SLOTS.map((s) => <td key={s}>{r.items[s]?.name ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
