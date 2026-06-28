import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 8787);
// Set WEB_ORIGIN in production (e.g. https://your-app.example) to lock CORS down.
const app = createApp(undefined, { corsOrigin: process.env.WEB_ORIGIN });
serve({ fetch: app.fetch, port });
console.log(`Snapshot store listening on http://localhost:${port}`);
