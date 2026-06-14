import { useMemo, useState } from "react";
import {
  gearIssues, gearListing, listGearFights, LISTING_SLOTS, REQUIRED_SLOTS,
  SEVERITY_RANK, SLOT_NAMES, type IssueSeverity, type ReportData,
} from "@wcl/core";
import { badEnchants, excludedItems, gemQuality, itemShadowRes, itemSockets } from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";

export function GearListingView({ report }: { report: ReportData }) {
  const fights = useMemo(() => listGearFights(report), [report]);
  const [fightId, setFightId] = useState<number | undefined>(undefined);
  const { fight, rows } = useMemo(() => gearListing(report, fightId), [report, fightId]);

  // worst issue severity per player per item, for the selected fight only
  const severityMap = useMemo(() => {
    const map = new Map<number, Map<number, IssueSeverity>>();
    if (!fight) return map;
    const sub = { ...report, gear: report.gear.filter((g) => g.fightId === fight.id) };
    const issueRows = gearIssues(sub, {
      minGemQuality: 3, excludeShahraz: false, listNoIssues: false,
      itemSockets, gemQuality, itemShadowRes, badEnchants, excludedItems,
    });
    for (const r of issueRows) {
      const byItem = new Map<number, IssueSeverity>();
      for (const i of r.issues) {
        if (i.itemId === 0) continue;
        const prev = byItem.get(i.itemId);
        if (!prev || SEVERITY_RANK[i.severity] > SEVERITY_RANK[prev]) byItem.set(i.itemId, i.severity);
      }
      map.set(r.playerId, byItem);
    }
    return map;
  }, [report, fight]);

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
      <SeverityLegend />
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
                {LISTING_SLOTS.map((s) => {
                  const item = r.items[s];
                  const severity = item
                    ? severityMap.get(r.playerId)?.get(item.itemId)
                    : REQUIRED_SLOTS.includes(s) ? "major" : undefined;
                  return (
                    <td key={s} className={severity ? `sev-${severity}` : undefined}>
                      {item?.name ?? ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
