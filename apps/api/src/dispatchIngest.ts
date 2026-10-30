// Cloudflare Cron Trigger → GitHub: start the auto-ingest workflow. GitHub's
// own `schedule` is best-effort and was observed running every 4–7 h instead of
// every 15 min; Cloudflare cron fires on time. The Worker only makes this one
// API call — the actual ingest still runs in GitHub Actions — so it fits the
// free plan's CPU budget. The workflow's concurrency group serializes runs, so
// overlapping triggers can't post a raid twice.

export interface DispatchConfig {
  /** Fine-grained GitHub token for this repo only, with "Actions: write". */
  token?: string;
  /** "owner/repo" */
  repo?: string;
  workflow?: string;
  ref?: string;
}

/** Returns false (and does nothing) when the token or repo isn't configured. */
export async function dispatchIngest(cfg: DispatchConfig, fetchFn: typeof fetch = fetch): Promise<boolean> {
  if (!cfg.token || !cfg.repo) {
    console.log("auto-ingest dispatch skipped: GITHUB_DISPATCH_TOKEN or GITHUB_REPO not set");
    return false;
  }
  const workflow = cfg.workflow ?? "auto-ingest.yml";
  const res = await fetchFn(`https://api.github.com/repos/${cfg.repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      // GitHub rejects API requests without a User-Agent.
      "User-Agent": "danger-wlc-analyzer-api",
      "Content-Type": "application/json",
    },
    // Manual runs default to dry_run=true in the workflow; timer runs are live.
    body: JSON.stringify({ ref: cfg.ref ?? "main", inputs: { dry_run: "false" } }),
  });
  if (!res.ok) throw new Error(`GitHub workflow dispatch failed (HTTP ${res.status}): ${await res.text()}`);
  return true;
}
