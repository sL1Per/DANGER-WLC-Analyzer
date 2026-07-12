import type { ExecutionContext } from "hono";
import type { KVNamespace } from "@cloudflare/workers-types";
import { createApp } from "./app";
import { createKvShareStore } from "./shareStore";

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
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    const app = createApp(createKvShareStore(env.SHARE_KV), { corsOrigin: env.WEB_ORIGIN });
    return app.fetch(request, env, ctx);
  },
};
