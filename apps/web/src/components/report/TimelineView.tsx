import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportData } from "@wcl/core";
import { ensureToken } from "../../lib/api";
import { fetchFriendlyBuffs, fetchFriendlyDebuffs } from "../../lib/wcl/wcl";
import { buildTimeline, type TimelineCategory, type TimelineEntry } from "../../lib/timeline";
import { classColorVar } from "../../lib/classColors";

const CATEGORIES: { key: TimelineCategory; label: string; cls: string }[] = [
  { key: "cast", label: "Casts", cls: "tl-cast" },
  { key: "death", label: "Deaths", cls: "tl-death" },
  { key: "interrupt", label: "Interrupts", cls: "tl-interrupt" },
  { key: "buff", label: "Buffs", cls: "tl-buff" },
  { key: "debuff", label: "Debuffs", cls: "tl-debuff" },
  { key: "damage-dealt", label: "Damage dealt", cls: "tl-damage-dealt" },
  { key: "damage-taken", label: "Damage taken", cls: "tl-damage-taken" },
];
const CLASS_BY_CATEGORY = new Map(CATEGORIES.map((c) => [c.key, c.cls]));
// Every category starts on, including damage-dealt (every player's every
// melee swing/spell hit — often several thousand rows for one pull); the
// pagination cap below (PAGE_SIZE) is what keeps that from mounting a huge
// DOM tree, and the search box is the intended way to cut through the volume.
const DEFAULT_ACTIVE = new Set<TimelineCategory>(CATEGORIES.map((c) => c.key));
// Plain list, no virtualization — cap how many rows mount at once so a huge
// pull (thousands of damage-dealt rows) doesn't dump that many DOM nodes.
const PAGE_SIZE = 300;

/** Builds the colored row content: names in their class color when the actor is
 *  a friendly player (the app-wide classColorVar convention, else plain text
 *  for an NPC), the ability name tinted by event category (matches the row's
 *  left-border color), and a plain-text hit-result suffix for damage rows. */
function renderRowText(e: TimelineEntry, classById: Map<number, string>) {
  const nameSpan = (id: number | undefined, name: string | undefined) => {
    if (!name) return null;
    const cls = id != null ? classById.get(id) : undefined;
    return cls ? <span className="tl-player" style={classColorVar(cls)}>{name}</span> : <span>{name}</span>;
  };
  const player = nameSpan(e.playerId, e.playerName);
  const target = nameSpan(e.targetId, e.targetName);
  const spell = e.spellName ? <span className={`tl-spell tl-spell-${e.category}`}>{e.spellName}</span> : null;
  const result = e.resultLabel ? <span className="timeline-result"> ({e.resultLabel})</span> : null;
  const amount = e.amount != null && e.amount > 0 ? <> for {e.amount.toLocaleString()}</> : null;
  switch (e.category) {
    // amount/result are present when this cast's resulting hit was matched to it
    // (see buildTimeline's damage claimer) — a heal/buff cast has neither.
    case "cast": return <>{player} casts {spell}{target ? <> on {target}</> : null}{amount}{result}</>;
    case "death": return spell ? <>{player} dies to {spell}</> : <>{player} dies</>;
    case "interrupt": return <>{player} interrupts {target}&rsquo;s {spell}</>;
    case "buff": return <>{player} gains {spell}</>;
    case "debuff": return <>{spell} applied to {player}</>;
    case "damage-dealt": return <>{player} hits {target} with {spell}{amount}{result}</>;
    case "damage-taken": return <>{target} hits {player} with {spell}{amount}{result}</>;
  }
}

