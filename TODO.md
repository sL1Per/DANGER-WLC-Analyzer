 # ROADMAP / TODO

## New features / todo

- [DONE] Publish-snapshot sharing model: `POST /api/share` stores a key-free ReportData snapshot; `GET /api/share/:id` retrieves it. The viewer route `/s/:shareId` loads it via `fetchSnapshot` and renders `ReportView` read-only (no WCL credentials, no Refresh). Production snapshot storage (Cloudflare KV/R2) deferred to #14.
- (1) Remove as many npm dependencies as possible
- (2) Clean up
- (3) Security review
- (4) Deploy Online FREE
  - The production `ShareStore` adapter (Cloudflare KV/R2) must add auth, size cap, eviction policy, and rate-limiting. The current dev in-memory `POST /api/share` is an open, unbounded write endpoint — acceptable locally, not in production.
- totem twist tracker (https://www.warcraftlogs.com/reports/GPAaJQBnF19VLft4?fight=65&type=casts&source=15 // https://www.warcraftlogs.com/reports/GPAaJQBnF19VLft4?fight=65&type=casts&source=28)

## Changes

- Player view, summary cards needs some review

## Bugs
