import type { GuildReport } from "../src/lib/wcl/wcl";

// Pure decision logic for the scheduled auto-ingest job (autoIngest.ts): which
// of a guild's WCL reports are finished and should be published + posted to
// Discord this run. All I/O lives in the job; this only transforms state.

export interface IngestState {
  /** epoch ms; reports that started before this are never posted (no backfill) */
  since: number;
  /** code → shareId once posted; null when skipped as another log of the same raid */
  posted: Record<string, string | null>;
  /** code → last-seen endTime and when that endTime was first seen */
  pending: Record<string, { endTime: number; seenAt: number }>;
  lastRunAt?: number;
  lastError?: string;
}

const POSTED_HISTORY_MAX = 200;
/** two logs' pulls of the same boss starting this close together are the same pull */
const SAME_PULL_TOLERANCE_MS = 60_000;

export function initialState(now: number): IngestState {
  return { since: now, posted: {}, pending: {} };
}

/** Record a successful post. Called only after Discord accepted the message, so
 *  a failed publish/post leaves the code pending and it's retried next run. */
export function markPosted(state: IngestState, code: string, shareId: string | null): IngestState {
  const { [code]: _done, ...pending } = state.pending;
  void _done;
  return { ...state, pending, posted: { ...state.posted, [code]: shareId } };
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

/** Decide what to post. A log is "finished" once its endTime has stayed the same
 *  for `settleMs` (WCL lists a report as soon as live logging/upload starts and
 *  it keeps growing until then) and it has at least one boss fight. When several
 *  logs cover the same raid, only the one with the most boss fights is posted,
 *  and only after all of them have finished. */
export function planIngest(
  reports: GuildReport[], state: IngestState, now: number, settleMs: number,
): { toPost: GuildReport[]; nextState: IngestState } {
  const candidates = reports.filter((r) => r.startTime >= state.since && !(r.code in state.posted));
  const alreadyPosted = reports.filter((r) => typeof state.posted[r.code] === "string");

  const pending: IngestState["pending"] = {};
  for (const r of candidates) {
    const prev = state.pending[r.code];
    pending[r.code] = prev && prev.endTime === r.endTime ? prev : { endTime: r.endTime, seenAt: now };
  }
  const settled = (r: GuildReport) => now - pending[r.code]!.seenAt >= settleMs;

  let nextState: IngestState = { ...state, pending };
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
    if (!group.every(settled)) continue;
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
