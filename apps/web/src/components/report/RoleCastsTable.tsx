import { Fragment, useMemo } from "react";
import {
  roleCasts,
  type ReportData,
  type Role,
  type CastCategory,
  type ActivityResult,
} from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { roleCastsConfig } from "../../lib/analysisConfig";
import { classColorVar } from "../../lib/classColors";
import { heatClass, relativeHeat } from "../../lib/heatmap";

const CATEGORY_LABELS: Record<CastCategory, string> = {
  single: "Single Target",
  aoe: "AoE",
  cooldown: "Cooldowns",
  heal: "Healing",
};

const CATEGORY_ORDER: CastCategory[] = ["single", "aoe", "cooldown", "heal"];

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtSec(n: number): string {
  return n === 0 ? "—" : `${n.toFixed(1)}s`;
}

/** Activity metrics as ROWS (players are columns), mirroring the casts sheet. */
const ACTIVITY_ROWS: { label: string; fmt: (a: ActivityResult) => string }[] = [
  { label: "seconds active on single target", fmt: (a) => fmtSec(a.secondsActiveST) },
  { label: "relative active % on single target", fmt: (a) => fmtPct(a.relativeActiveST) },
  { label: "relative active % total", fmt: (a) => fmtPct(a.relativeActiveTotal) },
  { label: "relative active % on aoe", fmt: (a) => fmtPct(a.relativeActiveAoe) },
  { label: "seconds active on aoe", fmt: (a) => fmtSec(a.secondsActiveAoe) },
];

export function RoleCastsTable({
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

  const cfg = useMemo(() => roleCastsConfig(), []);

  const blocks = useMemo(
    () => roleCasts(scoped, role, cfg),
    [scoped, role, cfg],
  );

  if (blocks === null) {
    return (
      <p className="notice">
        This report was cached before RPB support — Refresh from WCL (requires
        credentials).
      </p>
    );
  }

  if (blocks.length === 0) {
    return <p className="notice">No {role} players found in this report.</p>;
  }

  return (
    <div className="role-casts-table">
      {blocks.map((block) => {
        // Group abilities by category, in canonical order
        const abilitiesByCategory = new Map<
          CastCategory,
          { key: string; name: string; category: CastCategory }[]
        >();
        for (const cat of CATEGORY_ORDER) {
          const abils = block.abilities.filter((a) => a.category === cat);
          if (abils.length > 0) abilitiesByCategory.set(cat, abils);
        }
        const presentCategories = CATEGORY_ORDER.filter((c) =>
          abilitiesByCategory.has(c),
        );

        // Per-ability cast counts across players, for relative heat.
        const countsByAbility = new Map<string, number[]>();
        for (const cat of presentCategories) {
          for (const ability of abilitiesByCategory.get(cat) ?? []) {
            countsByAbility.set(
              ability.key,
              block.players.map(
                (p) =>
                  block.counts.get(`${p.playerId}:${ability.key}`)?.castCount ?? 0,
              ),
            );
          }
        }

        // Pluralize class name (simple: append 's')
        const classTitle = `${block.className}s`;
        const colCount = block.players.length + 1;

        return (
          <section key={block.className} className="class-cast-block">
            <h3 className="class-cast-title">{classTitle}</h3>
            <div className="scroll-x">
              <table className="role-casts-tbl rb-transposed">
                <thead>
                  {/* Players are the COLUMNS; abilities are the ROWS. */}
                  <tr>
                    <th className="rb-row-label" />
                    {block.players.map((player) => (
                      <th
                        key={player.playerId}
                        className="player-cell"
                        style={classColorVar(block.className)}
                      >
                        <button
                          className="player-link"
                          onClick={() => onPlayer(player.playerName)}
                        >
                          {player.playerName}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {presentCategories.map((cat) => (
                    <Fragment key={cat}>
                      <tr className="rb-band">
                        <th className="band-header" colSpan={colCount}>
                          {CATEGORY_LABELS[cat]}
                        </th>
                      </tr>
                      {(abilitiesByCategory.get(cat) ?? []).map((ability) => {
                        const vals = countsByAbility.get(ability.key) ?? [];
                        const min = Math.min(...vals, 0);
                        const max = Math.max(...vals, 0);
                        return (
                          <tr key={ability.key}>
                            <th className="rb-row-label ability-col">{ability.name}</th>
                            {block.players.map((player) => {
                              const count =
                                block.counts.get(`${player.playerId}:${ability.key}`)
                                  ?.castCount ?? 0;
                              return (
                                <td
                                  key={player.playerId}
                                  className={`mono ${heatClass(relativeHeat(count, min, max))}`}
                                >
                                  {count === 0 ? "—" : count}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}

                  {/* Activity band */}
                  <tr className="rb-band">
                    <th className="band-header" colSpan={colCount}>
                      Activity
                    </th>
                  </tr>
                  {ACTIVITY_ROWS.map((ar) => (
                    <tr key={ar.label}>
                      <th className="rb-row-label">{ar.label}</th>
                      {block.players.map((player) => {
                        const act = block.activity.get(player.playerId) ?? null;
                        return (
                          <td key={player.playerId} className="mono">
                            {act ? ar.fmt(act) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
