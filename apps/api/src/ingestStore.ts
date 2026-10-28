import type { KVNamespace } from "@cloudflare/workers-types";

// Storage seam for the scheduled auto-ingest job's state (which guild reports it
// has already posted to Discord). One small JSON document; unlike snapshots it
// must not expire, or the job would re-post old raids.
export interface IngestStore {
  get(): Promise<string | null>;
  put(json: string): Promise<void>;
}

const KEY = "ingest:state";

export function createMemoryIngestStore(): IngestStore {
  let value: string | null = null;
  return {
    async get() { return value; },
    async put(json) { value = json; },
  };
}

export function createKvIngestStore(kv: KVNamespace): IngestStore {
  return {
    async get() { return kv.get(KEY, "text"); },
    async put(json) { await kv.put(KEY, json); },
  };
}
