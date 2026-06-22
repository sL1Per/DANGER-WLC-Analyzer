import { useMemo } from "react";
import {
  rpb, consumables, gearListing, gearIssues, listGearFights, SLOT_NAMES,
  type ReportData,
} from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { buildRpbConfig, consumablesConfig, gearIssueConfig } from "../../lib/analysisConfig";
import { consumablesStatus, statusHeat, verdict } from "../../lib/playerRollups";
import { heatClass, deathsHeat, uptimeHeat, type Heat } from "../../lib/heatmap";
import { classColorVar, classSlug } from "../../lib/classColors";

const PROFILE_GEAR_SLOTS = [0, 1, 2, 14, 4, 9, 6, 15];
const pct = (n: number) => `${Math.round(n * 100)}%`;
const initials = (name: string) => name.slice(0, 2).toUpperCase();

export function PlayerProfile({ report, playerId }: { report: ReportData; playerId: number }) {
  const player = report.players.find((p) => p.id === playerId);
  const cfg = useMemo(() => buildRpbConfig(), []);
  const result = useMemo(() => rpb(report, cfg), [report, cfg]);
  const consRow = useMemo(
    () => consumables(report, consumablesConfig)?.rows.find((c) => c.playerId === playerId),
    [report, playerId],
  );
  const bossFights = useMemo(() => report.fights.filter((f) => f.isBoss), [report]);

  // per-boss numbers: scoped rpb per fight, read this player's row
  const perBoss = useMemo(() => bossFights.map((f) => {
    const out = rpb(scopeReportToFight(report, f.id), cfg);
    const row = out?.rows.find((r) => r.playerId === playerId);
    return { fight: f, row };
  }), [report, cfg, playerId, bossFights]);

  const gearFightId = useMemo(() => {
    const fights = listGearFights(report);
    return fights[fights.length - 1]?.id;
  }, [report]);
  const gear = useMemo(() => gearFightId === undefined ? null : gearListing(report, gearFightId), [report, gearFightId]);
  const gearFlagList = useMemo(() => {
    if (gearFightId === undefined) return [];
    const sub = { ...report, gear: report.gear.filter((g) => g.fightId === gearFightId) };
    return gearIssues(sub, gearIssueConfig).find((r) => r.playerId === playerId)?.issues.filter((i) => i.itemId !== 0) ?? [];
  }, [report, gearFightId, playerId]);

  if (!player) return <p className="notice">Unknown player.</p>;
  if (result === null) return <p className="notice">This report was cached before RPB support — Refresh from WCL (requires credentials).</p>;

  const row = result.rows.find((r) => r.playerId === playerId);
  if (!row) return <p className="notice">No boss-fight data for {player.name}.</p>;

  const flagCount = gearFlagList.length;
  const v = verdict(row, flagCount);
  const status = consumablesStatus(consRow);
  const avgUptime = row.activity?.relativeActiveST ?? null;

  return (
    <div className="profile">
      <header className="profile-head">
        <span className={`profile-avatar cc-${classSlug(player.class)}`} style={classColorVar(player.class)} aria-hidden>{initials(player.name)}</span>
        <div className="profile-id">
          <h2 style={classColorVar(player.class)}>{player.name}</h2>
          <span className="profile-sub">{player.class} · {row.role}</span>
        </div>
        <div className="profile-verdict">
          <span className={`pill ${heatClass(v.heat)}`}>{v.label}</span>
          <span className="profile-note">{v.note}</span>
        </div>
      </header>

      <div className="profile-tiles">
        <Tile label="Deaths" value={String(row.deaths)} heat={deathsHeat(row.deaths)} />
        <Tile label="Avoidable dmg" value={row.totalAvoidableDamageTaken.toLocaleString()} />
        <Tile label="Avg uptime" value={avgUptime === null ? "—" : pct(avgUptime)} heat={avgUptime === null ? undefined : uptimeHeat(avgUptime)} />
        <Tile label="Interrupts" value={String(row.interruptedSpells)} />
        <Tile label="Consumables" value={status[0].toUpperCase() + status.slice(1)} heat={statusHeat(status)} />
        <Tile label="Gear flags" value={String(flagCount)} heat={flagCount > 0 ? "bad" : "good"} />
      </div>

      <div className="profile-body">
        <div className="profile-col">
          <section className="card">
            <h3>Per-boss breakdown</h3>
            <div className="scroll-x">
              <table>
                <thead><tr><th>Boss</th><th>Deaths</th><th>Avoidable</th><th>Uptime</th></tr></thead>
                <tbody>
                  {perBoss.map(({ fight, row: br }) => (
                    <tr key={fight.id}>
                      <td>{fight.name}</td>
                      <td className={heatClass(deathsHeat(br?.deaths ?? 0))}>{br?.deaths ?? 0}</td>
                      <td className="mono">{(br?.totalAvoidableDamageTaken ?? 0).toLocaleString()}</td>
                      <td className="mono">{br?.activity ? pct(br.activity.relativeActiveST) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h3>Consumables &amp; buffs</h3>
            <ul className="profile-list">
              <ConsLine label="Elixir / Flask" value={consRow?.elixirOrFlask ?? 0} />
              <ConsLine label="Food" value={consRow?.food ?? 0} />
              {consRow?.weaponEnhancement !== null && <ConsLine label="Weapon enhancement" value={consRow?.weaponEnhancement ?? 0} />}
              {consRow?.scrolls ? <li><span className="dot good" /> Scrolls <span className="mono">{consRow.scrolls}</span></li> : null}
            </ul>
          </section>
        </div>

        <div className="profile-col">
          <section className="card">
            <h3>Gear &amp; enchants</h3>
            <p className="intro">{flagCount === 0 ? "No gear flags — all clean." : `${flagCount} item(s) flagged.`}</p>
            <ul className="profile-list">
              {gear?.rows.find((r) => r.playerId === playerId)
                ? PROFILE_GEAR_SLOTS.map((s) => {
                    const item = gear.rows.find((r) => r.playerId === playerId)!.items[s];
                    const issue = gearFlagList.find((i) => item && i.itemId === item.itemId);
                    return (
                      <li key={s}>
                        <span className="slot-label">{SLOT_NAMES[s]}</span>
                        <span>{item?.name ?? "—"}</span>
                        {issue && <span className={`pill sev-${issue.severity}`}>{issue.issue}</span>}
                      </li>
                    );
                  })
                : <li>No gear snapshot recorded.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, heat }: { label: string; value: string; heat?: Heat }) {
  return (
    <div className={`profile-tile${heat ? ` tile-${heat}` : ""}`}>
      <span className="profile-tile__value mono">{value}</span>
      <span className="profile-tile__label">{label}</span>
    </div>
  );
}

function ConsLine({ label, value }: { label: string; value: number }) {
  const cls = value >= 0.9 ? "good" : value >= 0.5 ? "watch" : "bad";
  return <li><span className={`dot ${cls}`} /> {label} <span className="mono">{pct(value)}</span></li>;
}
