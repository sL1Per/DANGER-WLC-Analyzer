import { useEffect, useMemo, useState } from "react";
import {
  gearIssues, gearListing, SLOT_NAMES, SEVERITY_RANK, type GearIssue, type IssueSeverity, type ReportData,
} from "@wcl/core";
import { gearIssueConfig } from "../../lib/analysisConfig";
import { ALL_FIGHTS } from "../../lib/scopeReport";
import { classColorVar, CLASS_ORDER } from "../../lib/classColors";

const PROFILE_GEAR_SLOTS = [0, 1, 2, 14, 4, 9, 6, 15]; // Head Neck Shoulders Cloak Chest Hands Legs Weapon

const SEVERITY_LABEL: Record<IssueSeverity, string> = { major: "Major", moderate: "Moderate", minor: "Minor" };

type Selection = { player: string; slot: string; item: string; issues: GearIssue[] };

export function GearMatrix({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
  // Gear is a per-pull snapshot, so ALL falls back to the latest pull with gear.
  const isAll = fightId === ALL_FIGHTS;
  const { fight, rows } = useMemo(
    () => gearListing(report, isAll ? undefined : fightId),
    [report, fightId, isAll],
  );

  const issues = useMemo(() => {
    const map = new Map<number, Map<number, GearIssue[]>>();
    if (!fight) return map;
    const sub = { ...report, gear: report.gear.filter((g) => g.fightId === fight.id) };
    for (const r of gearIssues(sub, gearIssueConfig)) {
      const byItem = new Map<number, GearIssue[]>();
      for (const i of r.issues) {
        if (i.itemId === 0) continue;
        const list = byItem.get(i.itemId);
        if (list) list.push(i);
        else byItem.set(i.itemId, [i]);
      }
      map.set(r.playerId, byItem);
    }
    return map;
  }, [report, fight]);

  const classOf = new Map(report.players.map((p) => [p.id, p.class]));

  // Order players by canonical class, then by name within a class.
  const classRank = (id: number) => {
    const idx = (CLASS_ORDER as readonly string[]).indexOf(classOf.get(id) ?? "");
    return idx === -1 ? CLASS_ORDER.length : idx;
  };
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) =>
      classRank(a.playerId) - classRank(b.playerId) || a.playerName.localeCompare(b.playerName),
    ),
    [rows, report.players],
  );

  const [selected, setSelected] = useState<Selection | null>(null);

  if (!fight) return <p className="notice">No gear data for this pull (combatantInfo missing).</p>;

  return (
    <>
      {isAll && <p className="notice">Gear is a snapshot per pull — showing {fight.name}.</p>}
      <div className="scroll-x">
      <table className="gear-matrix">
        <thead>
          <tr><th>Player</th>{PROFILE_GEAR_SLOTS.map((s) => <th key={s}>{SLOT_NAMES[s]}</th>)}</tr>
        </thead>
        <tbody>
          {sortedRows.map((r) => (
            <tr key={r.playerId}>
              <td className="player-cell" style={classColorVar(classOf.get(r.playerId) ?? "")}>
                <button className="player-link" onClick={() => onPlayer(r.playerName)}>{r.playerName}</button>
              </td>
              {PROFILE_GEAR_SLOTS.map((s) => {
                const item = r.items[s];
                const itemIssues = item ? issues.get(r.playerId)?.get(item.itemId) : undefined;
                const worst = itemIssues?.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
                if (!worst || !item) {
                  return <td key={s}>{item?.name ?? ""}</td>;
                }
                return (
                  <td key={s} className={`sev-${worst.severity}`}>
                    <button
                      className="gear-issue-cell"
                      title="Click for issue details"
                      onClick={() => setSelected({ player: r.playerName, slot: SLOT_NAMES[s], item: item.name, issues: itemIssues! })}
                    >
                      {item.name}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {selected && <GearIssueModal selection={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function GearIssueModal({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sorted = [...selection.issues].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Gear issue details" onClick={(e) => e.stopPropagation()}>
        <header className="modal-card__head">
          <div>
            <h3>{selection.item}</h3>
            <p className="modal-card__sub">{selection.player} · {selection.slot}</p>
          </div>
          <button className="modal-card__close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <ul className="modal-issue-list">
          {sorted.map((i, idx) => (
            <li key={idx} className={`sev-${i.severity}`}>
              <span className="modal-issue-badge">{SEVERITY_LABEL[i.severity]}</span>
              {i.issue}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
