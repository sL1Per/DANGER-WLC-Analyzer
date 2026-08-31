import { useMemo, useState } from "react";
import { shadowResistance, LISTING_SLOTS, SLOT_NAMES, type SrBoss, type ReportData } from "@wcl/core";
import { itemShadowRes, shadowResEnchants, shadowResGems, shadowResBuffs, SR_SOFT_TARGET } from "@wcl/data";
import { useIsPhone } from "../lib/useMediaQuery";
import { StatCard, StatCards } from "./report/StatCard";
import { SeverityLegend } from "./SeverityLegend";

export function ShadowResView({ report }: { report: ReportData }) {
  const isPhone = useIsPhone();
  const [boss, setBoss] = useState<SrBoss | undefined>(undefined);
  const result = useMemo(
    () => shadowResistance(report, {
      itemShadowRes, enchantShadowRes: shadowResEnchants, gemShadowRes: shadowResGems,
      buffShadowRes: shadowResBuffs, softTarget: SR_SOFT_TARGET,
    }, { boss }),
    [report, boss],
  );

  if (result === null) {
    return <p>This report has no shadow-resistance boss (Mother Shahraz, Kaz'rogal, or Azgalor).</p>;
  }

  if (isPhone) {
    return (
      <div>
        <p>
          <label>
            boss:{" "}
            <select value={result.boss} onChange={(e) => setBoss(e.target.value as SrBoss)}>
              {result.availableBosses.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>{" "}
          <small>analyzing the {result.isKill ? "kill" : "longest wipe"}.</small>
        </p>
        <StatCards>
          {result.players.map((p) => (
            <StatCard
              key={p.playerId}
              title={p.name}
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
      <p>
        <label>
          boss:{" "}
          <select value={result.boss} onChange={(e) => setBoss(e.target.value as SrBoss)}>
            {result.availableBosses.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>{" "}
        <small>analyzing the {result.isKill ? "kill" : "longest wipe"}. SR total colouring is advisory, not an official threshold. Priest/mage buff SR may be missing from logs.</small>
      </p>
      <SeverityLegend />
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>player</th>
              <th>SR from gear + buffs</th>
              <th>from gear</th>
              <th>from buffs</th>
              {LISTING_SLOTS.map((s) => <th key={s}>{SLOT_NAMES[s]}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.players.map((p) => (
              <tr key={p.playerId}>
                <td>{p.name}</td>
                <td className={`sev-${p.severity}`}>{p.total}</td>
                <td>{p.fromGear}</td>
                <td>{p.fromBuffs}</td>
                {LISTING_SLOTS.map((s) => <td key={s}>{p.slots[s] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
