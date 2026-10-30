import type { GuildReport } from "../src/lib/wcl/wcl";

// Pure decision logic for the scheduled auto-ingest job (autoIngest.ts): which
// of a guild's WCL reports are finished and should be published + posted to
// Discord this run. All I/O lives in the job; this only transforms state.

export interface IngestState {
  /** code → shareId once posted; null when skipped as another log of the same raid */
  posted: Record<string, string | null>;
  lastRunAt?: number;
  lastError?: string;
}

const POSTED_HISTORY_MAX = 200;
/** two logs' pulls of the same boss starting this close together are the same pull */
const SAME_PULL_TOLERANCE_MS = 60_000;

export function initialState(): IngestState {
  return { posted: {} };
}

/** Record a post (or a skipped duplicate, shareId null). Called only after
 *  Discord accepted the message, so a failed publish/post is retried next run. */
export function markPosted(state: IngestState, code: string, shareId: string | null): IngestState {
  return { ...state, posted: { ...state.posted, [code]: shareId } };
}

const bossFights = (r: GuildReport) => r.fights.filter((f) => f.encounterID !== 0).length;

const bossPulls = (r: GuildReport) =>
  r.fights.filter((f) => f.encounterID !== 0).map((f) => ({ id: f.encounterID, at: r.startTime + f.startTime }));

// Two people often log the same raid. Overlapping time alone isn't enough — a
// guild can run two groups at once — and WCL's player lists include bystanders,
// so match on the raid itself: the logs share at least one boss pull.
function sameRaid(a: GuildReport, b: GuildReport): boolean {
  if (a.startTime > b.endTime || b.startTime > a.endTime) return false;
  const pullsB = bossPulls(b);
  return bossPulls(a).some((p) =>
    pullsB.some((q) => q.id === p.id && Math.abs(q.at - p.at) <= SAME_PULL_TOLERANCE_MS));
}

/** Decide what to post from one listing of the guild's recent reports.
 *
 *  A log is "finished" once its last event is at least `quietMs` old: a raid
 *  being live-logged keeps endTime near now, while a log uploaded the morning
 *  after already ends hours ago. (A log caught mid-upload also looks old — the
 *  job guards that by listing again and keeping only logs that didn't grow; see
 *  `unchanged`.) It also needs a boss fight. When several logs cover the same
 *  raid, only the one with the most boss fights is posted, once all are finished;
 *  the rest are recorded as skipped duplicates. */
export function planIngest(
  reports: GuildReport[], state: IngestState, now: number, quietMs: number,
): { toPost: GuildReport[]; nextState: IngestState } {
  const candidates = reports.filter((r) => !(r.code in state.posted));
  const alreadyPosted = reports.filter((r) => typeof state.posted[r.code] === "string");
  const finished = (r: GuildReport) => now - r.endTime >= quietMs;

  let nextState = state;
  const toPost: GuildReport[] = [];
  const handled = new Set<string>();
  for (const r of candidates) {
    if (handled.has(r.code)) continue;
    const group = candidates.filter((o) => o === r || sameRaid(o, r));
    group.forEach((o) => handled.add(o.code));

    if (alreadyPosted.some((p) => group.some((o) => sameRaid(o, p)))) {
      for (const o of group) nextState = markPosted(nextState, o.code, null);
      continue;
    }
    if (!group.every(finished)) continue;
    const best = [...group].sort((x, y) =>
      bossFights(y) - bossFights(x) || (y.endTime - y.startTime) - (x.endTime - x.startTime))[0]!;
    if (bossFights(best) === 0) continue;
    toPost.push(best);
    for (const o of group) if (o !== best) nextState = markPosted(nextState, o.code, null);
  }

  const postedCodes = Object.keys(nextState.posted);
  if (postedCodes.length > POSTED_HISTORY_MAX) {
    nextState = { ...nextState, posted: Object.fromEntries(
      postedCodes.slice(-POSTED_HISTORY_MAX).map((c) => [c, nextState.posted[c]!])) };
  }
  toPost.sort((a, b) => a.startTime - b.startTime);
  return { toPost, nextState };
}

/** The reports from `before` that a later listing (`after`) shows unchanged —
 *  same endTime and fight count — i.e. not still being uploaded. */
export function unchanged(before: GuildReport[], after: GuildReport[]): GuildReport[] {
  const later = new Map(after.map((r) => [r.code, r]));
  return before.filter((r) => {
    const o = later.get(r.code);
    return o !== undefined && o.endTime === r.endTime && o.fights.length === r.fights.length;
  });
}
