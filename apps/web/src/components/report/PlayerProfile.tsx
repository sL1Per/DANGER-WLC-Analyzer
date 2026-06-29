import { useMemo } from "react";
import {
  rpb, consumables, rpbConsumables, gearListing, gearIssues, listGearFights, aggregateHits, SLOT_NAMES, LISTING_SLOTS,
  type ReportData, type PlayerHitStats, type HitStat,
} from "@wcl/core";
import { scopeReportToFight, ALL_FIGHTS } from "../../lib/scopeReport";
import { buildRpbConfig, consumablesConfig, gearIssueConfig, rpbConsumableSpecs } from "../../lib/analysisConfig";
import { consumablesStatus, statusHeat, verdict } from "../../lib/playerRollups";
import { heatClass, deathsHeat, uptimeHeat, relativeHeat, type Heat } from "../../lib/heatmap";
import { parseClass } from "../../lib/parseColor";
import { classColorVar, classSlug } from "../../lib/classColors";
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";

const pct = (n: number) => `${Math.round(n * 100)}%`;
/** Wowhead TBC item tooltip URL for an item id. The hardcoded https:// scheme
 *  prefix is what makes this XSS-safe: report data in shared snapshots is
 *  attacker-controlled, but a hostile itemId can only ever land in the URL's
 *  path, never become a javascript:/data: href. Keep the scheme literal — never
 *  interpolate a report-derived value into the scheme/host, and never feed
 *  report strings to dangerouslySetInnerHTML or a markdown renderer. */
export const wowheadItem = (itemId: number) => `https://www.wowhead.com/tbc/item=${itemId}`;
/** Heat → status-dot class (good/watch/bad). neutral falls back to watch. */
const heatDot = (h: Heat) => (h === "neutral" ? "watch" : h);
/** Highest-priority severity among an item's issues (major > moderate > minor). */
const SEV_RANK: Record<string, number> = { major: 3, moderate: 2, minor: 1, ok: 0 };
const worstSeverity = (issues: { severity: string }[]): string | null =>
  issues.reduce<string | null>((w, i) => ((SEV_RANK[i.severity] ?? 0) > (w ? SEV_RANK[w] ?? 0 : -1) ? i.severity : w), null);
const initials = (name: string) => name.slice(0, 2).toUpperCase();
/** Compact number for tile values: 28600 → "28.6k". */
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
/** "12 (34%)" for a hit-type cell, "—" when absent or zero. */
const fmtHit = (s: HitStat | undefined) => (s && s.count > 0 ? `${s.count} (${Math.round(s.pct * 100)}%)` : "—");

/** Per-boss hit-type columns, in display order. */
const HIT_COLS: { label: string; sel: (h: PlayerHitStats) => HitStat }[] = [
  { label: "Out: Crit", sel: (h) => h.outgoing.crit },
  { label: "Out: Dodge", sel: (h) => h.outgoing.dodge },
  { label: "Out: Miss", sel: (h) => h.outgoing.miss },
  { label: "Out: Parry", sel: (h) => h.outgoing.parry },
  { label: "Crit Heals", sel: (h) => h.critHeals },
  { label: "In: Blocked", sel: (h) => h.incomingMelee.blocked },
  { label: "In: Dodge", sel: (h) => h.incomingMelee.dodge },
  { label: "In: Miss", sel: (h) => h.incomingMelee.miss },
  { label: "In: Parry", sel: (h) => h.incomingMelee.parry },
];

