import { randomUUID } from "node:crypto";
import type { ReportData } from "@wcl/core";

// Storage seam for published, key-free report snapshots. The in-memory adapter
// is for local dev; swap createMemoryShareStore for a serverless KV/file/DB
// adapter at deploy time (TODO #14) without touching the HTTP layer.
export interface ShareStore {
  put(data: ReportData): Promise<string>;
  get(id: string): Promise<ReportData | null>;
}

export function createMemoryShareStore(): ShareStore {
  const map = new Map<string, ReportData>();
  return {
    async put(data) { const id = randomUUID().replace(/-/g, "").slice(0, 12); map.set(id, data); return id; },
    async get(id) { return map.get(id) ?? null; },
  };
}
