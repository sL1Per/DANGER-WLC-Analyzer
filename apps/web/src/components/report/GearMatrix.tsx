import { useMemo } from "react";
import {
  gearIssues, gearListing, SLOT_NAMES, SEVERITY_RANK, type IssueSeverity, type ReportData,
} from "@wcl/core";
import { gearIssueConfig } from "../../lib/analysisConfig";
import { classColorVar } from "../../lib/classColors";

const PROFILE_GEAR_SLOTS = [0, 1, 2, 14, 4, 9, 6, 15]; // Head Neck Shoulders Cloak Chest Hands Legs Weapon

export function GearMatrix({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
  const { fight, rows } = useMemo(() => gearListing(report, fightId), [report, fightId]);

  const issues = useMemo(() => {
    const map = new Map<number, Map<number, { severity: IssueSeverity; reason: string }>>();
    if (!fight) return map;
    const sub = { ...report, gear: report.gear.filter((g) => g.fightId === fight.id) };
    for (const r of gearIssues(sub, gearIssueConfig)) {
      const byItem = new Map<number, { severity: IssueSeverity; reason: string }>();
      for (const i of r.issues) {
        if (i.itemId === 0) continue;
        const prev = byItem.get(i.itemId);
        if (!prev || SEVERITY_RANK[i.severity] > SEVERITY_RANK[prev.severity]) byItem.set(i.itemId, { severity: i.severity, reason: i.issue });
      }
      map.set(r.playerId, byItem);
    }
    return map;
  }, [report, fight]);

  const classOf = new Map(report.players.map((p) => [p.id, p.class]));

  if (!fight) return <p className="notice">No gear data for this pull (combatantInfo missing).</p>;

  return (
    <div className="scroll-x">
      <table className="gear-matrix">
        <thead>
          <tr><th>Player</th>{PROFILE_GEAR_SLOTS.map((s) => <th key={s}>{SLOT_NAMES[s]}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId}>
              <td className="player-cell" style={classColorVar(classOf.get(r.playerId) ?? "")}>
                <span className="class-dot" />
                <button className="player-link" onClick={() => onPlayer(r.playerName)}>{r.playerName}</button>
              </td>
              {PROFILE_GEAR_SLOTS.map((s) => {
                const item = r.items[s];
                const flag = item ? issues.get(r.playerId)?.get(item.itemId) : undefined;
                return (
                  <td key={s} className={flag ? `sev-${flag.severity}` : undefined} title={flag?.reason}>
                    {item?.name ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
