import type { ReportData } from "@wcl/core";
import { ApiError } from "./api";

// Empty in dev → relative "/api/..." hits the Vite proxy. In production the API
// is a separate Worker on its own origin, so set VITE_API_BASE at build time to
// that origin, e.g. https://danger-wlc-api.<sub>.workers.dev. Trailing slashes
// are stripped so `${API_BASE}/api/share` never becomes a route-breaking
// "//api/share" (which misses the /api/* CORS handler → browser CORS error).
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

// A full raid report serializes to tens of MB — past Cloudflare KV's 25 MiB
// per-value ceiling and the API's upload limit — so we gzip in the browser
// before upload (~10x on JSON) and decompress shared snapshots on read. The API
// is a pure pass-through that stores/serves these gzip bytes as-is.
//
// Drive the (De)CompressionStream via its writer/reader rather than Blob.stream()
// or Response(stream): those aren't uniformly implemented across the browser and
// the jsdom test env, whereas Web Streams are.
async function pump(
  input: Uint8Array,
  transform: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> },
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = transform.writable.getWriter();
  void writer.write(input as BufferSource);
  void writer.close();
  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

async function gzip(text: string): Promise<Uint8Array<ArrayBuffer>> {
  return pump(new TextEncoder().encode(text), new CompressionStream("gzip"));
}

async function gunzip(buf: ArrayBuffer): Promise<string> {
  return new TextDecoder().decode(await pump(new Uint8Array(buf), new DecompressionStream("gzip")));
}

// Defensive strip at the publish boundary: a published snapshot is shared
// key-free, so never upload credential-like fields even if a caller's ReportData
// somehow carried them. (The API stores opaque bytes and can't do this itself.)
function stripCredentials(data: ReportData): ReportData {
  const { clientId, clientSecret, accessToken, ...rest } = data as unknown as Record<string, unknown>;
  void clientId; void clientSecret; void accessToken;
  return rest as unknown as ReportData;
}

export async function publishSnapshot(data: ReportData): Promise<string> {
  const body = await gzip(JSON.stringify(stripCredentials(data)));
  const res = await fetch(`${API_BASE}/api/share`, {
    method: "POST",
    headers: { "Content-Type": "application/gzip" },
    body,
  });
  if (!res.ok) throw new ApiError(res.status, "Could not publish this report for sharing.");
  return (await res.json() as { shareId: string }).shareId;
}

export async function fetchSnapshot(shareId: string): Promise<ReportData> {
  const res = await fetch(`${API_BASE}/api/share/${shareId}`);
  if (!res.ok) throw new ApiError(res.status, "This shared report could not be found.");
  return JSON.parse(await gunzip(await res.arrayBuffer())) as ReportData;
}

export function shareUrl(shareId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/s/${shareId}`;
}