function fmtClock(ms: number, fightStart: number): string {
  const s = Math.max(0, Math.round((ms - fightStart) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Chronological combat-log timeline for a single boss pull (casts merged with
 *  their resulting hit, deaths, interrupts, buff gains, boss debuffs landing on
 *  players, damage dealt/taken including melee) — a wipefest-style "Timeline"
 *  tab. Every category starts on; the row-count cap + search box (not a
 *  category toggle) are what keep a high-volume pull like "damage dealt"
 *  browsable. ReportView only mounts this when one specific boss fight is
 *  selected, so `fightId` is always a real boss pull, never ALL/TRASH. Casts,
 *  deaths, interrupts and damage come from data the report already has — that
 *  works everywhere, including a read-only /s/:shareId view with no WCL key.
 *  Buffs/debuffs need one more live fetch, scoped to just this fight, the
 *  first time it's viewed; without a key (see `noLiveAccess`) those two
 *  categories just come back empty instead of blocking the rest of the tab. */
export function TimelineView({ report, fightId }: { report: ReportData; fightId: number }) {
  const fight = report.fights.find((f) => f.id === fightId);
  // Keyed on the report's identity too, so a "Refresh from WCL" (a new report
  // object) invalidates every cached fight instead of serving stale events.
  const cache = useRef<{ report: ReportData; entries: Map<number, TimelineEntry[]> }>({ report, entries: new Map() });
  if (cache.current.report !== report) cache.current = { report, entries: new Map() };
  const [entries, setEntries] = useState<TimelineEntry[] | null>(cache.current.entries.get(fightId) ?? null);
  // True when there's no stored WCL token (e.g. a shared /s/:shareId viewer with
  // no key of their own) — casts/deaths/interrupts/damage still render fully
  // since they're already part of the report; only buffs/debuffs need a live
  // fetch, so those two categories just come back empty instead of blocking
  // the whole tab.
  const [noLiveAccess, setNoLiveAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Set<TimelineCategory>>(new Set(DEFAULT_ACTIVE));
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const classById = useMemo(() => new Map(report.players.map((p) => [p.id, p.class])), [report.players]);

  useEffect(() => {
    const cached = cache.current.entries.get(fightId);
    if (cached) {
      setEntries(cached);
      return;
    }
    let cancelled = false;
    setEntries(null);
    setNoLiveAccess(false);
    setError(null);
    (async () => {
      const token = await ensureToken();
      if (!token) {
        // No live WCL access — still build the timeline from data the report
        // already has (casts/deaths/interrupts/damage), just without buffs/debuffs.
        if (cancelled) return;
        const built = buildTimeline(report, fightId, [], []);
        cache.current.entries.set(fightId, built);
        setEntries(built);
        setNoLiveAccess(true);
        return;
      }
      try {
        const [buffs, debuffs] = await Promise.all([
          fetchFriendlyBuffs(report.reportId, token, [fightId]),
          fetchFriendlyDebuffs(report.reportId, token, [fightId]),
        ]);
        if (cancelled) return;
        const built = buildTimeline(report, fightId, buffs, debuffs);
        cache.current.entries.set(fightId, built);
        setEntries(built);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load the timeline from WCL.");
      }
    })();
    return () => { cancelled = true; };
  }, [report, fightId]);

  const toggle = (key: TimelineCategory) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setLimit(PAGE_SIZE);
  };

  if (error) {
    return <p className="notice" role="alert">{error}</p>;
  }
  if (!fight) return null;
  if (entries === null) {
    return <p className="intro">Loading timeline…</p>;
  }

  const q = query.trim().toLowerCase();
  const visible = entries.filter((e) => active.has(e.category) && (q === "" || e.text.toLowerCase().includes(q)));

  return (
    <div className="timeline-view">
      {noLiveAccess && (
        <p className="notice">
          Buffs and debuffs need your own WCL credentials to fetch — add them in Settings to see those too.
          Casts, deaths, interrupts and damage below are unaffected.
        </p>
      )}
      <div className="timeline-controls">
        <div className="pill-toggle" role="group" aria-label="Timeline event filters">
          {CATEGORIES.map(({ key, label }) => (
            <label key={key} className={active.has(key) ? "active" : ""}>
              <input type="checkbox" checked={active.has(key)} onChange={() => toggle(key)} />
              {label}
            </label>
          ))}
        </div>
        <input
          type="search"
          className="timeline-search"
          placeholder="Search player or spell…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
          aria-label="Search timeline"
        />
      </div>
      {visible.length === 0 ? (
        <p className="notice">No events match the current filters/search.</p>
      ) : (
        <>
          <ol className="timeline-list">
            {visible.slice(0, limit).map((e, i) => (
              <li key={i} className={`timeline-row ${CLASS_BY_CATEGORY.get(e.category)}`}>
                <span className="timeline-time mono">{fmtClock(e.timestamp, fight.startTime)}</span>
                <span className="timeline-text">{renderRowText(e, classById)}</span>
              </li>
            ))}
          </ol>
          {visible.length > limit && (
            <p className="timeline-more">
              Showing {limit.toLocaleString()} of {visible.length.toLocaleString()} events.{" "}
              <button type="button" className="btn-outline" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, visible.length - limit).toLocaleString()} more
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
