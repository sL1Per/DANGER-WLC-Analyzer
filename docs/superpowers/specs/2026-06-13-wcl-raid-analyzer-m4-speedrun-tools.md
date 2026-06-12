# M4 — CLA Speedrun Tools (validate · shadow resi · fight timeline)

Date: 2026-06-13
Status: Approved (design), pending implementation plan
Supersedes: extends `2026-06-11-wcl-raid-analyzer-design.md` (M4 section)

## Goal

Add the three remaining CLA tabs to the rebuilt analyzer:

1. **`validate`** — speedrun-log validation against per-zone trash/boss/starting-point
   requirements.
2. **`shadow resi`** — per-player Shadow Resistance breakdown (gear + enchants + buffs)
   for the three SR-relevant bosses.
3. **`fight timeline`** — side-by-side pull-by-pull timing comparison of **two** logs.

All three build on the existing architecture (pure `packages/core` analysis →
`apps/web` tab view → curated `packages/data`) and the M3 conventions (optional
`ReportData` fields so pre-M4 cached reports degrade gracefully with a refresh
notice; hand-curated reference data with Wowhead-verified provenance flags;
severity color coding via the shared `sev-*` classes).

Build order: **validate → shadow resi → fight timeline** (timeline last, because its
two-report comparison is the one piece that steps outside the single-report model).

## Non-goals

- No change to the single-report `/report/<id>` cache/share model except the additive
  second-report fetch the timeline needs (it reuses the existing endpoint and cache).
- No RPB work (M5). No Discord/dark-mode/deploy (M6).
- Shadow resi does **not** introduce an official SR pass/fail threshold (the original
  has none) — see Tool 2 severity.

## ReportData additions

All optional, so reports cached before M4 still load (web shows the existing
"refresh for new tabs" notice when a field is absent):

- `npcKills?: Record<string, number>` — enemy **gameID → kill count** across the
  filtered fights. Source for validate's "how many killed?".
- `GearSnapshot.auras?: number[]` — spell ids present in the player's combatantInfo
  `auras` array at boss pull. Source for shadow-resi "SR from buffs" (no extra event
  fetch; consistent with "gear/buffs known only at boss pull").

Fight timeline needs **no** new field — it reuses `fights[]` (each already carries
`name`, `startTime`, `endTime`, `isBoss`, `kill`) and a second fully-normalized
`ReportData` fetched via the existing endpoint.

## Tool 1 — `validate`

### Reference data (`packages/data`)

New module `validateRules` (TS with provenance comments, mirroring
`consumables.ts`), exported as a per-zone structure:

```ts
interface ZoneValidation {
  zone: string;                 // "SW" | "MH" | "BT" | "ZA" | ...
  trash: TrashRequirement[];    // { name, npcIds: number[], minKills, verified }
  boss: BossRequirement;        // single { count } OR split { count1,label1,count2,label2 }
  startingPointNpcIds: number[];// valid first-pull NPC gameIds
  verified: boolean;            // false until a human checks vs. WCL speedrun rules
}
```

- **SW** trash requirements come from the xlsx sample (already in
  `trash-requirements.json`; folded into the new structure) and are `verified: true`.
- **MH / BT / ZA** are **curated now** from current community speedrun rules
  (NPC ids, min-kills, boss counts, starting points). Every curated non-SW rule
  carries `verified: false`, and the data file documents the source and date so a
  human can confirm later. (Existing `trash-requirements.json` is migrated into this
  module; the standalone JSON is removed or re-derived from it.)
- The **MH+BT split boss rule** (the xlsx shows "5 for MH and 9 for BT necessary")
  uses the split `BossRequirement` form.

### Core

`validate(report: ReportData, opts?: { zoneOverride?: string }): ValidateResult`

- Zone auto-detected from `report.zoneName` (mapped to the short code), overridable
  via `zoneOverride`.
- For each trash requirement: `killed = Σ npcKills[id] for id in npcIds`;
  `enough = killed >= minKills`.
