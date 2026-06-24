import { useMemo } from "react";
import { rpb, consumables, gearIssues, type ReportData } from "@wcl/core";
import { scopeReportToFight, ALL_FIGHTS, ALL_TRASH } from "../../lib/scopeReport";
import { buildRpbConfig, consumablesConfig, gearIssueConfig } from "../../lib/analysisConfig";
import { consumablesStatus } from "../../lib/playerRollups";
import { heatClass, deathsHeat, type Heat } from "../../lib/heatmap";

/** Format a fight duration in milliseconds as m:ss. */
function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Per-pull overview shown above every category tab: who was here and how the
 *  pull went at a glance (duration, deaths, under-consumed, gear flags). */
export function FightHeader({ report, fightId }: { report: ReportData; fightId: number }) {
  const isAll = fightId === ALL_FIGHTS;
  const isTrash = fightId === ALL_TRASH;
  const fight = report.fights.find((f) => f.id === fightId);
  const bosses = report.fights.filter((f) => f.isBoss);
  const trash = report.fights.filter((f) => !f.isBoss);
  const kills = bosses.filter((f) => f.kill).length;
  const sumMs = (fs: typeof bosses) => fs.reduce((s, f) => s + (f.endTime - f.startTime), 0);
  const durationMs = isAll
    ? sumMs(bosses)
    : isTrash
      ? sumMs(trash)
      : fight
        ? fight.endTime - fight.startTime
        : 0;
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);

  const stats = useMemo(() => {
    const result = rpb(scoped, buildRpbConfig());
    const consRows = consumables(scoped, consumablesConfig)?.rows ?? [];
    const consByPlayer = new Map(consRows.map((c) => [c.playerId, c]));

    let gearFlags = 0;
    for (const r of gearIssues(scoped, gearIssueConfig)) {
      gearFlags += r.issues.filter((i) => i.itemId !== 0).length;
    }

    const rows = result?.rows ?? [];
    const deaths = rows.reduce((s, r) => s + r.deaths, 0);
    const underConsumed = rows.filter(
      (r) => consumablesStatus(consByPlayer.get(r.playerId)) !== "full",
    ).length;
    return { deaths, underConsumed, gearFlags };
  }, [scoped]);

  const heat = (h: Heat) => heatClass(h);

  return (
    <header className="fight-header">
      <div className="fight-header__title">
        <h2>{isAll ? "All bosses" : isTrash ? "All trash" : fight?.name ?? "Boss"}</h2>
        {isAll ? (
          <span className="pill pill--all">{kills}/{bosses.length} kills</span>
        ) : isTrash ? (
          <span className="pill pill--all">{trash.length} pulls</span>
        ) : fight ? (
          <span className={`pill ${fight.kill ? "pill--kill" : "pill--wipe"}`}>
            {fight.kill ? "Kill" : "Wipe"}
          </span>
        ) : null}
      </div>
      <dl className="fight-header__stats">
        <Stat value={isAll || isTrash || fight ? fmtDuration(durationMs) : "—"} label="Duration" />
        <Stat value={stats.deaths} label="Deaths" heat={deathsHeat(stats.deaths)} />
        {/* under-consumed and gear flags come from combatantInfo (boss pull only) */}
        <Stat
          value={isTrash ? "—" : stats.underConsumed}
          label="Under-consumed"
          heat={isTrash ? undefined : stats.underConsumed > 0 ? "watch" : "good"}
        />
        <Stat
          value={isTrash ? "—" : stats.gearFlags}
          label="Gear flags"
          heat={isTrash ? undefined : stats.gearFlags > 0 ? "watch" : "good"}
        />
      </dl>
    </header>
  );

  function Stat({ value, label, heat: h }: { value: string | number; label: string; heat?: Heat }) {
    return (
      <div className="fight-stat">
        <dd className={`fight-stat__value mono ${h ? heat(h) : ""}`}>{value}</dd>
        <dt className="fight-stat__label">{label}</dt>
      </div>
    );
  }
}
