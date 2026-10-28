/// <reference types="node" />
// Scheduled auto-ingest (run by .github/workflows/auto-ingest.yml every 15 min):
// find the guild's newly finished WCL logs, publish each as a key-free snapshot
// and post its /s/<shareId> link to Discord. Reuses the browser pipeline as-is —
// Node 22 has fetch/btoa/CompressionStream — with a dedicated service WCL key.
//
//   pnpm --filter @wcl/web ingest [--dry-run] [--since=2026-10-20] [--settle-minutes=30]
//
// --dry-run loads the reports and prints the Discord messages, but publishes,
// posts and saves nothing; with --since it can preview past raids.
import { fetchToken, fetchGuildReports, type GuildReport } from "../src/lib/wcl/wcl";
import { loadReport } from "../src/lib/wcl/loadReport";
import { publishSnapshotTo, shareUrlFor } from "../src/lib/shareCore";
import { buildShareMessage, isValidWebhookUrl, postToDiscord } from "../src/lib/discord";
import { initialState, markPosted, planIngest, type IngestState } from "./ingestPlan";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const dryRun = args.includes("--dry-run");
const settleMs = Number(flag("settle-minutes") ?? 30) * 60_000;
const sinceOverride = flag("since") ? Date.parse(flag("since")!) : undefined;

function env(name: string, required = true): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value && required) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function stateRequest(apiBase: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${apiBase.replace(/\/+$/, "")}/api/ingest/state`, {
    ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Ingest state request failed (HTTP ${res.status})`);
  return res;
}

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`;
}

/** "6/7 bosses killed · 2h56m" — distinct encounters, so wipes don't inflate the count. */
function raidSummary(r: GuildReport): string {
  const bosses = new Set(r.fights.filter((f) => f.encounterID !== 0).map((f) => f.encounterID));
  const kills = new Set(r.fights.filter((f) => f.encounterID !== 0 && f.kill).map((f) => f.encounterID));
  return `${kills.size}/${bosses.size} bosses killed · ${formatDuration(r.endTime - r.startTime)}`;
}

async function main(): Promise<void> {
  const guildId = Number(env("GUILD_ID"));
  if (!Number.isInteger(guildId) || guildId <= 0) throw new Error("GUILD_ID must be a numeric WCL guild id");
  const webhookUrl = env("DISCORD_WEBHOOK_URL", !dryRun);
  if (webhookUrl && !isValidWebhookUrl(webhookUrl)) throw new Error("DISCORD_WEBHOOK_URL is not a Discord webhook URL");
  const apiBase = env("API_BASE", !dryRun);
  const webOrigin = env("WEB_ORIGIN", !dryRun);
  const ingestToken = env("INGEST_TOKEN", !dryRun);

  const now = Date.now();
  let state: IngestState | null = apiBase && ingestToken
    ? await (await stateRequest(apiBase, ingestToken)).json() as IngestState | null
    : null;
  // First ever run: start watching from now, so the channel isn't flooded
  // with the guild's past raids.
  if (!state) {
    console.log("No saved state — starting fresh; only raids from now on will be posted.");
    state = initialState(now);
  }
  if (sinceOverride !== undefined) state = { ...state, since: sinceOverride };

  const wcl = await fetchToken(env("WCL_CLIENT_ID"), env("WCL_CLIENT_SECRET"));
  const reports = await fetchGuildReports(guildId, state.since, wcl.accessToken);
  const { toPost, nextState } = planIngest(reports, state, now, settleMs);
  console.log(`Guild ${guildId}: ${reports.length} report(s) since ${new Date(state.since).toISOString()}, `
    + `${Object.keys(nextState.pending).length} pending, ${toPost.length} to post.`);

  let next: IngestState = { ...nextState, lastRunAt: now, lastError: undefined };
  let failures = 0;
  for (const r of toPost) {
    try {
      console.log(`Loading ${r.code} (${r.title})…`);
      const data = await loadReport(r.code, wcl.accessToken);
      const shareId = dryRun ? "dry-run" : await publishSnapshotTo(apiBase, data);
      const message = buildShareMessage({
        title: r.title, zoneName: r.zone?.name ?? "", details: raidSummary(r),
        link: shareUrlFor(webOrigin || "https://example.invalid", shareId),
      });
      if (dryRun) console.log(`--- would post ---\n${message}\n------------------`);
      else await postToDiscord(webhookUrl, message);
      next = markPosted(next, r.code, shareId);
      if (!dryRun) console.log(`Posted ${r.code} → /s/${shareId}`);
    } catch (e) {
      failures++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Failed ${r.code}: ${msg}`);
      next = { ...next, lastError: `${r.code}: ${msg}` };
    }
  }

  if (dryRun) console.log("Dry run — state not saved:", JSON.stringify(next, null, 2));
  else await stateRequest(apiBase, ingestToken, { method: "PUT", body: JSON.stringify(next) });

  // Go red only on systemic breakage, not one bad log (it's retried next run).
  if (toPost.length > 0 && failures === toPost.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
