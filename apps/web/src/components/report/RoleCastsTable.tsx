import { useMemo } from "react";
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

function ActivityCell({ act }: { act: ActivityResult | null }) {
  if (!act) return <td className="mono">—</td>;
  return (
    <td className="mono activity-cell">
      ST: {fmtSec(act.secondsActiveST)} ({fmtPct(act.relativeActiveST)}) /
      AoE: {fmtSec(act.secondsActiveAoe)} ({fmtPct(act.relativeActiveAoe)}) /
      Total: {fmtPct(act.relativeActiveTotal)}
    </td>
  );
}

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

        // Build ordered flat ability list for column indexing
        const orderedAbilities = presentCategories.flatMap(
          (c) => abilitiesByCategory.get(c)!,
        );

        // Relative heat for cast counts: per ability column
        const countsByAbility = new Map<string, number[]>();
        for (const ability of orderedAbilities) {
          const vals = block.players.map(
            (p) =>
              block.counts.get(`${p.playerId}:${ability.key}`)?.castCount ?? 0,
          );
          countsByAbility.set(ability.key, vals);
        }

        // Pluralize class name (simple: append 's')
        const classTitle = `${block.className}s`;

        return (
          <section key={block.className} className="class-cast-block">
            <h3 className="class-cast-title">{classTitle}</h3>
            <div className="scroll-x">
              <table className="role-casts-tbl">
                <thead>
                  {/* Band header row: Player + one cell per category */}
                  <tr>
                    <th rowSpan={2} className="player-col">
                      Player
                    </th>
                    {presentCategories.map((cat) => {
                      const count = abilitiesByCategory.get(cat)!.length;
                      return (
                        <th
                          key={cat}
                          colSpan={count}
                          className="band-header"
                        >
                          {CATEGORY_LABELS[cat]}
                        </th>
                      );
                    })}
                    <th rowSpan={2} className="band-header activity-col">
                      Activity
                    </th>
                  </tr>
                  {/* Ability name sub-header row */}
                  <tr>
                    {orderedAbilities.map((ability) => (
                      <th key={ability.key} className="ability-col">
                        {ability.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.players.map((player) => {
                    const act =
                      block.activity.get(player.playerId) ?? null;
                    return (
                      <tr key={player.playerId}>
                        {/* Player name cell */}
                        <td
                          className="player-cell"
                          style={classColorVar(block.className)}
                        >
                          <button
                            className="player-link"
                            onClick={() => onPlayer(player.playerName)}
                          >
                            {player.playerName}
                          </button>
                        </td>

                        {/* Cast count cells — ALL abilities, no truncation */}
                        {orderedAbilities.map((ability) => {
                          const cell = block.counts.get(
                            `${player.playerId}:${ability.key}`,
                          );
                          const count = cell?.castCount ?? 0;
                          const vals = countsByAbility.get(ability.key)!;
                          const min = Math.min(...vals, 0);
                          const max = Math.max(...vals, 0);
                          const heat = relativeHeat(count, min, max);
                          return (
                            <td
                              key={ability.key}
                              className={`mono ${heatClass(heat)}`}
                            >
                              {count === 0 ? "—" : count}
                            </td>
                          );
                        })}

                        {/* Activity cell */}
                        <ActivityCell act={act} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