export function PlayerProfile({ report, playerId }: { report: ReportData; playerId: number }) {
  const isPhone = useIsPhone();
  const player = report.players.find((p) => p.id === playerId);
  const cfg = useMemo(() => buildRpbConfig(), []);
  // all-night profile numbers are boss-only by spec; rpb now honors report.fights
  // (it no longer self-filters to bosses), so scope to the boss set explicitly.
  const bossScoped = useMemo(() => scopeReportToFight(report, ALL_FIGHTS), [report]);
  const result = useMemo(() => rpb(bossScoped, cfg), [bossScoped, cfg]);
  const consRow = useMemo(
    () => consumables(report, consumablesConfig)?.rows.find((c) => c.playerId === playerId),
    [report, playerId],
  );
  const bossFights = useMemo(() => report.fights.filter((f) => f.isBoss), [report]);

  // Combat-consumable use counts (haste/destruction potions, drums, runes, …) for
  // this player on boss fights — same data as the report-wide consumable matrix,
  // scoped to one player. Listed by use count, highest first; zero-use rows hidden.
  // The dot reuses the matrix's relative heat: green = top user in the raid for that
  // consumable, red = laggard among the users (so it stays meaningful per-consumable).
  const combatCons = useMemo(() => {
    const res = rpbConsumables(bossScoped, rpbConsumableSpecs);
    const row = res?.rows.find((r) => r.playerId === playerId);
    if (!row) return [];
    const rows = res!.rows;
    return rpbConsumableSpecs
      .map((s) => {
        const count = row.counts[s.key] ?? 0;
        const uptime = s.buffUptime ? row.uptimes[s.key] : undefined;
        const vals = rows.map((r) => (s.buffUptime ? r.uptimes[s.key] ?? 0 : r.counts[s.key] ?? 0));
        const heat = relativeHeat(uptime ?? count, Math.min(...vals), Math.max(...vals));
        return { name: s.name, count, uptime, heat };
      })
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [bossScoped, playerId]);

  // per-boss numbers: scoped rpb per fight, read this player's row
  const perBoss = useMemo(() => bossFights.map((f) => {
    const out = rpb(scopeReportToFight(report, f.id), cfg);
    const row = out?.rows.find((r) => r.playerId === playerId);
    return { fight: f, row };
  }), [report, cfg, playerId, bossFights]);

  // per-boss WCL parse: rank percentile + DPS/HPS value, keyed by fightID, matched by name
  const rankByFight = useMemo(() => {
    const m = new Map<number, { rankPercent: number; parse: number }>();
    for (const r of report.rankings ?? []) {
      const ch = [...r.tanks, ...r.healers, ...r.dps].find((c) => c.name === player?.name);
      if (ch) m.set(r.fightID, { rankPercent: ch.rankPercent, parse: ch.parse });
    }
    return m;
  }, [report.rankings, player?.name]);

  // per-boss hit-type stats: aggregate this player's raw per-fight counts one fight at a time
  const hitsByFight = useMemo(() => {
    const m = new Map<number, PlayerHitStats>();
    for (const h of report.hitStatsByFight ?? []) {
      if (h.playerId === playerId) m.set(h.fightId, aggregateHits([h]));
    }
    return m;
  }, [report.hitStatsByFight, playerId]);

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
  const bossCount = bossFights.length;
  const consAvg = consRow ? consRow.totalAverage : null;
  const noInterrupts = row.role === "tank" || row.role === "healer";
  const perfLabel = row.role === "healer" ? "HPS" : "DPS";

  return (
    <div className="profile">
      <header className="profile-head">
        <span className={`profile-avatar cc-${classSlug(player.class)}`} style={classColorVar(player.class)} aria-hidden>{initials(player.name)}</span>
        <div className="profile-id">
          <h2 style={classColorVar(player.class)}>{player.name}</h2>
          <span className="profile-sub">{player.class} · {row.role}</span>
        </div>
        <div className="profile-verdict">
          <span className={`profile-badge ${heatClass(v.heat)}`}>{v.label}</span>
          <span className="profile-note">{v.note}</span>
        </div>
      </header>

      <div className="profile-tiles">
        <Tile label="Deaths" value={String(row.deaths)} sub={`across ${bossCount} pull${bossCount === 1 ? "" : "s"}`} heat={deathsHeat(row.deaths)} />
        <Tile label="Avoidable dmg" value={compact(row.totalAvoidableDamageTaken)} sub="stood in stuff" />
        <Tile label="Avg uptime" value={avgUptime === null ? "—" : pct(avgUptime)} sub="active time" heat={avgUptime === null ? undefined : uptimeHeat(avgUptime)} />
        <Tile label="Interrupts" value={String(row.interruptedSpells)} sub={noInterrupts ? "n/a for role" : "casts stopped"} />
        <Tile label="Consumables" value={consAvg === null ? "—" : pct(consAvg)} sub="flask/food/oil" heat={statusHeat(status)} />
        <Tile label="Gear flags" value={String(flagCount)} sub="enchants/gems" heat={flagCount > 0 ? "bad" : "good"} />
      </div>

      <section className="card">
        <h3>Per-boss breakdown</h3>
        {isPhone ? (
          <StatCards>
            {perBoss.map(({ fight, row: br }) => {
              const rk = rankByFight.get(fight.id);
              const hs = hitsByFight.get(fight.id);
              return (
                <StatCard
                  key={fight.id}
                  title={fight.name}
                  rows={[
                    { label: "Ranking", value: rk ? rk.rankPercent : "—", className: rk ? parseClass(rk.rankPercent) : "sev-neutral" },
                    { label: "Performance", value: rk ? `${compact(rk.parse)} ${perfLabel}` : "—" },
                    { label: "Deaths", value: br?.deaths ?? 0, className: heatClass(deathsHeat(br?.deaths ?? 0)) },
                    ...HIT_COLS.map((c) => ({ label: c.label, value: hs ? fmtHit(c.sel(hs)) : "—" })),
                  ]}
                />
              );
            })}
          </StatCards>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Boss</th><th>Ranking</th><th>Performance</th><th>Deaths</th>
                  {HIT_COLS.map((c) => <th key={c.label}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {perBoss.map(({ fight, row: br }) => {
                  const rk = rankByFight.get(fight.id);
                  const hs = hitsByFight.get(fight.id);
                  return (
                    <tr key={fight.id}>
                      <td>{fight.name}</td>
                      <td className={rk ? `mono ${parseClass(rk.rankPercent)}` : "sev-neutral"}>{rk ? rk.rankPercent : "—"}</td>
                      <td className="mono">{rk ? `${compact(rk.parse)} ${perfLabel}` : "—"}</td>
                      <td className={heatClass(deathsHeat(br?.deaths ?? 0))}>{br?.deaths ?? 0}</td>
                      {HIT_COLS.map((c) => <td key={c.label} className="mono">{hs ? fmtHit(c.sel(hs)) : "—"}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="profile-body">
        <div className="profile-col">
          <section className="card">
            <h3>Gear &amp; enchants</h3>
            <p className="intro">{flagCount === 0 ? "No gear flags — all clean." : `${flagCount} item(s) flagged.`}</p>
            <ul className="profile-list profile-gear">
              {(() => {
                const playerGear = gear?.rows.find((r) => r.playerId === playerId);
                if (!playerGear) return <li>No gear snapshot recorded.</li>;
                // Render every equipped slot (gear-listing order) so a flag on any
                // slot — bracers, feet, rings, trinkets… — is visible, not just the
                // few curated slots. Empty slots are skipped.
                return LISTING_SLOTS.filter((s) => playerGear.items[s]).map((s) => {
                  const item = playerGear.items[s]!;
                  const itemIssues = gearFlagList.filter((i) => i.itemId === item.itemId);
                  const worst = worstSeverity(itemIssues);
                  return (
                    <li key={s} className={worst ? `sev-${worst}` : ""}>
                      <span className="slot-label">{SLOT_NAMES[s]}</span>
                      <a className="gear-item" href={wowheadItem(item.itemId)} target="_blank" rel="noreferrer">{item.name}</a>
                      <span className="gear-issue">{itemIssues.map((i) => i.issue).join(", ")}</span>
                    </li>
                  );
                });
              })()}
            </ul>
          </section>
        </div>

        <div className="profile-col">
          <section className="card">
            <h3>Consumables &amp; buffs</h3>
            <ul className="profile-list">
              <ConsLine label="Elixir / Flask" value={consRow?.elixirOrFlask ?? 0} />
              <ConsLine label="Food" value={consRow?.food ?? 0} />
              {consRow?.weaponEnhancement !== null && <ConsLine label="Weapon enhancement" value={consRow?.weaponEnhancement ?? 0} />}
              {consRow?.scrolls ? <li><span className="dot good" /> Scrolls <span className="mono">{consRow.scrolls}</span></li> : null}
              {combatCons.map((c) => (
                <li key={c.name}>
                  <span className={`dot ${heatDot(c.heat)}`} /> {c.name}{" "}
                  <span className="mono">
                    {c.count}
                    {c.uptime !== undefined ? ` (${pct(c.uptime)})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, heat }: { label: string; value: string; sub?: string; heat?: Heat }) {
  return (
    <div className={`profile-tile${heat ? ` tile-${heat}` : ""}`}>
      <span className="profile-tile__value mono">{value}</span>
      <span className="profile-tile__label">{label}</span>
      {sub && <span className="profile-tile__sub">{sub}</span>}
    </div>
  );
}

function ConsLine({ label, value }: { label: string; value: number }) {
  const cls = value >= 0.9 ? "good" : value >= 0.5 ? "watch" : "bad";
  return <li><span className={`dot ${cls}`} /> {label} <span className="mono">{pct(value)}</span></li>;
}
