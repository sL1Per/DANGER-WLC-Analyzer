import type { ReactNode } from "react";
import { useSearchParams, Link } from "react-router-dom";
import type { ReportData } from "@wcl/core";
import { useIsPhone } from "../../lib/useMediaQuery";
import { ReportHeader } from "../ReportHeader";
import { ReportDrawer } from "./ReportDrawer";
import { LensBar, type Lens } from "../LensBar";
import { ALL_FIGHTS, ALL_TRASH } from "../../lib/scopeReport";
import { FlagsView } from "./FlagsView";
import { SummaryRankings } from "./SummaryRankings";
import { PerformanceView } from "./PerformanceView";
import { RoleBreakdownView } from "./RoleBreakdownView";
import { GearMatrix } from "./GearMatrix";
import { FightHeader } from "./FightHeader";
import { ConsumablesCategory } from "./ConsumablesCategory";
import { ConsumablesView } from "../ConsumablesView";
import { PlayerProfile } from "./PlayerProfile";
import { EmptyToggle } from "./EmptyToggle";
import { ShadowResView } from "../ShadowResView";
import { DensityToggle } from "../DensityToggle";

const CATEGORIES = [
  ["flags", "Flags"],
  ["summary", "Rankings"], ["performance", "Summary"], ["roles", "Role breakdown"], ["gear", "Gear"],
  ["consumables", "Consumables"], ["buffconsumables", "Buff consumables"], ["shadowresi", "Resistances"],
] as const;
type Cat = (typeof CATEGORIES)[number][0];

// Tabs sourced from combatantInfo have no data on trash fights (WCL only records
// combatantInfo at boss pull), so the TRASH card hides them rather than showing
// empty tables. Rankings are handled separately — they only show on the combined
// BOSSES card (see below).
const TRASH_HIDDEN_CATS: ReadonlySet<Cat> = new Set(["gear", "shadowresi"]);

// Tabs that aggregate across all boss pulls (CLA report-wide audits): they only
// make sense on the combined BOSSES card, not on a single pull or the TRASH card.
const BOSSES_ONLY_CATS: ReadonlySet<Cat> = new Set(["summary", "buffconsumables"]);

interface ReportViewProps {
  report: ReportData;
  stale?: boolean;
  onRefresh?: () => void;
  shareActions?: ReactNode;
}

export function ReportView({ report, stale = false, onRefresh, shareActions }: ReportViewProps) {
  const [params, setParams] = useSearchParams();
  const isPhone = useIsPhone();

  const lens = (params.get("lens") as Lens) ?? "fight";
  const query = params.get("q") ?? "";
  const fightId = Number(params.get("fight")) || ALL_FIGHTS; // ALL card by default
  const playerId = Number(params.get("player")) || report.players[0]?.id || 0;

  const isTrash = fightId === ALL_TRASH;
  // Rankings (WCL boss-encounter percentiles) only make sense for the combined
  // BOSSES card — hide the tab on the TRASH card and on individual boss pulls.
  const categories = CATEGORIES.filter(([key]) =>
    BOSSES_ONLY_CATS.has(key) ? fightId === ALL_FIGHTS : !(isTrash && TRASH_HIDDEN_CATS.has(key)),
  );
  const requestedCat = (params.get("cat") as Cat) ?? "flags";
  // If the active tab is hidden for this card (e.g. Gear on the TRASH card),
  // fall back to the first visible tab so the body is never blank.
  const cat: Cat = categories.some(([key]) => key === requestedCat)
    ? requestedCat
    : categories[0]![0];

  const patch = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    setParams(p, { replace: false });
  };
  const goPlayer = (name: string) => {
    const p = report.players.find((pl) => pl.name === name);
    if (p) patch({ lens: "player", player: String(p.id) });
  };

  // Human-readable description of the current view — passed to ReportDrawer as
  // activeLabel (mobile subtitle) and used as the desktop subtitle in ReportHeader.
  const viewLabel = (() => {
    if (lens === "player") {
      const name = report.players.find((p) => p.id === playerId)?.name ?? "Player";
      return `Players details · ${name}`;
    }
    const catLabel = CATEGORIES.find(([key]) => key === cat)?.[1] ?? cat;
    const fightName =
      fightId === ALL_FIGHTS ? "BOSSES" :
      fightId === ALL_TRASH ? "TRASH" :
      report.fights.find((f) => f.id === fightId)?.name ?? "fight";
    return `${catLabel} · ${fightName}`;
  })();

  return (
    <div className="report">
      {isPhone ? (
        <ReportDrawer title={report.title} activeLabel={viewLabel}>
          <nav className="drawer-nav">
            {categories.map(([key, label]) => (
              <button key={key} className={cat === key ? "active" : ""} onClick={() => patch({ cat: key })}>{label}</button>
            ))}
          </nav>
          <div className="drawer-actions">
            <Link to="/settings" className="btn-outline">Settings</Link>
            <Link to="/" className="btn-outline">New report</Link>
            {onRefresh && <button className="btn-outline" onClick={onRefresh}>Refresh from WCL</button>}
          </div>
        </ReportDrawer>
      ) : (
        <ReportHeader report={report} onRefresh={onRefresh} />
      )}
      {stale && onRefresh && (
        <div className="stale-banner" role="status">
          <span>
            This report was cached by an older version of the analyzer and may be
            missing the latest stats.
          </span>
          <button type="button" className="btn-outline" onClick={onRefresh}>
            Refresh from WCL
          </button>
        </div>
      )}
      <LensBar
        report={report} lens={lens} fightId={fightId} playerId={playerId} query={query}
        onLens={(l) => patch({ lens: l })}
        onFight={(id) => patch({ fight: String(id) })}
        onPlayer={(id) => patch({ player: String(id) })}
        onQuery={(q) => patch({ q })}
        actions={<><DensityToggle />{shareActions}</>}
      />

      {lens === "fight" ? (
        <div className="report-body">
          <FightHeader report={report} fightId={fightId} />
          <nav className="cat-subnav">
            {categories.map(([key, label]) => (
              <button key={key} className={cat === key ? "active" : ""} onClick={() => patch({ cat: key })}>{label}</button>
            ))}
          </nav>
          <div className="report-content">
            <EmptyToggle>
              {cat === "flags" && <FlagsView report={report} fightId={fightId} onPlayer={goPlayer} />}
              {cat === "summary" && <SummaryRankings report={report} onPlayer={goPlayer} />}
              {cat === "roles" && <RoleBreakdownView report={report} fightId={fightId} onPlayer={goPlayer} />}
              {cat === "performance" && <PerformanceView report={report} fightId={fightId} onPlayer={goPlayer} />}
              {cat === "gear" && <GearMatrix report={report} fightId={fightId} onPlayer={goPlayer} />}
              {cat === "consumables" && <ConsumablesCategory report={report} fightId={fightId} onPlayer={goPlayer} />}
              {cat === "buffconsumables" && <ConsumablesView report={report} onPlayer={goPlayer} />}
              {cat === "shadowresi" && <ShadowResView report={report} />}
            </EmptyToggle>
          </div>
        </div>
      ) : (
        <div className="report-body"><div className="report-content">
          <EmptyToggle>
            <PlayerProfile report={report} playerId={playerId} />
          </EmptyToggle>
        </div></div>
      )}
    </div>
  );
}