- Boss count: number of boss **kills** in `fights` (single rule) or split across the
  two combined zones (split rule); compared to required count(s).
- Valid starting point: true if the report's **first pull** (earliest fight) contains
  one of `startingPointNpcIds` (via that fight's enemy NPCs / first kills).
- Total characters used = `report.players.length`.
- Overall verdict = all trash requirements met **and** boss count met **and** valid
  starting point.

```ts
interface ValidateResult {
  zone: string;
  zoneVerified: boolean;        // surface "unverified rules" badge when false
  trash: { name: string; minKills: number; killed: number; enough: boolean; severity: IssueSeverity }[];
  bosses: { required: string; killed: number; enough: boolean; severity: IssueSeverity }; // "required" renders single or split text
  validStartingPoint: boolean;
  totalCharacters: number;
  isValid: boolean;             // overall verdict
}
```

### API

Fetch enemy kill counts → `npcKills`. **Probe first** (`pnpm --filter @wcl/api probe
<code>`) to choose the reliable WCL v2 source before committing:

- Candidate A: `report.table(dataType: Deaths, ...)` and count enemy death rows.
- Candidate B: death `events` mapped to `masterData.actors[].gameID`.
- Candidate C: `fights[].enemyNPCs` (note: `instanceCount` ≈ appeared, not killed —
  likely insufficient on its own).

Kill counting must respect the active fight filter (trash/bosses/no-wipes/fight id/
range), consistent with the other tabs.

### Severity / UI

- Trash row + boss row: `sev-ok` (green) when met, `sev-major` (red) when not.
- Overall verdict: green/red banner.
- When `zoneVerified` is false, show an "unverified speedrun rules — check against WCL"
  badge on the tab.
- `<SeverityLegend />` as on every tab.

## Tool 2 — `shadow resi`

### Reference data (`packages/data`)

Two hand-curated modules (M3 style — Wowhead-verified, provenance + `verified` flags):

- `shadowResEnchants: Record<enchantId, number>` — permanent-enchant SR
  (e.g. cloak Greater Shadow Resistance +15, boots +X).
- `shadowResBuffs: Record<spellId, number>` — aura SR (e.g. Shadow Protection 70,
  Shadow Resistance Aura, Prayer of Shadow Protection, Shadow Protection Potion).
  Where multiple ranks exist, map each rank id to its value.

Item **innate** SR already lives in `item-shadow-res.json` (the `(~30 SR)` values;
"~" denotes presumed SR rolls on random-enchant items — preserved in display).

### Core

`shadowResistance(report, { boss }): ShadowResResult`

- `boss ∈ { MotherShahraz, Kazrogal, Azgalor }`; default = first available of the three.
- Select the fight to analyze: the **kill**; if no kill, the **longest wipe** of that boss.
- Per player with a gear snapshot on that fight:
  - `srFromGear = Σ (itemShadowRes[itemId] || 0) + (shadowResEnchants[permanentEnchantId] || 0)` over the 17 slots.
  - `srFromBuffs = Σ shadowResBuffs[spellId]` over `snapshot.auras` (dedup so only the
    best rank of a given buff counts; baseline raid case ≈ 70).
  - `total = srFromGear + srFromBuffs`.
  - Per-slot contribution string: `"<ItemName> (~<itemSR> SR)"` when the item has innate
    SR, and/or `"+<enchantSR> SR"` when the enchant adds SR (matching the xlsx format,
    e.g. `Night's End (~40 SR) +15 SR`).

```ts
interface ShadowResResult {
  boss: string;
  fightId: number;
  isKill: boolean;
  players: {
    playerId: number; name: string;
    total: number; fromGear: number; fromBuffs: number;
    slots: Record<number, string>; // slot id → contribution text (omit empty)
    severity: IssueSeverity;       // advisory; see below
  }[];
}
```

### Severity / UI

- Columns mirror the xlsx: player, total (C), from-gear (D), from-buffs (E), then the
  17 slot columns (Head … Wand/Idol/Relic) with contribution text.
- **Advisory severity only:** color `total` against a documented **soft** target,
  explicitly labelled "advisory, not an official threshold" so we don't invent a rule
  the original lacks. (Soft target chosen during implementation; e.g. green at/above a
  commonly-cited comfortable value, yellow below, red far below.)
- Caveats surfaced (from CLAUDE.md): talents/abilities not counted; random-enchant
  items presumed SR; priest/mage buff SR may be missing (Blizzard logging issue).
- Boss selector + kill/longest-wipe note (e.g. "kill in 167s"); `<SeverityLegend />`.

## Tool 3 — `fight timeline` (built last)

### Web

- The report page gains a **second-report input** (path or report id).
- On submit, the web fetches `/api/report/:id2` (reuses the OAuth proxy + 24h cache;
  keyless viewers can still compare two already-cached reports).
- Renders the two timelines side by side, matching the xlsx layout.

### Core

`compareTimelines(a: ReportData, b: ReportData): TimelineComparison`

- For each report independently, produce an ordered pull list from `fights` (after the
  active filter): `{ name, idle, start, duration, end }` where
  `idle = thisFight.start − previousFight.end` (first pull idle = null/“---”),
  `duration = end − start`, times rendered `hh:mm:ss` relative to report start.
- Boss rows additionally get a cumulative **time difference** between the two logs,
  matched by **boss identity** (encounter id / name), as in the xlsx `G`/`H` columns.
- Total idle per log.
- Rows are **independent per column** (the two logs may differ in pull order/count);
  only boss rows are cross-matched for the difference.

```ts
interface TimelinePull { name: string; isBoss: boolean; idle: number | null; start: number; duration: number; end: number; }
interface TimelineComparison {
  a: { title: string; pulls: TimelinePull[]; totalIdle: number };
  b: { title: string; pulls: TimelinePull[]; totalIdle: number };
  bossDiffs: { boss: string; cumulativeDiff: number }[]; // matched by identity
}
```

### Severity / UI

- Idle time colored by magnitude (long idle → `sev-major`); boss diff colored by sign
  (ahead = green, behind = red).
- Empty/absent second report → prompt to enter one; second report failing to load uses
  the existing report-error states.

## Testing

- **core:** fixture-driven unit tests per tool. Extend `report.fixture.ts` with
  `npcKills`, `GearSnapshot.auras`, and add a second-report fixture for timeline.
  Cross-check validate kill counts against the SW xlsx sample and shadow-resi totals
  against the xlsx sample numbers (e.g. Player2 = 210 total / 140 gear / 70 buffs).
- **api:** integration test for the new kill-count fetch with mocked WCL (token +
  GraphQL), asserting `npcKills` respects the fight filter.
- **web:** one smoke test per new tab (validate, shadow resi, timeline).

## Known unknowns / risks

- **Validate rules drift:** community speedrun rules change; curated non-SW zones are
  `verified: false` and badged in the UI. SW is the only sample-verified zone.
- **NPC kill source:** exact WCL v2 query for kill counts is probe-confirmed before
  implementation (Deaths table vs. death events vs. enemyNPCs).
- **Shadow-resi buff coverage:** priest/mage SR buffs can be missing from logs
  (Blizzard issue) — surfaced as a caveat, not corrected.
- **Starting-point definition:** approximated as "first pull contains a valid start
  NPC"; the official rule list is external and may be richer.

## Provenance note

The originals' validate rules, SR enchant/buff values, and SR item DB lived in Shariva's
Apps Script (not exported in the xlsx) — only the SW validate sample, the per-zone mob
**name** lists (`trans` cols W–AA), and the item-SR DB (`shadow resistance config`) are in
the workbook. Curated additions follow the M3 precedent: hand-built, Wowhead/community
verified, provenance- and `verified`-flagged.
