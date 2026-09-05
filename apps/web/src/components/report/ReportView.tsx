import type { ReactNode } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SR_BOSSES, type ReportData } from "@wcl/core";
import { useIsPhone } from "../../lib/useMediaQuery";
import { ReportHeader } from "../ReportHeader";
import { ReportDrawer } from "./ReportDrawer";
import { LensBar } from "../LensBar";
import { ALL_FIGHTS, ALL_TRASH } from "../../lib/scopeReport";
import { FlagsView } from "./FlagsView";
import { SummaryRankings } from "./SummaryRankings";
import { PerformanceView } from "./PerformanceView";
import { RoleBreakdownView } from "./RoleBreakdownView";
import { GearMatrix } from "./GearMatrix";
import { FightHeader } from "./FightHeader";
import { ConsumablesCategory } from "./ConsumablesCategory";
import { ConsumablesView } from "../ConsumablesView";
import { EmptyToggle } from "./EmptyToggle";
import { ShadowResView } from "../ShadowResView";
import { TimelineView } from "./TimelineView";

const CATEGORIES = [
  ["summary", "Rankings"], ["performance", "Summary"], ["roles", "Role breakdown"], ["gear", "Gear"],
  ["consumables", "Consumables"], ["buffconsumables", "Buff consumables"], ["shadowresi", "Resistances"],
  ["timeline", "Timeline"], ["flags", "Improvements"],
] as const;
type Cat = (typeof CATEGORIES)[number][0];

// Tabs sourced from combatantInfo have no data on trash fights (WCL only records
// combatantInfo at boss pull), so the TRASH card hides them rather than showing
// empty tables. Rankings are handled separately — they only show on the combined
// BOSSES card; Resistances has its own relevance rule (see below).
const TRASH_HIDDEN_CATS: ReadonlySet<Cat> = new Set(["gear"]);

const isSrBoss = (name: string): boolean => (SR_BOSSES as readonly string[]).includes(name);

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

  const fightId = Number(params.get("fight")) || ALL_FIGHTS; // ALL card by default

  const isTrash = fightId === ALL_TRASH;
  // Resistances only matters for the three SR-relevant boss encounters: shown on
  // an individual pull of one of them, or on the combined BOSSES card when the
  // report has one of those kills/wipes at all (never on TRASH or an unrelated
  // single boss pull, e.g. Gurtogg Bloodboil).
  const currentFight = fightId === ALL_FIGHTS || isTrash ? undefined : report.fights.find((f) => f.id === fightId);
  const showResistances = currentFight
    ? currentFight.isBoss && isSrBoss(currentFight.name)
    : fightId === ALL_FIGHTS && report.fights.some((f) => f.isBoss && isSrBoss(f.name));
  // Rankings (WCL boss-encounter percentiles) only make sense for the combined
  // BOSSES card — hide the tab on the TRASH card and on individual boss pulls.
  const categories = CATEGORIES.filter(([key]) => {
    if (key === "shadowresi") return showResistances;
    // Timeline needs one specific boss pull in view — meaningless on the
    // combined BOSSES/TRASH cards, and trash pulls aren't individually selectable.
    if (key === "timeline") return currentFight !== undefined;
    return BOSSES_ONLY_CATS.has(key) ? fightId === ALL_FIGHTS : !(isTrash && TRASH_HIDDEN_CATS.has(key));
  });
  // Default landing tab is Rankings; on cards where it's hidden (TRASH, an
  // individual pull) the fallback below lands on Summary instead, since
  // neither "flags"/Improvements nor anything else should greet a fresh visit.
  const requestedCat = (params.get("cat") as Cat) ?? "summary";
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

  // Human-readable description of the current view — passed to ReportDrawer as
  // activeLabel (mobile subtitle) and used as the desktop subtitle in ReportHeader.
  const viewLabel = (() => {
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
        report={report} fightId={fightId}
        onFight={(id) => patch({ fight: String(id) })}
        actions={shareActions}
      />

      <div className="report-body">
        <FightHeader report={report} fightId={fightId} />
        <nav className="cat-subnav">
          {categories.map(([key, label]) => (
            <button key={key} className={cat === key ? "active" : ""} onClick={() => patch({ cat: key })}>{label}</button>
          ))}
        </nav>
        <div className="report-content">
          <EmptyToggle>
            {cat === "flags" && <FlagsView report={report} fightId={fightId} />}
            {cat === "summary" && <SummaryRankings report={report} />}
            {cat === "roles" && <RoleBreakdownView report={report} fightId={fightId} />}
            {cat === "performance" && <PerformanceView report={report} fightId={fightId} />}
            {cat === "gear" && <GearMatrix report={report} fightId={fightId} />}
            {cat === "consumables" && <ConsumablesCategory report={report} fightId={fightId} />}
            {cat === "buffconsumables" && <ConsumablesView report={report} />}
            {cat === "shadowresi" && <ShadowResView report={report} fightId={fightId} />}
            {cat === "timeline" && currentFight && <TimelineView report={report} fightId={currentFight.id} />}
          </EmptyToggle>
        </div>
      </div>
    </div>
  );
}
