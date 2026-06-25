import { useSearchParams, useParams, Link } from "react-router-dom";
import { useReport } from "../lib/useReport";
import { ReportHeader } from "../components/ReportHeader";
import { LensBar, type Lens } from "../components/LensBar";
import { ALL_FIGHTS, ALL_TRASH } from "../lib/scopeReport";
import { SummaryRankings } from "../components/report/SummaryRankings";
import { PerformanceView } from "../components/report/PerformanceView";
import { RoleBreakdownView } from "../components/report/RoleBreakdownView";
import { GearMatrix } from "../components/report/GearMatrix";
import { FightHeader } from "../components/report/FightHeader";
import { ConsumablesCategory } from "../components/report/ConsumablesCategory";
import { ConsumablesView } from "../components/ConsumablesView";
import { PlayerProfile } from "../components/report/PlayerProfile";
import { ShadowResView } from "../components/ShadowResView";
import { LoadingNugget } from "../components/LoadingNugget";

const CATEGORIES = [
  ["summary", "Rankings"], ["performance", "Summary"], ["roles", "Role Breakdown"], ["gear", "Gear"],
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

export function ReportPage() {
  const { reportId = "" } = useParams();
  const { result, error, loading, reload } = useReport(reportId);
  const [params, setParams] = useSearchParams();

  if (loading) return <LoadingNugget />;
  if (error) {
    return (
      <div role="alert">
        <p>{error.message}</p>
        {error.needsKey && <p><Link to="/settings">Add your WCL credentials</Link> to load this report.</p>}
      </div>
    );
  }
  if (!result) return null;
  const report = result.data;

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
  const goPlayer = (name: string) => {
    const p = report.players.find((pl) => pl.name === name);
    if (p) patch({ lens: "player", player: String(p.id) });
  };

  return (
    <div className="report">
      <ReportHeader report={report} onRefresh={reload} />
      <LensBar
        report={report} lens={lens} fightId={fightId} playerId={playerId} query={query}
        onLens={(l) => patch({ lens: l })}
        onFight={(id) => patch({ fight: String(id) })}
        onPlayer={(id) => patch({ player: String(id) })}
        onQuery={(q) => patch({ q })}
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
            {cat === "summary" && <SummaryRankings report={report} onPlayer={goPlayer} />}
            {cat === "roles" && <RoleBreakdownView report={report} fightId={fightId} onPlayer={goPlayer} />}
            {cat === "performance" && <PerformanceView report={report} fightId={fightId} onPlayer={goPlayer} />}
            {cat === "gear" && <GearMatrix report={report} fightId={fightId} onPlayer={goPlayer} />}
            {cat === "consumables" && <ConsumablesCategory report={report} fightId={fightId} onPlayer={goPlayer} />}
            {cat === "buffconsumables" && <ConsumablesView report={report} onPlayer={goPlayer} />}
            {cat === "shadowresi" && <ShadowResView report={report} />}
          </div>
        </div>
      ) : (
        <div className="report-body"><div className="report-content">
          <PlayerProfile report={report} playerId={playerId} />
        </div></div>
      )}
    </div>
  );
}
