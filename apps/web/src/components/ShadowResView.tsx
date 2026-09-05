import { useMemo } from "react";
import { shadowResistance, LISTING_SLOTS, SLOT_NAMES, type ReportData } from "@wcl/core";
import { itemShadowRes, shadowResEnchants, shadowResGems, shadowResBuffs, SR_SOFT_TARGET } from "@wcl/data";
import { CLASS_ORDER, classColorVar } from "../lib/classColors";
import { ALL_FIGHTS } from "../lib/scopeReport";
import { useIsPhone } from "../lib/useMediaQuery";
import { StatCard, StatCards } from "./report/StatCard";

const classRank = (c: string): number => {
  const i = (CLASS_ORDER as readonly string[]).indexOf(c);
  return i === -1 ? CLASS_ORDER.length : i;
};

/** `fightId` picks the exact SR-relevant pull to analyze (the report's own fight
 *  selector already resolved the ambiguity — this view has no boss picker of its
 *  own). ReportView only mounts this component when that pull (or the combined
 *  BOSSES card) is actually SR-relevant. */
export function ShadowResView({ report, fightId }: { report: ReportData; fightId: number }) {
  const isPhone = useIsPhone();
  const isAll = fightId === ALL_FIGHTS;
  const result = useMemo(
    () => shadowResistance(report, {
      itemShadowRes, enchantShadowRes: shadowResEnchants, gemShadowRes: shadowResGems,
      buffShadowRes: shadowResBuffs, softTarget: SR_SOFT_TARGET,
    }, isAll ? undefined : { fightId }),
    [report, fightId, isAll],
  );

  const classOf = useMemo(() => new Map((report.players ?? []).map((p) => [p.id, p.class])), [report.players]);
  const players = useMemo(() => {
    if (result === null) return [];
    return [...result.players].sort((a, b) => {
      const d = classRank(classOf.get(a.playerId) ?? "") - classRank(classOf.get(b.playerId) ?? "");
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
  }, [result, classOf]);

  if (result === null) {
    return <p>This report has no shadow-resistance boss (Mother Shahraz, Kaz'rogal, or Azgalor).</p>;
  }

  // On a specific pull the fight header above already shows Kill/Wipe for it;
  // the combined BOSSES card has no single pull in view, so say which one this
  // table fell back to (mirrors the Gear tab's per-pull-snapshot notice).
  const allCardNotice = isAll && (
    <p className="notice">
      Shadow Resistance is a snapshot per pull — showing {result.boss} ({result.isKill ? "kill" : "longest wipe"}).
      Pick that pull above for a different attempt.
    </p>
  );

  if (isPhone) {
    return (
      <div>
        {allCardNotice}
        <StatCards>
          {players.map((p) => (
            <StatCard
              key={p.playerId}
              title={p.name}
              titleStyle={classColorVar(classOf.get(p.playerId) ?? "")}
              rows={[
                { label: "SR (gear + buffs)", value: p.total, className: `sev-${p.severity}` },
                { label: "from gear", value: p.fromGear },
                { label: "from buffs", value: p.fromBuffs },
                ...LISTING_SLOTS
                  .filter((s) => p.slots[s])
                  .map((s) => ({ label: SLOT_NAMES[s], value: p.slots[s] as string })),
              ]}
            />
          ))}
        </StatCards>
      </div>
    );
  }

  return (
    <div>
      <div className="sr-notices">
        {allCardNotice}
        <p className="sr-notices__hint"><small>SR total colouring is advisory, not an official threshold. Priest/mage buff SR may be missing from logs.</small></p>
      </div>
      <div className="player-matrix-card scroll-x">
        <table className="player-matrix sr-matrix">
          <thead>
            <tr>
              <th className="matrix-corner" scope="col">Player</th>
              {players.map((p) => (
                <th key={p.playerId} className="player-col" style={classColorVar(classOf.get(p.playerId) ?? "")} scope="col">
                  <span className="player-col__name">{p.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="matrix-row-label">SR from gear + buffs</th>
              {players.map((p) => <td key={p.playerId} className={`sev-${p.severity}`}>{p.total}</td>)}
            </tr>
            <tr>
              <th scope="row" className="matrix-row-label">from gear</th>
              {players.map((p) => <td key={p.playerId}>{p.fromGear}</td>)}
            </tr>
            <tr>
              <th scope="row" className="matrix-row-label">from buffs</th>
              {players.map((p) => <td key={p.playerId}>{p.fromBuffs}</td>)}
            </tr>
            {LISTING_SLOTS.map((s) => (
              <tr key={s}>
                <th scope="row" className="matrix-row-label">{SLOT_NAMES[s]}</th>
                {players.map((p) => <td key={p.playerId}>{p.slots[s] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
