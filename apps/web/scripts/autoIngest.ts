/// <reference types="node" />
// Scheduled auto-ingest (run by .github/workflows/auto-ingest.yml every 15 min):
// find the guild's newly finished WCL logs, publish each as a key-free snapshot
// and post its /s/<shareId> link to Discord. Reuses the browser pipeline as-is —
// Node 22 has fetch/btoa/CompressionStream — with a dedicated service WCL key.
//
//   pnpm --filter @wcl/web ingest [--dry-run] [--since=2026-10-20] [--quiet-minutes=30] [--recheck-seconds=120]
//
// Each run looks back LOOKBACK_HOURS (default 48) — raids are often uploaded
// the morning after — and posts every finished log there not posted before.
// --since replaces that window's start. --dry-run loads the reports and prints
// the Discord messages, but publishes, posts and saves nothing.
import { fetchToken, fetchGuildReports, type GuildReport } from "../src/lib/wcl/wcl";
import { loadReport } from "../src/lib/wcl/loadReport";
import { publishSnapshotTo, shareUrlFor } from "../src/lib/shareCore";
import { buildShareMessage, isValidWebhookUrl, postToDiscord } from "../src/lib/discord";
import { initialState, markPosted, planIngest, unchanged, type IngestState } from "./ingestPlan";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const dryRun = args.includes("--dry-run");
const quietMs = Number(flag("quiet-minutes") ?? 30) * 60_000;
const recheckMs = Number(flag("recheck-seconds") ?? 120) * 1000;
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

  const lookbackHours = Number(env("LOOKBACK_HOURS", false) || 48);
  const now = Date.now();
  const since = sinceOverride ?? now - lookbackHours * 3_600_000;
  const saved = apiBase && ingestToken
    ? await (await stateRequest(apiBase, ingestToken)).json() as Partial<IngestState> | null
    : null;
  if (!saved) console.log("No saved state — every finished raid in the window will be posted.");
  // Only `posted` carries over (older state versions also stored since/pending).
  const state: IngestState = { ...initialState(), posted: saved?.posted ?? {} };

  const wcl = await fetchToken(env("WCL_CLIENT_ID"), env("WCL_CLIENT_SECRET"));
  const reports = await fetchGuildReports(guildId, since, wcl.accessToken);
  const plan = planIngest(reports, state, now, quietMs);
  const { nextState } = plan;
  let { toPost } = plan;
  console.log(`Guild ${guildId}: ${reports.length} report(s) since ${new Date(since).toISOString()}, `
    + `${toPost.length} finished and not yet posted.`);

  // A log caught mid-upload also looks finished (its events are hours old), so
  // list again shortly and only post logs that didn't grow in between.
  if (toPost.length > 0 && recheckMs > 0) {
    console.log(`Re-checking in ${recheckMs / 1000}s that they're fully uploaded…`);
    await new Promise((resolve) => setTimeout(resolve, recheckMs));
    const stable = unchanged(toPost, await fetchGuildReports(guildId, since, wcl.accessToken));
    for (const r of toPost) if (!stable.includes(r)) console.log(`${r.code} is still uploading — next run.`);
    toPost = stable;
  }

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
