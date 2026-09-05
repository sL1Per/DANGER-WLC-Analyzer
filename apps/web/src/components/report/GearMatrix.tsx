import { useEffect, useMemo, useState } from "react";
import {
  gearIssues, gearListing, SLOT_NAMES, SEVERITY_RANK, type GearIssue, type IssueSeverity, type ReportData,
} from "@wcl/core";
import { gearIssueConfig } from "../../lib/analysisConfig";
import { ALL_FIGHTS } from "../../lib/scopeReport";
import { classColorVar, CLASS_ORDER } from "../../lib/classColors";
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";

// Head Neck Shoulders Cloak Chest Bracers Hands Waist Legs Ring1 Ring2 Trinket1 Trinket2 Weapon Off-Hand
const PROFILE_GEAR_SLOTS = [0, 1, 2, 14, 4, 8, 9, 5, 6, 10, 11, 12, 13, 15, 16];

const SEVERITY_LABEL: Record<IssueSeverity, string> = { major: "Major", moderate: "Moderate", minor: "Minor" };

type Selection = { player: string; slot: string; item: string; issues: GearIssue[] };

export function GearMatrix({ report, fightId }: { report: ReportData; fightId: number }) {
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

  const isPhone = useIsPhone();

  if (!fight) return <p className="notice">No gear data for this pull (combatantInfo missing).</p>;

  if (isPhone) {
    return (
      <>
        {isAll && <p className="notice">Gear is a snapshot per pull — showing {fight.name}.</p>}
        <StatCards>
          {sortedRows.map((r) => {
            const flaggedRows = PROFILE_GEAR_SLOTS.flatMap((s) => {
              const item = r.items[s];
              const itemIssues = item ? issues.get(r.playerId)?.get(item.itemId) : undefined;
              const worst = itemIssues?.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
              if (!worst || !item) return [];
              return [{ label: SLOT_NAMES[s], value: item.name, className: `sev-${worst.severity}` }];
            });
            return (
              <StatCard
                key={r.playerId}
                title={r.playerName}
                titleStyle={classColorVar(classOf.get(r.playerId) ?? "")}
                rows={flaggedRows.length > 0 ? flaggedRows : [{ label: "Gear", value: "No issues" }]}
              />
            );
          })}
        </StatCards>
      </>
    );
  }

  return (
    <>
      {isAll && <p className="notice">Gear is a snapshot per pull — showing {fight.name}.</p>}
      <div className="player-matrix-card scroll-x">
      <table className="player-matrix">
        <thead>
          <tr>
            <th className="matrix-corner" scope="col">Slot</th>
            {sortedRows.map((r) => (
              <th key={r.playerId} className="player-col" style={classColorVar(classOf.get(r.playerId) ?? "")} scope="col">
                <span className="player-col__name">{r.playerName}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PROFILE_GEAR_SLOTS.map((s) => (
            <tr key={s}>
              <th scope="row" className="matrix-row-label">{SLOT_NAMES[s]}</th>
              {sortedRows.map((r) => {
                const item = r.items[s];
                const itemIssues = item ? issues.get(r.playerId)?.get(item.itemId) : undefined;
                const worst = itemIssues?.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
                if (!item) {
                  return <td key={r.playerId} />;
                }
                if (!worst) {
                  return <td key={r.playerId}><span className="sr-only">{item.name}</span></td>;
                }
                return (
                  <td key={r.playerId} className={`sev-${worst.severity}`}>
                    <button
                      className="cell-btn"
                      title="Click for issue details"
                      onClick={() => setSelected({ player: r.playerName, slot: SLOT_NAMES[s], item: item.name, issues: itemIssues! })}
                    >
                      <span className="sr-only">{item.name}</span>
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
