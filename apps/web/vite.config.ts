import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app version shown in the footer comes from the root package.json — the one
// place it's bumped on release (see CHANGELOG.md).
const rootPkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(rootPkg.version) },
  server: { proxy: { "/api": "http://localhost:8787" } },
});
