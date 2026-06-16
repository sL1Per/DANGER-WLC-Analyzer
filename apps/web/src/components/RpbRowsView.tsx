import type { Role, RpbRow } from "@wcl/core";
import type { ClassGroup } from "../lib/rpbGrouping";
import { classColorVar } from "../lib/classColors";
import {
  heatClass, deathsHeat, friendlyFireHeat, uptimeHeat, activeHeat, severityHeat,
} from "../lib/heatmap";
import { PlayerRoleSelect } from "./PlayerRoleSelect";

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const neutral = heatClass("neutral");

/** Distinct class-ability columns for a group, first-seen order (same class ⇒ same keys). */
function abilityColumns(rows: RpbRow[]): { key: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const r of rows) for (const c of r.classRows) if (!seen.has(c.key)) seen.set(c.key, c.name);
  return [...seen].map(([key, name]) => ({ key, name }));
}

export function RpbRowsView({
  groups,
  onRoleChange,
}: {
  groups: ClassGroup[];
  onRoleChange: (playerName: string, role: Role) => void;
}) {
  return (
    <>
      {groups.map((g) => {
        const cols = abilityColumns(g.rows);
        return (
          <div key={g.className} className="class-group">
            <h4 className="class-band" style={classColorVar(g.className)}>
              <span className="class-dot" /> {g.className}
            </h4>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>player</th><th>role</th><th>deaths</th><th>interrupts</th>
                    <th>total dmg taken</th><th>friendly fire</th>
                    <th>absorbed</th><th>reflected</th><th>to hostile</th>
                    <th>engi dmg</th><th>oil dmg</th><th>shout uptime</th>
                    <th>active % (ST/AoE)</th><th>haste s saved</th>
                    {cols.map((c) => <th key={c.key}>{c.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => {
                    const byKey = new Map(r.classRows.map((c) => [c.key, c]));
                    return (
                      <tr key={r.playerId}>
                        <td className="player-cell" style={classColorVar(r.className)}>
                          <span className="class-dot" /> {r.playerName}
                        </td>
                        <td><PlayerRoleSelect row={r} onChange={onRoleChange} /></td>
                        <td className={heatClass(deathsHeat(r.deaths))}>{r.deaths}</td>
                        <td
                          className={neutral}
                          title={r.interruptedSpells > 0 ? `enemies whose casts were interrupted: ${r.interruptSources.join(", ")}` : "no interrupts"}
                        >
                          {r.interruptedSpells > 0 ? `${r.interruptedSpells} (${r.interruptSources.join(", ")})` : 0}
                        </td>
                        <td className={neutral} title={`all boss damage taken: ${r.totalPartlyAvoidable.toLocaleString()}`}>
                          {r.totalAvoidableDamageTaken.toLocaleString()}
                        </td>
                        <td className={heatClass(friendlyFireHeat(r.friendlyFire))}>{r.friendlyFire.toLocaleString()}</td>
                        <td className={neutral}>{r.totalAbsorbed.toLocaleString()}</td>
                        <td className={neutral} title="self/reflected damage (counts as done to self)">{r.damageReflected.toLocaleString()}</td>
                        <td className={neutral} title="damage to hostile players (PvP; counts as done to self)">{r.damageToHostilePlayers.toLocaleString()}</td>
                        <td className={neutral}>{r.engineeringDamage.toLocaleString()}</td>
                        <td className={neutral}>{r.oilOfImmolationDamage.toLocaleString()}</td>
                        {/* a 0 reading means "no Battle Shout reached this player" (e.g. non-Warrior groups) — not a problem, so stay neutral */}
                        <td className={r.battleShoutUptime > 0 ? heatClass(uptimeHeat(r.battleShoutUptime)) : neutral}>{pct(r.battleShoutUptime)}</td>
                        <td className={r.activity ? heatClass(activeHeat(r.activity.relativeActiveST)) : neutral}>
                          {r.activity ? `${pct(r.activity.relativeActiveST)} / ${pct(r.activity.relativeActiveAoe)}` : "—"}
                        </td>
                        <td className={neutral}>{r.activity ? r.activity.secondsSubtractedHaste.toFixed(1) : "—"}</td>
                        {cols.map((col) => {
                          const c = byKey.get(col.key);
                          if (!c) return <td key={col.key} className={neutral}>—</td>;
                          const text = c.measure === "cast-count" ? `${c.castCount}×` : pct(c.uptimePct ?? 0);
                          const flags = [c.rankFlag ? "mostly a lower rank than optimal" : "", !c.verified ? "spell ids not yet Wowhead-verified" : ""]
                            .filter(Boolean).join("; ");
                          return (
                            <td key={col.key} className={heatClass(severityHeat(c.severity))} title={flags || undefined}>
                              {text}{c.rankFlag && " ⚠"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
