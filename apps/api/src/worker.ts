import type { ExecutionContext } from "hono";
import type { KVNamespace } from "@cloudflare/workers-types";
import { createApp } from "./app";
import { createKvShareStore } from "./shareStore";
import { createKvIngestStore } from "./ingestStore";
import { dispatchIngest } from "./dispatchIngest";

// Cloudflare Workers entry point. The Node entry (server.ts) is unused here;
// this wires the same Hono app to a KV-backed store and locks CORS to the
// deployed web origin. Bindings come from wrangler.jsonc / dashboard vars.
// Request/Response/ExecutionContext stay in Hono's (DOM) type world so the
// app.fetch handoff typechecks without Cloudflare's Request/Response globals.
export interface Env {
  /** KV namespace holding published, key-free report snapshots. */
  SHARE_KV: KVNamespace;
  /** The web app's origin, so /api/* CORS is not "*" in production. */
  WEB_ORIGIN?: string;
  /** Secret (`wrangler secret put INGEST_TOKEN`) the auto-ingest job sends as a
   *  bearer token. Unset → /api/ingest/* is disabled. */
  INGEST_TOKEN?: string;
  /** Secret: fine-grained GitHub token (this repo only, "Actions: write") the
   *  cron trigger uses to start the auto-ingest workflow. Unset → no dispatch. */
  GITHUB_DISPATCH_TOKEN?: string;
  /** "owner/repo" whose auto-ingest workflow the cron trigger starts. */
  GITHUB_REPO?: string;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    const app = createApp(createKvShareStore(env.SHARE_KV), {
      corsOrigin: env.WEB_ORIGIN,
      ingestToken: env.INGEST_TOKEN,
      ingestStore: createKvIngestStore(env.SHARE_KV),
    });
    return app.fetch(request, env, ctx);
  },

  // Cron Trigger (wrangler.jsonc "triggers"): start the auto-ingest workflow.
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await dispatchIngest({ token: env.GITHUB_DISPATCH_TOKEN, repo: env.GITHUB_REPO });
  },
};
