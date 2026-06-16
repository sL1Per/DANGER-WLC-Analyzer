import type { Role, RpbRow } from "@wcl/core";
import type { ClassGroup } from "../lib/rpbGrouping";
import { classColorVar } from "../lib/classColors";
import { heatClass, severityHeat } from "../lib/heatmap";
import { PlayerRoleSelect } from "./PlayerRoleSelect";

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

/** Worst issues to surface as colored chips at the top of a card. */
function worstChips(r: RpbRow): { label: string; cls: string }[] {
  const chips: { label: string; cls: string }[] = [];
  if (r.deaths > 0) chips.push({ label: `${r.deaths} death${r.deaths > 1 ? "s" : ""}`, cls: "sev-major" });
  if (r.friendlyFire > 0) chips.push({ label: `friendly fire ${r.friendlyFire.toLocaleString()}`, cls: "sev-moderate" });
  for (const c of r.classRows) {
    if (c.severity === "major" || c.severity === "moderate") {
      const v = c.measure === "cast-count" ? `${c.castCount}×` : pct(c.uptimePct ?? 0);
      chips.push({ label: `${c.name} ${v}`, cls: `sev-${c.severity}` });
    }
  }
  return chips;
}

export function RpbCardsView({
  groups,
  onRoleChange,
}: {
  groups: ClassGroup[];
  onRoleChange: (playerName: string, role: Role) => void;
}) {
  const rows = groups.flatMap((g) => g.rows);
  return (
    <div className="cardgrid">
      {rows.map((r) => {
        const chips = worstChips(r);
        return (
          <div key={r.playerId} className="pcard" style={classColorVar(r.className)}>
            <header className="pcard-head">
              <span className="class-dot" />
              <span className="pcard-name">{r.playerName}</span>
              <span className="pcard-class">{r.className}</span>
              <PlayerRoleSelect row={r} onChange={onRoleChange} />
            </header>
            {chips.length > 0 && (
              <ul className="pcard-chips">
                {chips.map((c, i) => (
                  <li key={i} className={`chip ${c.cls}`}>{c.label}</li>
                ))}
              </ul>
            )}
            <dl className="pcard-metrics">
              <div><dt>deaths</dt><dd>{r.deaths}</dd></div>
              <div><dt>total dmg taken</dt><dd>{r.totalAvoidableDamageTaken.toLocaleString()}</dd></div>
              <div><dt>shout uptime</dt><dd>{pct(r.battleShoutUptime)}</dd></div>
              <div><dt>active ST/AoE</dt><dd>{r.activity ? `${pct(r.activity.relativeActiveST)} / ${pct(r.activity.relativeActiveAoe)}` : "—"}</dd></div>
              {r.totalAbsorbed > 0 && <div><dt>absorbed</dt><dd>{r.totalAbsorbed.toLocaleString()}</dd></div>}
              {r.engineeringDamage > 0 && <div><dt>engi dmg</dt><dd>{r.engineeringDamage.toLocaleString()}</dd></div>}
            </dl>
            {r.classRows.length > 0 && (
              <ul className="pcard-abilities">
                {r.classRows.map((c) => (
                  <li
                    key={c.key}
                    className={heatClass(severityHeat(c.severity))}
                    title={!c.verified ? "spell ids not yet Wowhead-verified" : undefined}
                  >
                    {c.name}: {c.measure === "cast-count" ? `${c.castCount}×` : `${pct(c.uptimePct ?? 0)} uptime`}
                    {c.rankFlag && " ⚠"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
