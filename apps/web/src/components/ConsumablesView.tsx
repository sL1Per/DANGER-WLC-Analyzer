import { useEffect, useMemo, useState, type ReactNode } from "react";
import { consumables, uptimeSeverity, type ReportData } from "@wcl/core";
import { CLASS_ORDER, classColorVar } from "../lib/classColors";
import { consumablesConfig } from "../lib/analysisConfig";
import { useIsPhone } from "../lib/useMediaQuery";
import { StatCard, StatCards } from "./report/StatCard";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** "93% (Agi,Str)" -> "93%" — the type breakdown is now only in the click-through modal. */
function scrollPct(scrolls: string): string {
  return scrolls.replace(/\s*\(.*\)$/, "");
}

const classRank = (c: string): number => {
  const i = (CLASS_ORDER as readonly string[]).indexOf(c);
  return i === -1 ? CLASS_ORDER.length : i;
};

type Selection = { label: string; player: string; names: string[] };

function UptimeCell({ value }: { value: number }) {
  return <td className={`sev-${uptimeSeverity(value)}`}>{pct(value)}</td>;
}

/** A value cell that, when the player actually had named consumable(s) for this
 *  row, becomes clickable and opens a modal listing them (mirrors the Gear tab's
 *  per-cell issue detail). With no names, it's a plain, non-interactive cell. */
function DetailCell({
  value, className, names, label, player, onSelect,
}: {
  value: ReactNode; className?: string; names: string[]; label: string; player: string;
  onSelect: (sel: Selection) => void;
}) {
  if (names.length === 0) return <td className={className}>{value}</td>;
  return (
    <td className={className}>
      <button className="cell-btn" title="Click for details" onClick={() => onSelect({ label, player, names })}>
        {value}
      </button>
    </td>
  );
}

function ConsumableDetailModal({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Consumable details" onClick={(e) => e.stopPropagation()}>
        <header className="modal-card__head">
          <div>
            <h3>{selection.label}</h3>
            <p className="modal-card__sub">{selection.player}</p>
          </div>
          <button className="modal-card__close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <ul className="modal-issue-list">
          {selection.names.map((name, idx) => <li key={idx}>{name}</li>)}
        </ul>
      </div>
    </div>
  );
}

