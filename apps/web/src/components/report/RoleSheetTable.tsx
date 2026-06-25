import { Fragment, useMemo, type ReactNode } from "react";
import { roleSheet, type ReportData, type Role } from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { roleSheetConfig } from "../../lib/analysisConfig";
import { heatClass, relativeHeat, deathsHeat } from "../../lib/heatmap";
import { classColorVar } from "../../lib/classColors";

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

  const sections: Section[] = [
    {
      band: "Stats & Misc",
      rows: [
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
          label: "# of extra Windfury Attacks",
          cell: (r) => ({ content: r.hitStats ? r.hitStats.extraWindfury : "—", className: "mono" }),
        },
        {
          label: "# of Battle Squawk buffs on bosses",
          cell: (r) => ({ content: r.hitStats ? r.hitStats.battleSquawk : "—", className: "mono" }),
        },
      ],
    },
    {
      band: "Trinkets & Racials",
      rows: [
        {
          label: "Trinkets / Racials",
          cell: (r) => ({
            content:
              r.trinketUses.length === 0
                ? "—"
                : r.trinketUses.map((t) => `${t.name} ×${t.count}`).join(", "),
          }),
        },
      ],
    },
    {
      band: "Raw avoidable damage taken by tracked abilities",
      rows: [
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
        { label: "Friendly Fire", cell: (r) => ({ content: fmtNum(r.friendlyFire), className: "mono" }) },
        { label: "Damage Reflected", cell: (r) => ({ content: fmtNum(r.damageReflected), className: "mono" }) },
        {
          label: "Damage to Hostile Players",
          cell: (r) => ({ content: fmtNum(r.damageToHostilePlayers), className: "mono" }),
        },
        {
          label: "By Ability",
          cell: (r) => ({
            content:
              r.avoidableByAbility.length === 0
                ? "—"
                : r.avoidableByAbility
                    .map((a) => `${a.name}: ${a.amount.toLocaleString()}`)
                    .join("; "),
          }),
        },
      ],
    },
    {
      band: "Avoidable debuffs applied by tracked abilities",
      rows: [
        {
          label: "Debuffs Applied",
          cell: (r) => ({
            content:
              r.debuffsApplied.length === 0
                ? "—"
                : r.debuffsApplied.map((d) => `${d.name} ×${d.count}`).join(", "),
          }),
        },
      ],
    },
  ];

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
