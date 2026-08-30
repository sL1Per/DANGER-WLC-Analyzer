import { Fragment, useMemo, type ReactNode } from "react";
import { roleSheet, type ReportData, type Role } from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { roleSheetConfig } from "../../lib/analysisConfig";
import { heatClass, relativeHeat, deathsHeat } from "../../lib/heatmap";
import { classColorVar } from "../../lib/classColors";
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";

const fmt = (count: number, pct: number) =>
  count === 0 ? "—" : `${count} (${Math.round(pct * 100)}%)`;

const fmtNum = (n: number) => (n === 0 ? "—" : n.toLocaleString());

/** Render a HitStat cell — "—" when the whole hitStats object is absent OR count is 0. */
const fmtHit = (stat: { count: number; pct: number } | undefined) =>
  stat ? fmt(stat.count, stat.pct) : "—";

export function RoleSheetTable({
  report,
  fightId,
  role,
  onPlayer,
}: {
  report: ReportData;
  fightId: number;
  role: Role;
  onPlayer: (name: string) => void;
}) {
  const isPhone = useIsPhone();

  const scoped = useMemo(
    () => scopeReportToFight(report, fightId),
    [report, fightId],
  );
  const rows = useMemo(
    () => roleSheet(scoped, role, roleSheetConfig()),
    [scoped, role],
  );

  if (rows === null) {
    return (
      <p className="notice">
        This report was cached before RPB support — Refresh from WCL (requires
        credentials).
      </p>
    );
  }

  if (rows.length === 0) {
    return <p className="notice">No {role} players found in this report.</p>;
  }

  // Players are the COLUMNS; metrics are the ROWS (matches the source workbook).
  type Row = (typeof rows)[number];
  type Cell = { content: ReactNode; className?: string };
  type MetricRow = { label: string; labelClassName?: string; cell: (r: Row) => Cell };
  type Section = { band: string; rows: MetricRow[] };

  // relative heat scale for avoidable damage (across this role's players)
  const avoidVals = rows.map((r) => r.totalAvoidableDamageTaken);
  const aMin = Math.min(...avoidVals, 0);
  const aMax = Math.max(...avoidVals, 0);

  // A Stats & Misc row backed by a HitStat accessor (renders "—" when no hitStats).
  const hitRow = (
    label: string,
    sel: (hs: NonNullable<Row["hitStats"]>) => { count: number; pct: number },
  ): MetricRow => ({
    label,
    cell: (r) => ({
      content: r.hitStats ? fmtHit(sel(r.hitStats)) : "—",
      className: "mono",
    }),
  });

  // Build one row per distinct item across the role's players (workbook layout:
  // each trinket / avoidable ability / debuff is its own row).
  const pivot = (
    extract: (r: Row) => { name: string; value: number }[],
    fmtVal: (v: number) => string,
    order: "value-desc" | "first-seen" = "first-seen",
  ): MetricRow[] => {
    const totals = new Map<string, number>();
    const firstSeen: string[] = [];
    for (const r of rows)
      for (const { name, value } of extract(r)) {
        if (!totals.has(name)) firstSeen.push(name);
        totals.set(name, (totals.get(name) ?? 0) + value);
      }
    const names =
      order === "value-desc"
        ? [...firstSeen].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
        : firstSeen;
    return names.map((name) => ({
      label: name,
      cell: (r) => {
        const v = extract(r).find((x) => x.name === name)?.value;
        return { content: v === undefined ? "—" : fmtVal(v), className: "mono" };
      },
    }));
  };

  const sections: Section[] = [
    {
      band: "Stats & Misc",
      rows: [
        {
          label: "Battle Shout uptime on you%",
          cell: (r) => ({
            content: r.battleShoutUptime > 0 ? `${Math.round(r.battleShoutUptime * 100)}%` : "—",
            className: "mono",
          }),
        },
        {
          label: "Demoralizing Shout uptime%",
          cell: (r) => ({
            content: r.demoShoutUptime > 0 ? `${Math.round(r.demoShoutUptime * 100)}%` : "—",
            className: "mono",
          }),
        },
        {
          label: "Demoralizing Shout casts",
          cell: (r) => ({ content: r.demoShoutCasts > 0 ? r.demoShoutCasts : "—", className: "mono" }),
        },
        {
          label: "Expose Armor uptime%",
          cell: (r) => ({
            content: r.exposeArmorUptime > 0 ? `${Math.round(r.exposeArmorUptime * 100)}%` : "—",
            className: "mono",
          }),
        },
        {
          label: "Expose Armor casts",
          cell: (r) => ({ content: r.exposeArmorCasts > 0 ? r.exposeArmorCasts : "—", className: "mono" }),
        },
        hitRow("Out: Crit", (hs) => hs.outgoing.crit),
        hitRow("Out: Dodge", (hs) => hs.outgoing.dodge),
        hitRow("Out: Miss", (hs) => hs.outgoing.miss),
        hitRow("Out: Parry", (hs) => hs.outgoing.parry),
        hitRow("Out: Resist", (hs) => hs.outgoing.resist),
        hitRow("In: Crit", (hs) => hs.incomingMelee.crit),
        hitRow("In: Crushing", (hs) => hs.incomingMelee.crushing),
        hitRow("In: Blocked", (hs) => hs.incomingMelee.blocked),
        hitRow("In: Dodge", (hs) => hs.incomingMelee.dodge),
        hitRow("In: Immune", (hs) => hs.incomingMelee.immune),
        hitRow("In: Miss", (hs) => hs.incomingMelee.miss),
        hitRow("In: Parry", (hs) => hs.incomingMelee.parry),
        hitRow("Crit Heals", (hs) => hs.critHeals),
        {
          label: "# of extra Windfury Weapon attacks",
          cell: (r) => ({ content: r.hitStats ? r.hitStats.extraWindfury : "—", className: "mono" }),
        },
      ],
    },
    {
      band: "Trinkets & Racials",
      rows: pivot(
        (r) => r.trinketUses.map((t) => ({ name: t.name, value: t.count })),
        (v) => String(v),
      ),
    },
    {
      band: "Raw avoidable damage taken by tracked abilities",
      rows: [
        // one row per avoidable ability (largest first), then the summary rows
        ...pivot(
          (r) => r.avoidableByAbility.map((a) => ({ name: a.name, value: a.amount })),
          (v) => v.toLocaleString(),
          "value-desc",
        ),
        { label: "Damage Reflected", cell: (r) => ({ content: fmtNum(r.damageReflected), className: "mono" }) },
        {
          label: "Damage to Hostile Players",
          cell: (r) => ({ content: fmtNum(r.damageToHostilePlayers), className: "mono" }),
        },
        { label: "Friendly Fire", cell: (r) => ({ content: fmtNum(r.friendlyFire), className: "mono" }) },
        {
          label: "# of deaths in total",
          labelClassName: "col-deaths",
          cell: (r) => ({ content: r.deaths, className: heatClass(deathsHeat(r.deaths)) }),
        },
        {
          label: "Total (partly) avoidable damage taken",
          cell: (r) => ({
            content: r.totalAvoidableDamageTaken.toLocaleString(),
            className: `mono ${heatClass(
              relativeHeat(aMax - r.totalAvoidableDamageTaken, 0, aMax - aMin),
            )}`,
          }),
        },
      ],
    },
    {
      band: "Avoidable debuffs applied by tracked abilities",
      rows: pivot(
        (r) => r.debuffsApplied.map((d) => ({ name: d.name, value: d.count })),
        (v) => String(v),
      ),
    },
  ];

  if (isPhone) {
    return (
      <StatCards>
        {rows.map((r) => (
          <StatCard
            key={r.playerId}
            title={r.playerName}
            titleStyle={classColorVar(r.className)}
            onTitleClick={() => onPlayer(r.playerName)}
            rows={sections.flatMap((s) =>
              s.rows.map((mr) => {
                const c = mr.cell(r);
                return { label: `${s.band} · ${mr.label}`, value: c.content, className: c.className };
              }),
            )}
          />
        ))}
      </StatCards>
    );
  }

  return (
    <div className="scroll-x">
      <table className="role-sheet-table rb-transposed">
        <thead>
          <tr>
            <th className="rb-row-label" />
            {rows.map((r) => (
              <th key={r.playerId} className="player-cell" style={classColorVar(r.className)}>
                <button className="player-link" onClick={() => onPlayer(r.playerName)}>
                  {r.playerName}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <Fragment key={s.band}>
              <tr className="rb-band">
                <th className="band-header" colSpan={rows.length + 1}>
                  {s.band}
                </th>
              </tr>
              {s.rows.map((mr) => (
                <tr key={mr.label}>
                  <th className={`rb-row-label ${mr.labelClassName ?? ""}`}>{mr.label}</th>
                  {rows.map((r) => {
                    const c = mr.cell(r);
                    return (
                      <td key={r.playerId} className={c.className}>
                        {c.content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