export function ConsumablesView({ report }: { report: ReportData }) {
  const isPhone = useIsPhone();
  const result = useMemo(() => consumables(report, consumablesConfig), [report]);
  const classOf = useMemo(() => new Map(report.players.map((p) => [p.id, p.class])), [report.players]);
  const rows = useMemo(() => {
    if (result === null) return [];
    return [...result.rows].sort((a, b) => {
      const d = classRank(classOf.get(a.playerId) ?? "") - classRank(classOf.get(b.playerId) ?? "");
      return d !== 0 ? d : a.playerName.localeCompare(b.playerName);
    });
  }, [result, classOf]);

  const [selected, setSelected] = useState<Selection | null>(null);

  if (result === null) {
    return <p>This report was cached before consumable support — refresh it from WCL (requires credentials).</p>;
  }
  if (rows.length === 0) {
    return <p>No boss fights in this report.</p>;
  }
  if (isPhone) {
    const sev = (v: number) => `sev-${uptimeSeverity(v)}`;
    return (
      <div>
        <p><small>Only boss fights evaluated. Some T6 fights miss combatantInfo — stand close to the boss at pull.</small></p>
        <StatCards>
          {rows.map((r) => (
            <StatCard
              key={r.playerId}
              title={r.playerName}
              titleStyle={classColorVar(classOf.get(r.playerId) ?? "")}
              rows={[
                { label: "Total avg (excl. Scrolls)", value: pct(r.totalAverage), className: sev(r.totalAverage) },
                { label: "Elixir or Flask", value: pct(r.elixirOrFlask), className: sev(r.elixirOrFlask) },
                { label: "Battle Elixir", value: `${pct(r.battleElixir)}${r.battleElixirNames.length ? ` — ${r.battleElixirNames.join(", ")}` : ""}` },
                { label: "Guardian Elixir", value: `${pct(r.guardianElixir)}${r.guardianElixirNames.length ? ` — ${r.guardianElixirNames.join(", ")}` : ""}` },
                { label: "Flask", value: `${pct(r.flask)}${r.flaskNames.length ? ` — ${r.flaskNames.join(", ")}` : ""}` },
                { label: "Food Buff", value: pct(r.food), className: sev(r.food) },
                { label: "Scrolls", value: r.scrolls || "—" },
                { label: "Weapon Enhancement", value: r.weaponEnhancement === null ? "—" : pct(r.weaponEnhancement), className: r.weaponEnhancement === null ? undefined : sev(r.weaponEnhancement) },
                { label: "JC neck", value: r.jcNeck.equipped ? `${r.jcNeck.usedOnFights}${r.jcNeck.inactiveOnFights > 0 ? ` — inactive on ${r.jcNeck.inactiveOnFights}` : ""}` : "—", className: r.jcNeck.inactiveOnFights > 0 ? "sev-moderate" : undefined },
              ]}
            />
          ))}
        </StatCards>
      </div>
    );
  }
  return (
    <div>
      <p><small>Only boss fights evaluated. Some T6 fights miss the combatantInfo with consumables info — loggers should stand close to the boss at the pull.</small></p>
      <div className="player-matrix-card scroll-x">
        <table className="player-matrix">
          <thead>
            <tr>
              <th className="matrix-corner" scope="col">Consumable</th>
              {rows.map((r) => (
                <th key={r.playerId} className="player-col" style={classColorVar(classOf.get(r.playerId) ?? "")} scope="col">
                  <span className="player-col__name">{r.playerName}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="matrix-row-label">total average (excl. Scrolls)</th>
              {rows.map((r) => <UptimeCell key={r.playerId} value={r.totalAverage} />)}
            </tr>
            <tr>
              <th scope="row" className="matrix-row-label">Elixir or Flask</th>
              {rows.map((r) => <UptimeCell key={r.playerId} value={r.elixirOrFlask} />)}
            </tr>
            <tr>
              <th scope="row" className="matrix-row-label">Battle Elixir</th>
              {rows.map((r) => (
                <DetailCell
                  key={r.playerId} value={pct(r.battleElixir)} names={r.battleElixirNames}
                  label="Battle Elixir" player={r.playerName} onSelect={setSelected}
                />
              ))}
            </tr>
            <tr>
              <th scope="row" className="matrix-row-label">Guardian Elixir</th>
              {rows.map((r) => (
                <DetailCell
                  key={r.playerId} value={pct(r.guardianElixir)} names={r.guardianElixirNames}
                  label="Guardian Elixir" player={r.playerName} onSelect={setSelected}
                />
              ))}
            </tr>
            <tr>
              <th scope="row" className="matrix-row-label">Flask</th>
              {rows.map((r) => (
                <DetailCell
                  key={r.playerId} value={pct(r.flask)} names={r.flaskNames}
                  label="Flask" player={r.playerName} onSelect={setSelected}
                />
              ))}
            </tr>
            <tr>
              <th scope="row" className="matrix-row-label">Food Buff</th>
              {rows.map((r) => (
                <DetailCell
                  key={r.playerId} value={pct(r.food)} className={`sev-${uptimeSeverity(r.food)}`} names={r.foodNames}
                  label="Food Buff" player={r.playerName} onSelect={setSelected}
                />
              ))}
            </tr>
            <tr>
              <th scope="row" className="matrix-row-label">Scrolls</th>
              {rows.map((r) => (
                <DetailCell
                  key={r.playerId} value={scrollPct(r.scrolls)} names={r.scrollNames}
                  label="Scrolls" player={r.playerName} onSelect={setSelected}
                />
              ))}
            </tr>
            <tr>
              <th scope="row" className="matrix-row-label">Weapon Enhancement</th>
              {rows.map((r) => (
                r.weaponEnhancement === null
                  ? <td key={r.playerId}>-</td>
                  : <UptimeCell key={r.playerId} value={r.weaponEnhancement} />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {selected && <ConsumableDetailModal selection={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
