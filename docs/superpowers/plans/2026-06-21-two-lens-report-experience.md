# Two-Lens Report Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/web`'s separate CLA/RPB destinations with one report experience that toggles between a **By Boss Fight** lens (pick a pull, see everyone) and a **By Player** lens (pick a raider, see everything), wired to the existing `@wcl/core` analyses and styled to the handoff's dark raid aesthetic.

**Architecture:** A single `/report/:reportId` route holds a report shell (`ReportHeader` + `LensBar` + a category/profile area). Selection lives in the URL (`?lens=&fight=&player=&cat=&q=`). Per-pull views re-scope the existing report-wide analyses by passing them a report whose `fights` array is filtered to one boss fight (`scopeReportToFight`) — no core changes. The By-Player profile re-projects the same outputs keyed by player. Theming is done entirely through the existing CSS-variable system in `theme.css`/`index.css`.

**Tech Stack:** React 19, react-router-dom 6.28 (`useSearchParams`, `Navigate`), TypeScript, Vitest + React Testing Library, pnpm workspace.

## Global Constraints

- **No changes** to `packages/core`, `packages/data`, or `apps/api` (or their tests). View-layer only.
- **Do not** port the prototype's mock-data generators. Wire to real `@wcl/core` functions.
- Selection state (lens/fight/player/cat/query) lives in the **URL** so links stay shareable.
- Dark theme = the handoff README palette; the existing **light theme stays functional** (same CSS vars, not pixel-matched).
- Reuse `lib/classColors.ts`, `lib/heatmap.ts`, `lib/parseColor.ts`, `SeverityLegend`, and the `sev-*` / `parse-*` CSS classes. Map README hexes onto existing vars rather than introducing parallel color systems.
- Older caches: when `rpb()` / `drums()` / `rpbConsumables()` / `consumables()` return `null` or `report.rankings` is `undefined`, show the existing "cached before X — Refresh from WCL" notice.
- Tests run from `apps/web/`. Per-file: `npx vitest run <path>`; single test: `npx vitest run <path> -t "<name>"`. Typecheck: `npx tsc -b`. Full web suite: `pnpm test` (in `apps/web`).
- TBC class colors lightened **in dark only**: Priest `#E6E7EC`, Shaman `#3D8BEF`, Warlock `#9A86D6`.
- Numeric/id/duration text uses `--font-mono` (JetBrains Mono); headings/brand use `--font-display` (Marcellus); body uses Archivo via `--font-sans`.

---

### Task 1: Theme foundation — palette, fonts, dark class colors

**Files:**
- Modify: `apps/web/index.html` (add font `<link>`s)
- Modify: `apps/web/src/theme.css` (fonts + dark palette tokens + dark class-color vars)
- Modify: `apps/web/src/index.css` (apply display/mono fonts; map heat tokens)
- Modify: `apps/web/src/lib/classColors.ts` (drive `classColorVar` through CSS vars so dark can override)
- Test: `apps/web/src/lib/classColors.test.ts` (extend existing)

**Interfaces:**
- Produces: `classColorVar(className)` returns `{ "--class-color": "var(--cc-<slug>)" }`; new helper `classSlug(className): string` (lowercased class, unknown → `"neutral"`). `classColor(className)` unchanged (returns light hex, still used for non-CSS contexts).
- Produces (CSS): dark tokens `--accent-gold`, `--accent-gold-grad`, `--on-accent`, `--font-display`, `--font-mono`; README role accents `--role-tank/-healer/-caster/-physical`; README parse + heat hexes layered onto existing `--parse-*`, `--danger*`, `--warn*`, `--positive*`.

- [ ] **Step 1: Write the failing test** — append to `apps/web/src/lib/classColors.test.ts`:

```ts
import { classColorVar, classSlug } from "./classColors";

describe("classColorVar via CSS vars", () => {
  it("references the per-class CSS variable, not a raw hex", () => {
    expect(classColorVar("Mage")).toEqual({ "--class-color": "var(--cc-mage)" });
  });
  it("maps unknown classes to the neutral slug", () => {
    expect(classSlug("Tinkerer")).toBe("neutral");
    expect(classColorVar("Tinkerer")).toEqual({ "--class-color": "var(--cc-neutral)" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/web/`: `npx vitest run src/lib/classColors.test.ts`
Expected: FAIL — `classSlug` is not exported; `classColorVar` returns a hex.

- [ ] **Step 3: Implement** — edit `apps/web/src/lib/classColors.ts`, replacing `classColorVar` and adding `classSlug`:

```ts
const KNOWN = new Set((CLASS_ORDER as readonly string[]).map((c) => c.toLowerCase()));

/** CSS-var slug for a class, e.g. "Mage" → "mage"; unknown → "neutral". */
export function classSlug(className: string): string {
  const s = className.toLowerCase();
  return KNOWN.has(s) ? s : "neutral";
}

/**
 * Inline style exposing the class color as the `--class-color` custom property.
 * It points at a per-class CSS variable (`--cc-<slug>`) defined in theme.css so
 * dark mode can lighten individual classes without per-class JS branches.
 */
export function classColorVar(className: string): CSSProperties {
  return { "--class-color": `var(--cc-${classSlug(className)})` } as CSSProperties;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/web/`: `npx vitest run src/lib/classColors.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the font links** — in `apps/web/index.html`, inside `<head>` after the viewport meta:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Marcellus&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 6: Add font + class-color vars to `:root`** — in `apps/web/src/theme.css`, inside the existing `:root { ... }` add to the `/* type */` group:

```css
  --font-display: "Marcellus", var(--font-serif);
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  /* per-class colors (light theme = canonical WoW hexes) */
  --cc-warrior: #c79c6e; --cc-paladin: #f58cba; --cc-hunter: #abd473;
  --cc-rogue: #d6c100; --cc-priest: #6a6a72; --cc-shaman: #0070de;
  --cc-mage: #2796c4; --cc-warlock: #6a5bbf; --cc-druid: #d96b00;
  --cc-neutral: #8a93a3;
```

> Note: light-theme class hexes are darkened slightly from the on-screen WoW colors so they stay legible on the light canvas; dark theme (next step) uses the bright/README values.

- [ ] **Step 7: Add the README dark palette** — in `apps/web/src/theme.css`, inside `:root[data-theme="dark"] { ... }` append:

```css
  /* raid aesthetic — canvas & panels (README) */
  --canvas: #0c0d11;
  --surface: #101218;
  --surface-sunken: #13151c;
  --border: #1c1f29;
  --hairline: #181b23;

  --text: #e8e9ee;
  --text-muted: #9aa0ac;
  --text-subtle: #6f7480;

  /* gold accent (primary action) */
  --accent-gold: #d4a84a;
  --accent-gold-grad: linear-gradient(150deg, #d4a84a, #a8842e);
  --on-accent: #1a1206;
  --primary: #d4a84a;
  --primary-hover: #e0b860;
  --primary-tint: #211a0c;

  /* severity heatmap (README) */
  --danger: #f0908f;  --danger-bg: rgba(214, 90, 90, 0.16);  --danger-border: #5a2d27;
  --warn: #e6bd56;    --warn-bg: rgba(214, 168, 60, 0.14);
  --positive: #7fd6a0; --positive-bg: rgba(91, 191, 134, 0.13);

  /* parse-percentile scale (README) */
  --parse-common: #8b909d;   --parse-uncommon: #5bbf5b; --parse-rare: #4a9eff;
  --parse-epic: #b06bf0;     --parse-legendary: #ff8a3d; --parse-astounding: #e87fb0;
  --parse-artifact: #e6c87d;

  /* role accents */
  --role-tank: #d4a84a; --role-healer: #5bbf86; --role-caster: #9a86d6; --role-physical: #e0894a;

  /* class colors lightened for the dark canvas (README) */
  --cc-warrior: #c79c6e; --cc-paladin: #f58cba; --cc-hunter: #abd473;
  --cc-rogue: #fff569;  --cc-priest: #e6e7ec;  --cc-shaman: #3d8bef;
  --cc-mage: #69ccf0;   --cc-warlock: #9a86d6; --cc-druid: #ff7d0a;
  --cc-neutral: #9aa0ac;
```

- [ ] **Step 8: Apply display/mono fonts** — in `apps/web/src/index.css`: the headings already use `--font-serif` (lines ~79/208/216). Change those `font-family: var(--font-serif);` rules for `h1, h2, h3, h4` and `.sidebar__title` to `font-family: var(--font-display);`. Add a mono utility near the table rules:

```css
.mono, td.mono, .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
```

- [ ] **Step 9: Verify build + suite**

Run from `apps/web/`: `npx vitest run src/lib/classColors.test.ts` → PASS. Then `npx tsc -b` → no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/web/index.html apps/web/src/theme.css apps/web/src/index.css apps/web/src/lib/classColors.ts apps/web/src/lib/classColors.test.ts
git commit -m "feat(web): dark raid theme tokens, fonts, per-class CSS vars"
```

---

### Task 2: `scopeReportToFight` projection helper

**Files:**
- Create: `apps/web/src/lib/scopeReport.ts`
- Test: `apps/web/src/lib/scopeReport.test.ts`

**Interfaces:**
- Produces: `scopeReportToFight(report: ReportData, fightId: number): ReportData` — returns a shallow copy with `fights` filtered to the single matching fight; all other fields (events, `playerTotals`, `rankings`, `gear`, `itemMeta`) preserved by reference.

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/scopeReport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reportFixture } from "@wcl/core";
import { scopeReportToFight } from "./scopeReport";

describe("scopeReportToFight", () => {
  it("keeps only the chosen fight but preserves every other field by reference", () => {
    const report = reportFixture();
    const target = report.fights.find((f) => f.isBoss)!;
    const scoped = scopeReportToFight(report, target.id);

    expect(scoped.fights).toEqual([target]);
    expect(scoped.players).toBe(report.players);
    expect(scoped.playerTotals).toBe(report.playerTotals);
    expect(scoped.gear).toBe(report.gear);
    expect(scoped).not.toBe(report);
  });

  it("yields an empty fights array for an unknown id", () => {
    const report = reportFixture();
    expect(scopeReportToFight(report, -1).fights).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/lib/scopeReport.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/lib/scopeReport.ts`:

```ts
import type { ReportData } from "@wcl/core";

/**
 * A report projected to a single fight. The per-pull views ("By Boss Fight")
 * pass this to the report-wide analyses (`rpb`, `consumables`, `rpbConsumables`,
 * `drums`) which derive their fight set from `report.fights` — so filtering that
 * array re-scopes them to one pull. Every other field (event arrays, playerTotals
 * used for role detection, rankings, gear, itemMeta) is preserved unchanged.
 */
export function scopeReportToFight(report: ReportData, fightId: number): ReportData {
  return { ...report, fights: report.fights.filter((f) => f.id === fightId) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/lib/scopeReport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/scopeReport.ts apps/web/src/lib/scopeReport.test.ts
git commit -m "feat(web): scopeReportToFight projection helper"
```

---

### Task 3: Shared analysis config

**Files:**
- Create: `apps/web/src/lib/analysisConfig.ts`
- Test: `apps/web/src/lib/analysisConfig.test.ts`

**Interfaces:**
- Produces:
  - `buildRpbConfig(): RpbConfig` — the same object `RpbView` builds inline today.
  - `consumablesConfig: ConsumableConfig` — for `consumables(report, consumablesConfig)`.
  - `rpbConsumableSpecs: RpbConsumableSpec[]` (re-export of `@wcl/data`'s catalog).
  - `drumConfig: DrumConfig` and `gearIssueConfig: GearIssueConfig`.

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/analysisConfig.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reportFixture, rpb, consumables } from "@wcl/core";
import { buildRpbConfig, consumablesConfig } from "./analysisConfig";

describe("analysisConfig", () => {
  it("buildRpbConfig drives a successful rpb() run", () => {
    const out = rpb(reportFixture(), buildRpbConfig());
    expect(out).not.toBeNull();
    expect(out!.rows.length).toBeGreaterThan(0);
  });
  it("consumablesConfig drives a successful consumables() run", () => {
    expect(consumables(reportFixture(), consumablesConfig)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/lib/analysisConfig.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/lib/analysisConfig.ts`:

```ts
import type { RpbConfig, ConsumableConfig, DrumConfig, GearIssueConfig } from "@wcl/core";
import {
  spellCastTimes, roleSignals, casterClasses, hasteBuffs,
  engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
  rpbConsumables as rpbConsumableSpecsData,
  consumableBuffs, jcNecks, suboptimalConsumables, weaponEnhancementEnchantIds,
  drumSpells,
  badEnchants, excludedItems, gemQuality, itemShadowRes, itemSockets,
} from "@wcl/data";

/** RPB config — identical to the object RpbView built inline; centralised so the
 *  Performance view, By-Player profile, and per-fight scoped runs share one source. */
export function buildRpbConfig(): RpbConfig {
  return {
    roles: { signals: roleSignals, casterClasses },
    activity: { castTimes: spellCastTimes, hasteBuffs, aoeWindowMs: 500 },
    engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
    classAbilities, avoidableAbilityIds,
  };
}

export const consumablesConfig: ConsumableConfig = {
  buffs: consumableBuffs,
  jcNecks,
  suboptimal: suboptimalConsumables,
  weaponEnhancements: weaponEnhancementEnchantIds,
};

export const drumConfig: DrumConfig = { drums: drumSpells };

export const rpbConsumableSpecs = rpbConsumableSpecsData;

/** Default gear-issue config, matching GearListingView's inline settings. */
export const gearIssueConfig: GearIssueConfig = {
  minGemQuality: 3, excludeShahraz: false, listNoIssues: false,
  itemSockets, gemQuality, itemShadowRes, badEnchants, excludedItems,
};
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/lib/analysisConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/analysisConfig.ts apps/web/src/lib/analysisConfig.test.ts
git commit -m "feat(web): centralise @wcl/core analysis config"
```

---

### Task 4: Player presentation rollups

**Files:**
- Create: `apps/web/src/lib/playerRollups.ts`
- Test: `apps/web/src/lib/playerRollups.test.ts`

**Interfaces:**
- Produces:
  - `type ConsumablesStatus = "full" | "partial" | "missing"`
  - `consumablesStatus(row: ConsumableRow | undefined): ConsumablesStatus`
  - `statusHeat(s: ConsumablesStatus): Heat` (`full→good`, `partial→watch`, `missing→bad`)
  - `type Verdict = "exemplary" | "solid" | "attention" | "concern"`
  - `verdict(row: RpbRow, gearFlags: number): { key: Verdict; label: string; heat: Heat; note: string }`

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/playerRollups.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ConsumableRow, RpbRow } from "@wcl/core";
import { consumablesStatus, statusHeat, verdict } from "./playerRollups";

const cons = (o: Partial<ConsumableRow>): ConsumableRow => ({
  playerId: 1, playerName: "P", elixirOrFlask: 0, battleElixir: 0, guardianElixir: 0,
  flask: 0, food: 0, scrolls: "", scrollUptime: 0, weaponEnhancement: 0,
  jcNeck: { usedOnFights: 0, inactiveOnFights: 0, equipped: false },
  suboptimal: [], totalAverage: 0, ...o,
} as ConsumableRow);

const rpbRow = (o: Partial<RpbRow>): RpbRow => ({
  playerId: 1, playerName: "P", className: "Mage", role: "caster", deaths: 0,
  interruptedSpells: 0, interruptSources: [], totalAbsorbed: 0, friendlyFire: 0,
  damageReflected: 0, damageToHostilePlayers: 0, totalAvoidableDamageTaken: 0,
  totalPartlyAvoidable: 0, classRows: [], engineeringDamage: 0, oilOfImmolationDamage: 0,
  battleShoutUptime: 0, activity: null, severity: "ok", ...o,
} as RpbRow);

describe("consumablesStatus", () => {
  it("missing when nothing was consumed", () => {
    expect(consumablesStatus(cons({}))).toBe("missing");
    expect(consumablesStatus(undefined)).toBe("missing");
  });
  it("full when elixir/flask, food and weapon are all high", () => {
    expect(consumablesStatus(cons({ elixirOrFlask: 1, food: 0.95, weaponEnhancement: 1 }))).toBe("full");
  });
  it("full ignores weapon enhancement when there is no gear snapshot (null)", () => {
    expect(consumablesStatus(cons({ elixirOrFlask: 0.95, food: 0.95, weaponEnhancement: null }))).toBe("full");
  });
  it("partial when some but not all disciplines are kept", () => {
    expect(consumablesStatus(cons({ elixirOrFlask: 1, food: 0, weaponEnhancement: 0 }))).toBe("partial");
  });
});

describe("statusHeat", () => {
  it("maps statuses to heat buckets", () => {
    expect(statusHeat("full")).toBe("good");
    expect(statusHeat("partial")).toBe("watch");
    expect(statusHeat("missing")).toBe("bad");
  });
});

describe("verdict", () => {
  it("concern on a death", () => {
    expect(verdict(rpbRow({ deaths: 2, severity: "major" }), 0).key).toBe("concern");
  });
  it("attention on a moderate severity or gear flags", () => {
    expect(verdict(rpbRow({ severity: "moderate" }), 0).key).toBe("attention");
    expect(verdict(rpbRow({ severity: "ok" }), 3).key).toBe("attention");
  });
  it("exemplary when clean", () => {
    expect(verdict(rpbRow({ severity: "ok" }), 0).key).toBe("exemplary");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/lib/playerRollups.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/lib/playerRollups.ts`:

```ts
import type { ConsumableRow, RpbRow } from "@wcl/core";
import type { Heat } from "./heatmap";

export type ConsumablesStatus = "full" | "partial" | "missing";

const HIGH = 0.9; // uptime fraction considered "kept"

/**
 * Consumable discipline rollup from the buff-consumables analysis. A discipline
 * counts as kept at >=90% boss-fight uptime. Weapon enhancement is skipped when
 * there is no gear snapshot to judge it (null). "Full" = every applicable
 * discipline kept; "missing" = none kept and nothing consumed; else "partial".
 */
export function consumablesStatus(row: ConsumableRow | undefined): ConsumablesStatus {
  if (!row) return "missing";
  const disciplines: number[] = [row.elixirOrFlask, row.food];
  if (row.weaponEnhancement !== null) disciplines.push(row.weaponEnhancement);
  const kept = disciplines.filter((d) => d >= HIGH).length;
  if (kept === disciplines.length) return "full";
  if (kept === 0 && row.totalAverage === 0) return "missing";
  return "partial";
}

export function statusHeat(s: ConsumablesStatus): Heat {
  return s === "full" ? "good" : s === "partial" ? "watch" : "bad";
}

export type Verdict = "exemplary" | "solid" | "attention" | "concern";

/** One-line player verdict from the RPB row severity plus death/gear-flag counts. */
export function verdict(
  row: RpbRow,
  gearFlags: number,
): { key: Verdict; label: string; heat: Heat; note: string } {
  if (row.deaths > 0 || row.severity === "major") {
    return { key: "concern", label: "Major concerns", heat: "bad",
      note: row.deaths > 0 ? `Died ${row.deaths}× on boss fights.` : "Tracked issues need attention." };
  }
  if (row.severity === "moderate" || gearFlags > 0) {
    return { key: "attention", label: "Needs attention", heat: "watch",
      note: gearFlags > 0 ? `${gearFlags} gear flag${gearFlags === 1 ? "" : "s"} to review.` : "Some metrics below par." };
  }
  if (row.severity === "minor") {
    return { key: "solid", label: "Solid", heat: "good", note: "Minor things only — solid night." };
  }
  return { key: "exemplary", label: "Exemplary", heat: "good", note: "No tracked issues. Clean log." };
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/lib/playerRollups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playerRollups.ts apps/web/src/lib/playerRollups.test.ts
git commit -m "feat(web): consumables-status + verdict presentation rollups"
```

---

### Task 5: `ReportHeader`

**Files:**
- Create: `apps/web/src/components/ReportHeader.tsx`
- Test: `apps/web/src/components/ReportHeader.test.tsx`
- Modify: `apps/web/src/index.css` (append `.report-header` rules — see Step 5)

**Interfaces:**
- Consumes: `ReportData` (for title/zone/players/startTime), `loadCredentials` (to gate Refresh).
- Produces: `ReportHeader({ report, onRefresh }: { report: ReportData; onRefresh?: () => void })`. Renders brand lockup (Link to `/`), report identity, `SeverityLegend`, and Settings (Link `/settings`) / New report (Link `/`) / Refresh buttons. Refresh button rendered only when `loadCredentials() !== null` and `onRefresh` is provided.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/ReportHeader.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { reportFixture } from "@wcl/core";
import { ReportHeader } from "./ReportHeader";

vi.mock("../lib/storage", async (orig) => ({
  ...(await orig<typeof import("../lib/storage")>()),
  loadCredentials: () => ({ clientId: "a", clientSecret: "b" }),
}));

describe("ReportHeader", () => {
  it("shows report identity and the nav buttons", () => {
    const report = reportFixture();
    render(
      <MemoryRouter>
        <ReportHeader report={report} onRefresh={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText(report.title)).toBeInTheDocument();
    expect(screen.getByText(report.zoneName, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: /refresh from wcl/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/components/ReportHeader.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/components/ReportHeader.tsx`:

```tsx
import type { ReportData } from "@wcl/core";
import { Link } from "react-router-dom";
import { loadCredentials } from "../lib/storage";
import { SeverityLegend } from "./SeverityLegend";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString();

export function ReportHeader({ report, onRefresh }: { report: ReportData; onRefresh?: () => void }) {
  const canRefresh = onRefresh && loadCredentials() !== null;
  return (
    <header className="report-header">
      <Link to="/" className="report-header__brand">
        <span className="report-header__mark" aria-hidden>W</span>
        <span>
          <span className="report-header__title">Raid Analyzer</span>
          <span className="report-header__subtitle">TBC Classic · Combat Log Analytics</span>
        </span>
      </Link>

      <div className="report-header__identity">
        <strong>{report.title}</strong>
        <span className="mono">{report.zoneName} · {report.players.length} players · {fmtDate(report.startTime)}</span>
      </div>

      <div className="report-header__actions">
        <SeverityLegend />
        <Link to="/settings" className="btn-outline">Settings</Link>
        <Link to="/" className="btn-outline">New report</Link>
        {canRefresh && <button className="btn-outline" onClick={onRefresh}>Refresh from WCL</button>}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/components/ReportHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Append CSS** — add to `apps/web/src/index.css`:

```css
/* ── report shell ─────────────────────────────────────────── */
.report-header {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; gap: 18px;
  padding: 14px 28px; background: var(--surface-sunken);
  border-bottom: 1px solid var(--border);
}
.report-header__brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); }
.report-header__mark {
  width: 38px; height: 38px; display: grid; place-items: center;
  border-radius: 9px; background: var(--accent-gold-grad, var(--primary));
  color: var(--on-accent, #fff); font-family: var(--font-display); font-size: 20px;
}
.report-header__title { display: block; font-family: var(--font-display); font-size: 19px; }
.report-header__subtitle { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-subtle); }
.report-header__identity { display: flex; flex-direction: column; gap: 2px; padding-left: 18px; border-left: 1px solid var(--border); }
.report-header__identity .mono { font-size: 12px; color: var(--text-muted); }
.report-header__actions { display: flex; align-items: center; gap: 10px; margin-left: auto; flex-wrap: wrap; }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ReportHeader.tsx apps/web/src/components/ReportHeader.test.tsx apps/web/src/index.css
git commit -m "feat(web): sticky report header"
```

---

### Task 6: `LensBar` (lens toggle + fight chips + roster)

**Files:**
- Create: `apps/web/src/components/LensBar.tsx`
- Test: `apps/web/src/components/LensBar.test.tsx`
- Modify: `apps/web/src/index.css` (append `.lens-bar` rules — Step 5)

**Interfaces:**
- Consumes: `ReportData`; `classColorVar`, `classSlug` (Task 1); `CLASS_ORDER`.
- Produces:
  - `type Lens = "fight" | "player"`
  - `LensBar(props)` where
    ```ts
    interface LensBarProps {
      report: ReportData;
      lens: Lens;
      fightId: number | null;
      playerId: number | null;
      query: string;
      onLens: (l: Lens) => void;
      onFight: (id: number) => void;
      onPlayer: (id: number) => void;
      onQuery: (q: string) => void;
    }
    ```
  - Helper `bossFights(report): Fight[]` (exported) = `report.fights.filter(f => f.isBoss)`.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/LensBar.test.tsx`:

```tsx
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { LensBar } from "./LensBar";

function setup(over: Partial<ComponentProps<typeof LensBar>> = {}) {
  const report = reportFixture();
  const props = {
    report, lens: "fight" as const, fightId: report.fights.find((f) => f.isBoss)!.id,
    playerId: report.players[0].id, query: "",
    onLens: vi.fn(), onFight: vi.fn(), onPlayer: vi.fn(), onQuery: vi.fn(), ...over,
  };
  render(<LensBar {...props} />);
  return props;
}

describe("LensBar", () => {
  it("toggles to the player lens", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /by player/i }));
    expect(p.onLens).toHaveBeenCalledWith("player");
  });
  it("selects a fight chip", () => {
    const p = setup();
    const boss = p.report.fights.find((f) => f.isBoss)!;
    fireEvent.click(screen.getAllByText(boss.name)[0]);
    expect(p.onFight).toHaveBeenCalledWith(boss.id);
  });
  it("renders the roster search in the player lens", () => {
    setup({ lens: "player" });
    expect(screen.getByPlaceholderText(/filter raiders/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/components/LensBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/components/LensBar.tsx`:

```tsx
import type { Fight, ReportData } from "@wcl/core";
import { CLASS_ORDER, classColorVar, classSlug } from "../lib/classColors";

export type Lens = "fight" | "player";

export function bossFights(report: ReportData): Fight[] {
  return report.fights.filter((f) => f.isBoss);
}

const secs = (f: Fight) => `${Math.round((f.endTime - f.startTime) / 1000)}s`;
const classRank = (c: string) => {
  const i = (CLASS_ORDER as readonly string[]).indexOf(c);
  return i === -1 ? CLASS_ORDER.length : i;
};

interface LensBarProps {
  report: ReportData;
  lens: Lens;
  fightId: number | null;
  playerId: number | null;
  query: string;
  onLens: (l: Lens) => void;
  onFight: (id: number) => void;
  onPlayer: (id: number) => void;
  onQuery: (q: string) => void;
}

export function LensBar({ report, lens, fightId, playerId, query, onLens, onFight, onPlayer, onQuery }: LensBarProps) {
  const players = [...report.players]
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => classRank(a.class) - classRank(b.class) || a.name.localeCompare(b.name));

  return (
    <div className="lens-bar">
      <div className="lens-toggle" role="group" aria-label="Report lens">
        <button className={lens === "fight" ? "active" : ""} onClick={() => onLens("fight")}>By Boss Fight</button>
        <button className={lens === "player" ? "active" : ""} onClick={() => onLens("player")}>By Player</button>
        <span className="lens-hint">
          {lens === "fight"
            ? "Reviewing one boss pull — everyone who was there."
            : "Reviewing one raider — everything they did, all night."}
        </span>
      </div>

      {lens === "fight" ? (
        <div className="lens-strip">
          {bossFights(report).map((f) => (
            <button
              key={f.id}
              className={`fight-chip${f.id === fightId ? " selected" : ""}`}
              onClick={() => onFight(f.id)}
            >
              <span className="fight-chip__name">{f.name}</span>
              <span className={`pill ${f.kill ? "pill--kill" : "pill--wipe"}`}>{f.kill ? "Kill" : "Wipe"}</span>
              <span className="mono fight-chip__meta">{secs(f)} · {report.players.length} players</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="lens-roster">
          <input
            className="roster-search"
            placeholder="Filter raiders…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Filter raiders"
          />
          <div className="lens-strip">
            {players.map((p) => (
              <button
                key={p.id}
                className={`player-chip cc-${classSlug(p.class)}${p.id === playerId ? " selected" : ""}`}
                style={classColorVar(p.class)}
                onClick={() => onPlayer(p.id)}
              >
                <span className="class-dot" /> {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/components/LensBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Append CSS** — add to `apps/web/src/index.css`:

```css
/* ── lens bar ─────────────────────────────────────────────── */
.lens-bar { position: sticky; top: 67px; z-index: 20; background: var(--canvas); padding: 14px 28px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 12px; }
.lens-toggle { display: flex; align-items: center; gap: 12px; }
.lens-toggle > button { padding: 7px 16px; border-radius: 9px; border: 1px solid transparent; background: transparent; color: var(--text-muted); cursor: pointer; font-weight: 600; }
.lens-toggle > button.active { background: var(--accent-gold-grad, var(--primary)); color: var(--on-accent, #fff); border-color: var(--accent-gold, var(--primary)); }
.lens-hint { font-size: 12px; color: var(--text-subtle); }
.lens-strip { display: flex; flex-wrap: wrap; gap: 8px; }
.fight-chip { min-width: 170px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-sunken); color: var(--text); cursor: pointer; }
.fight-chip.selected { border-color: var(--accent-gold, var(--primary)); background: var(--primary-tint); }
.fight-chip__name { font-weight: 600; }
.fight-chip__meta { font-size: 11px; color: var(--text-muted); }
.pill { font-size: 11px; padding: 1px 7px; border-radius: 6px; }
.pill--kill { color: var(--positive); background: var(--positive-bg); }
.pill--wipe { color: var(--danger); background: var(--danger-bg); }
.lens-roster { display: flex; flex-direction: column; gap: 10px; }
.roster-search { max-width: 240px; }
.player-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface-sunken); color: var(--text); cursor: pointer; }
.player-chip.selected { border-color: var(--class-color); background: var(--primary-tint); }
.player-chip .class-dot { background: var(--class-color); box-shadow: 0 0 6px var(--class-color); }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/LensBar.tsx apps/web/src/components/LensBar.test.tsx apps/web/src/index.css
git commit -m "feat(web): lens bar with fight chips and roster"
```

---

### Task 7: `SummaryRankings` (default category)

**Files:**
- Create: `apps/web/src/components/report/SummaryRankings.tsx`
- Test: `apps/web/src/components/report/SummaryRankings.test.tsx`
- Modify: `apps/web/src/index.css` (append `.rank-table` rules — Step 5)

**Interfaces:**
- Consumes: `buildRankingsGrid`, `report.rankings`; `parseClass`; `classColorVar`.
- Produces: `SummaryRankings({ report, onPlayer }: { report: ReportData; onPlayer: (name: string) => void })`. Adds an **Avg** column (the grid's `player.overall`, rounded) sorted desc; numeric cells colored via `parseClass`. Player names are buttons calling `onPlayer(name)`. Shows the refresh notice when `report.rankings` is undefined; "No ranked boss kills" when the grid is null.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/report/SummaryRankings.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { SummaryRankings } from "./SummaryRankings";

describe("SummaryRankings", () => {
  it("renders an Avg column and role group headers", () => {
    render(<SummaryRankings report={reportFixture()} onPlayer={() => {}} />);
    expect(screen.getByText("Avg")).toBeInTheDocument();
    expect(screen.getByText(/Damage Dealers/i)).toBeInTheDocument();
  });
  it("clicking a player name calls onPlayer", () => {
    const onPlayer = vi.fn();
    const report = reportFixture();
    render(<SummaryRankings report={report} onPlayer={onPlayer} />);
    const name = report.rankings![0].dps[0].name;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
    expect(onPlayer).toHaveBeenCalledWith(name);
  });
  it("shows the refresh notice when rankings are absent", () => {
    const report = { ...reportFixture(), rankings: undefined };
    render(<SummaryRankings report={report} onPlayer={() => {}} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
```

> If `reportFixture().rankings` is empty, the click test falls back to the refresh path — adjust the assertion to the available fixture data when implementing; keep the Avg-column and refresh-notice assertions regardless.

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/components/report/SummaryRankings.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/components/report/SummaryRankings.tsx`:

```tsx
import { buildRankingsGrid, type RankingsRole, type ReportData } from "@wcl/core";
import { classColorVar } from "../../lib/classColors";
import { parseClass } from "../../lib/parseColor";

const ROLE_LABEL: Record<RankingsRole, string> = {
  dps: "Damage Dealers", healers: "Healers", tanks: "Tanks",
};

export function SummaryRankings({ report, onPlayer }: { report: ReportData; onPlayer: (name: string) => void }) {
  if (report.rankings === undefined) {
    return <p className="notice">This report was cached before parse rankings — Refresh from WCL (requires credentials).</p>;
  }
  const grid = buildRankingsGrid(report.rankings);
  if (!grid) return <p className="notice">No ranked boss kills in this report.</p>;

  return (
    <div className="summary-rankings">
      <p className="intro">Each cell is the WarcraftLogs parse percentile for that boss. Higher = better; colors follow the WCL scale. Rows are sorted by season-average parse.</p>
      {grid.sections.map((section) => (
        <section key={section.role} className="card">
          <h3>{ROLE_LABEL[section.role]}</h3>
          <div className="scroll-x">
            <table className="rank-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Avg</th>
                  {grid.bosses.map((b) => <th key={b.fightID}>{b.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {section.players.map((p) => (
                  <tr key={p.name}>
                    <td className="player-cell" style={classColorVar(p.class)}>
                      <span className="class-dot" aria-hidden />
                      <button className="player-link" onClick={() => onPlayer(p.name)}>{p.name}</button>
                    </td>
                    <td className={`mono ${parseClass(p.overall)}`}><strong>{Math.round(p.overall)}</strong></td>
                    {grid.bosses.map((b) => {
                      const cell = p.perBoss[b.fightID];
                      return cell
                        ? <td key={b.fightID} className={`mono ${parseClass(cell.rankPercent)}`}>{cell.rankPercent}</td>
                        : <td key={b.fightID} className="sev-neutral">—</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/components/report/SummaryRankings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Append CSS** — add to `apps/web/src/index.css`:

```css
.intro, .notice { color: var(--text-muted); font-size: 13px; margin: 0 0 14px; }
.notice { color: var(--warn); }
.player-link { background: none; border: none; padding: 0; color: inherit; font: inherit; cursor: pointer; text-align: left; }
.player-link:hover { text-decoration: underline; }
.rank-table th:first-child, .rank-table td:first-child { position: sticky; left: 0; background: var(--surface); }
.rank-table thead th { text-transform: uppercase; font-size: 11px; letter-spacing: .04em; color: var(--text-subtle); }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/report/SummaryRankings.tsx apps/web/src/components/report/SummaryRankings.test.tsx apps/web/src/index.css
git commit -m "feat(web): summary rankings category"
```

---

### Task 8: `PerformanceView` (the hero, per-pull)

**Files:**
- Create: `apps/web/src/components/report/PerformanceView.tsx`
- Test: `apps/web/src/components/report/PerformanceView.test.tsx`
- Modify: `apps/web/src/index.css` (append `.perf-*` rules — Step 5)

**Interfaces:**
- Consumes: `scopeReportToFight` (Task 2); `buildRpbConfig`, `consumablesConfig`, `gearIssueConfig` (Task 3); `consumablesStatus`, `statusHeat` (Task 4); `rpb`, `consumables`, `gearIssues`; `relativeHeat`, `deathsHeat`, `uptimeHeat`, `heatClass`; `classColorVar`.
- Produces: `PerformanceView({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void })`. Runs the fight-scoped `rpb`/`consumables`/`gearIssues`, renders a summary banner + role sections (order: tank, healer, caster, physical), columns Player · Spec · Deaths · Avoidable · Interrupts · Uptime · Consumables · Gear flags. Avoidable & Uptime use `relativeHeat` across the fight's rows. Interrupts show "—" for tank/healer. Refresh notice when `rpb()` returns null.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/report/PerformanceView.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { PerformanceView } from "./PerformanceView";

describe("PerformanceView", () => {
  const report = reportFixture();
  const fightId = report.fights.find((f) => f.isBoss)!.id;

  it("renders the column headers and at least one role section", () => {
    render(<PerformanceView report={report} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getAllByText("Deaths").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Avoidable dmg").length).toBeGreaterThan(0);
  });
  it("navigates on player click", () => {
    const onPlayer = vi.fn();
    render(<PerformanceView report={report} fightId={fightId} onPlayer={onPlayer} />);
    fireEvent.click(screen.getAllByRole("button", { name: report.players[0].name })[0]);
    expect(onPlayer).toHaveBeenCalled();
  });
  it("shows a refresh notice when RPB data is missing", () => {
    const bare = { ...report, playerTotals: undefined };
    render(<PerformanceView report={bare} fightId={fightId} onPlayer={() => {}} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/components/report/PerformanceView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/components/report/PerformanceView.tsx`:

```tsx
import { useMemo } from "react";
import {
  rpb, consumables, gearIssues, type ReportData, type Role, type RpbRow,
} from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { buildRpbConfig, consumablesConfig, gearIssueConfig } from "../../lib/analysisConfig";
import { consumablesStatus, statusHeat, type ConsumablesStatus } from "../../lib/playerRollups";
import { heatClass, relativeHeat, deathsHeat, uptimeHeat, type Heat } from "../../lib/heatmap";
import { classColorVar } from "../../lib/classColors";

const ROLE_ORDER: Role[] = ["tank", "healer", "caster", "physical"];
const ROLE_LABEL: Record<Role, string> = { tank: "Tanks", healer: "Healers", caster: "Casters", physical: "Melee & Ranged" };
const STATUS_LABEL: Record<ConsumablesStatus, string> = { full: "Full", partial: "Partial", missing: "Missing" };
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function PerformanceView({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
  const fight = report.fights.find((f) => f.id === fightId);
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);

  const result = useMemo(() => rpb(scoped, buildRpbConfig()), [scoped]);
  const consRows = useMemo(() => consumables(scoped, consumablesConfig)?.rows ?? [], [scoped]);
  const gearFlags = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of gearIssues(scoped, gearIssueConfig)) {
      map.set(r.playerId, r.issues.filter((i) => i.itemId !== 0).length);
    }
    return map;
  }, [scoped]);

  if (result === null) {
    return <p className="notice">This report was cached before RPB support — Refresh from WCL (requires credentials).</p>;
  }
  const rows = result.rows;
  const consByPlayer = new Map(consRows.map((c) => [c.playerId, c]));

  // relative scales across this pull's raid
  const avoid = rows.map((r) => r.totalAvoidableDamageTaken);
  const aMin = Math.min(...avoid, 0), aMax = Math.max(...avoid, 0);
  const upt = rows.map((r) => r.activity?.relativeActiveST ?? 0);
  const uMin = Math.min(...upt, 0), uMax = Math.max(...upt, 0);

  const underConsumed = rows.filter((r) => consumablesStatus(consByPlayer.get(r.playerId)) !== "full").length;
  const totalDeaths = rows.reduce((s, r) => s + r.deaths, 0);
  const totalFlags = [...gearFlags.values()].reduce((s, n) => s + n, 0);

  const heat = (h: Heat) => heatClass(h);

  return (
    <div className="perf">
      <div className="perf-banner">
        <h2>{fight?.name ?? "Boss"}</h2>
        {fight && <span className={`pill ${fight.kill ? "pill--kill" : "pill--wipe"}`}>{fight.kill ? "Kill" : "Wipe"}</span>}
        <div className="perf-stats mono">
          <span>Duration {fight ? `${Math.round((fight.endTime - fight.startTime) / 1000)}s` : "—"}</span>
          <span className={heat(deathsHeat(totalDeaths))}>Deaths {totalDeaths}</span>
          <span className={heat(underConsumed > 0 ? "watch" : "good")}>Under-consumed {underConsumed}</span>
          <span className={heat(totalFlags > 0 ? "watch" : "good")}>Gear flags {totalFlags}</span>
        </div>
      </div>

      {ROLE_ORDER.map((role) => {
        const group = rows.filter((r) => r.role === role);
        if (group.length === 0) return null;
        return (
          <section key={role} className="card perf-role">
            <h3 className="role-band" data-role={role}>{ROLE_LABEL[role]} <span className="role-count">{group.length}</span></h3>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Player</th><th>Spec</th><th>Deaths</th><th>Avoidable dmg</th>
                    <th>Interrupts</th><th>Uptime</th><th>Consumables</th><th>Gear flags</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((r) => {
                    const status = consumablesStatus(consByPlayer.get(r.playerId));
                    const flags = gearFlags.get(r.playerId) ?? 0;
                    const noInterrupts = r.role === "tank" || r.role === "healer";
                    const u = r.activity?.relativeActiveST ?? null;
                    return (
                      <tr key={r.playerId}>
                        <td className="player-cell" style={classColorVar(r.className)}>
                          <span className="class-dot" />
                          <button className="player-link" onClick={() => onPlayer(r.playerName)}>{r.playerName}</button>
                        </td>
                        <td>{specOf(r)}</td>
                        <td className={heat(deathsHeat(r.deaths))}>{r.deaths}</td>
                        <td className={`mono ${heat(relativeHeat(aMax - r.totalAvoidableDamageTaken, 0, aMax - aMin))}`}>
                          {r.totalAvoidableDamageTaken.toLocaleString()}
                        </td>
                        <td className={noInterrupts ? "sev-neutral" : "mono"}>{noInterrupts ? "—" : r.interruptedSpells}</td>
                        <td className={u === null ? "sev-neutral" : `mono ${heat(relativeHeat(u, uMin, uMax))}`}>
                          {u === null ? "—" : pct(u)}
                        </td>
                        <td className={heat(statusHeat(status))}>{STATUS_LABEL[status]}</td>
                        <td className={heat(flags > 0 ? "bad" : "good")}>{flags}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Spec isn't on RpbRow; surface it from rankings when resolvable, else the class. */
function specOf(r: RpbRow): string {
  return r.className;
}
```

> Note on Avoidable heat: lower avoidable damage is better, so the value is inverted (`aMax - value`) before `relativeHeat` so the lowest taker lands green. Uptime is already higher-is-better. `specOf` returns the class as a safe fallback; Task 12 wires real spec from `report.rankings` where both views need it — keep this fallback here to avoid passing rankings into every row.

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/components/report/PerformanceView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Append CSS** — add to `apps/web/src/index.css`:

```css
.perf-banner { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.perf-banner h2 { font-family: var(--font-display); font-size: 24px; margin: 0; }
.perf-stats { display: flex; gap: 16px; margin-left: auto; font-size: 13px; }
.perf-role { margin-bottom: 18px; }
.role-band { display: flex; align-items: center; gap: 8px; padding-left: 10px; border-left: 3px solid var(--role-caster); }
.role-band[data-role="tank"] { border-color: var(--role-tank); }
.role-band[data-role="healer"] { border-color: var(--role-healer); }
.role-band[data-role="caster"] { border-color: var(--role-caster); }
.role-band[data-role="physical"] { border-color: var(--role-physical); }
.role-count { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: var(--surface-sunken); color: var(--text-muted); }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/report/PerformanceView.tsx apps/web/src/components/report/PerformanceView.test.tsx apps/web/src/index.css
git commit -m "feat(web): per-pull performance view"
```

---

### Task 9: `GearMatrix` (per-pull, 8 slots)

**Files:**
- Create: `apps/web/src/components/report/GearMatrix.tsx`
- Test: `apps/web/src/components/report/GearMatrix.test.tsx`

**Interfaces:**
- Consumes: `gearListing`, `gearIssues`, `SLOT_NAMES`, `SEVERITY_RANK`, `type IssueSeverity`; `gearIssueConfig` (Task 3); `classColorVar`.
- Produces: `GearMatrix({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void })`. Wide table with sticky player column; 8 columns from `PROFILE_GEAR_SLOTS = [0,1,2,14,4,9,6,15]`; flagged cells get `sev-<severity>` + a `title` reason.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/report/GearMatrix.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { GearMatrix } from "./GearMatrix";

describe("GearMatrix", () => {
  it("renders the eight slot headers", () => {
    const report = reportFixture();
    const fightId = report.gear[0]?.fightId ?? report.fights.find((f) => f.isBoss)!.id;
    render(<GearMatrix report={report} fightId={fightId} onPlayer={() => {}} />);
    for (const label of ["Head", "Neck", "Shoulders", "Cloak", "Chest", "Hands", "Legs", "Weapon"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/components/report/GearMatrix.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/components/report/GearMatrix.tsx`:

```tsx
import { useMemo } from "react";
import {
  gearIssues, gearListing, SLOT_NAMES, SEVERITY_RANK, type IssueSeverity, type ReportData,
} from "@wcl/core";
import { gearIssueConfig } from "../../lib/analysisConfig";
import { classColorVar } from "../../lib/classColors";

const PROFILE_GEAR_SLOTS = [0, 1, 2, 14, 4, 9, 6, 15]; // Head Neck Shoulders Cloak Chest Hands Legs Weapon

export function GearMatrix({ report, fightId, onPlayer }: { report: ReportData; fightId: number; onPlayer: (name: string) => void }) {
  const { fight, rows } = useMemo(() => gearListing(report, fightId), [report, fightId]);

  const issues = useMemo(() => {
    const map = new Map<number, Map<number, { severity: IssueSeverity; reason: string }>>();
    if (!fight) return map;
    const sub = { ...report, gear: report.gear.filter((g) => g.fightId === fight.id) };
    for (const r of gearIssues(sub, gearIssueConfig)) {
      const byItem = new Map<number, { severity: IssueSeverity; reason: string }>();
      for (const i of r.issues) {
        if (i.itemId === 0) continue;
        const prev = byItem.get(i.itemId);
        if (!prev || SEVERITY_RANK[i.severity] > SEVERITY_RANK[prev.severity]) byItem.set(i.itemId, { severity: i.severity, reason: i.issue });
      }
      map.set(r.playerId, byItem);
    }
    return map;
  }, [report, fight]);

  const classOf = new Map(report.players.map((p) => [p.id, p.class]));

  if (!fight) return <p className="notice">No gear data for this pull (combatantInfo missing).</p>;

  return (
    <div className="scroll-x">
      <table className="gear-matrix">
        <thead>
          <tr><th>Player</th>{PROFILE_GEAR_SLOTS.map((s) => <th key={s}>{SLOT_NAMES[s]}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId}>
              <td className="player-cell" style={classColorVar(classOf.get(r.playerId) ?? "")}>
                <span className="class-dot" />
                <button className="player-link" onClick={() => onPlayer(r.playerName)}>{r.playerName}</button>
              </td>
              {PROFILE_GEAR_SLOTS.map((s) => {
                const item = r.items[s];
                const flag = item ? issues.get(r.playerId)?.get(item.itemId) : undefined;
                return (
                  <td key={s} className={flag ? `sev-${flag.severity}` : undefined} title={flag?.reason}>
                    {item?.name ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/components/report/GearMatrix.test.tsx`
Expected: PASS. The sticky-column CSS reuses `.rank-table` patterns; add `.gear-matrix th:first-child, .gear-matrix td:first-child { position: sticky; left: 0; background: var(--surface); }` to `index.css` if not already covered.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/report/GearMatrix.tsx apps/web/src/components/report/GearMatrix.test.tsx apps/web/src/index.css
git commit -m "feat(web): per-pull gear matrix"
```

---

### Task 10: Scoped Consumables & Drums category wrappers

**Files:**
- Create: `apps/web/src/components/report/ConsumablesCategory.tsx`
- Create: `apps/web/src/components/report/DrumsCategory.tsx`
- Test: `apps/web/src/components/report/ConsumablesCategory.test.tsx`

**Interfaces:**
- Consumes: `scopeReportToFight`; `rpbConsumables`, `rpbConsumableSpecs`; existing `ConsumableMatrix`; existing `DrumsView`.
- Produces:
  - `ConsumablesCategory({ report, fightId }: { report: ReportData; fightId: number })` — runs `rpbConsumables` on the scoped report and renders the existing `ConsumableMatrix` (`rows` + `catalog`), or the refresh notice when null.
  - `DrumsCategory({ report, fightId }: { report: ReportData; fightId: number })` — renders the existing `DrumsView` with the scoped report.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/report/ConsumablesCategory.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { ConsumablesCategory } from "./ConsumablesCategory";

describe("ConsumablesCategory", () => {
  it("renders the consumable matrix for the scoped fight", () => {
    const report = reportFixture();
    const fightId = report.fights.find((f) => f.isBoss)!.id;
    render(<ConsumablesCategory report={report} fightId={fightId} />);
    // matrix renders a table; at least one consumable catalog label appears
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("shows the refresh notice when player casts are missing", () => {
    const report = { ...reportFixture(), playerCasts: undefined };
    const fightId = report.fights.find((f) => f.isBoss)!.id;
    render(<ConsumablesCategory report={report} fightId={fightId} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/components/report/ConsumablesCategory.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/components/report/ConsumablesCategory.tsx`:

```tsx
import { useMemo } from "react";
import { rpbConsumables, type ReportData } from "@wcl/core";
import { rpbConsumableSpecs } from "../../lib/analysisConfig";
import { scopeReportToFight } from "../../lib/scopeReport";
import { ConsumableMatrix } from "../ConsumableMatrix";

export function ConsumablesCategory({ report, fightId }: { report: ReportData; fightId: number }) {
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);
  const result = useMemo(() => rpbConsumables(scoped, rpbConsumableSpecs), [scoped]);

  if (result === null) {
    return <p className="notice">This report was cached before consumable support — Refresh from WCL (requires credentials).</p>;
  }
  const catalog = rpbConsumableSpecs.map((s) => ({ key: s.key, name: s.name }));
  return (
    <div>
      <p className="intro">Each row is one consumable; each column a raider. Cells are colored relative to the heaviest user on this pull — red means they used it least.</p>
      <ConsumableMatrix rows={result.rows} catalog={catalog} />
    </div>
  );
}
```

`apps/web/src/components/report/DrumsCategory.tsx`:

```tsx
import { useMemo } from "react";
import type { ReportData } from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { DrumsView } from "../DrumsView";

export function DrumsCategory({ report, fightId }: { report: ReportData; fightId: number }) {
  const scoped = useMemo(() => scopeReportToFight(report, fightId), [report, fightId]);
  return <DrumsView report={scoped} />;
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/components/report/ConsumablesCategory.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/report/ConsumablesCategory.tsx apps/web/src/components/report/DrumsCategory.tsx apps/web/src/components/report/ConsumablesCategory.test.tsx
git commit -m "feat(web): scoped consumables + drums categories"
```

---

### Task 11: `PlayerProfile` (By-Player lens)

**Files:**
- Create: `apps/web/src/components/report/PlayerProfile.tsx`
- Test: `apps/web/src/components/report/PlayerProfile.test.tsx`
- Modify: `apps/web/src/index.css` (append `.profile-*` rules — Step 5)

**Interfaces:**
- Consumes: `scopeReportToFight`; `buildRpbConfig`, `consumablesConfig`, `gearIssueConfig`; `verdict`, `consumablesStatus`, `statusHeat`; `rpb`, `consumables`, `gearListing`, `gearIssues`, `listGearFights`, `SLOT_NAMES`; `heatmap` helpers; `classColorVar`, `classSlug`.
- Produces: `PlayerProfile({ report, playerId }: { report: ReportData; playerId: number })`. Header (avatar + name + class·spec·role + verdict pill + note), stat tiles, two-column body (per-boss table + consumables list | gear panel). Refresh notice when `rpb()` null.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/report/PlayerProfile.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reportFixture } from "@wcl/core";
import { PlayerProfile } from "./PlayerProfile";

describe("PlayerProfile", () => {
  it("renders the player's name and the stat tiles", () => {
    const report = reportFixture();
    const player = report.players[0];
    render(<PlayerProfile report={report} playerId={player.id} />);
    expect(screen.getByRole("heading", { name: new RegExp(player.name) })).toBeInTheDocument();
    expect(screen.getByText(/Deaths/i)).toBeInTheDocument();
    expect(screen.getByText(/Gear flags/i)).toBeInTheDocument();
  });
  it("shows a refresh notice when RPB data is missing", () => {
    const report = { ...reportFixture(), playerTotals: undefined };
    render(<PlayerProfile report={report} playerId={report.players[0].id} />);
    expect(screen.getByText(/refresh from wcl/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/components/report/PlayerProfile.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `apps/web/src/components/report/PlayerProfile.tsx`:

```tsx
import { useMemo } from "react";
import {
  rpb, consumables, gearListing, gearIssues, listGearFights, SLOT_NAMES,
  type ReportData, type RpbRow,
} from "@wcl/core";
import { scopeReportToFight } from "../../lib/scopeReport";
import { buildRpbConfig, consumablesConfig, gearIssueConfig } from "../../lib/analysisConfig";
import { consumablesStatus, statusHeat, verdict } from "../../lib/playerRollups";
import { heatClass, deathsHeat, uptimeHeat } from "../../lib/heatmap";
import { classColorVar, classSlug } from "../../lib/classColors";

const PROFILE_GEAR_SLOTS = [0, 1, 2, 14, 4, 9, 6, 15];
const pct = (n: number) => `${Math.round(n * 100)}%`;
const initials = (name: string) => name.slice(0, 2).toUpperCase();

export function PlayerProfile({ report, playerId }: { report: ReportData; playerId: number }) {
  const player = report.players.find((p) => p.id === playerId);
  const cfg = useMemo(() => buildRpbConfig(), []);
  const result = useMemo(() => rpb(report, cfg), [report, cfg]);
  const consRow = useMemo(
    () => consumables(report, consumablesConfig)?.rows.find((c) => c.playerId === playerId),
    [report, playerId],
  );
  const bossFights = useMemo(() => report.fights.filter((f) => f.isBoss), [report]);

  // per-boss numbers: scoped rpb per fight, read this player's row
  const perBoss = useMemo(() => bossFights.map((f) => {
    const out = rpb(scopeReportToFight(report, f.id), cfg);
    const row = out?.rows.find((r) => r.playerId === playerId);
    return { fight: f, row };
  }), [report, cfg, playerId, bossFights]);

  const gearFightId = useMemo(() => {
    const fights = listGearFights(report);
    return fights[fights.length - 1]?.id;
  }, [report]);
  const gear = useMemo(() => gearFightId === undefined ? null : gearListing(report, gearFightId), [report, gearFightId]);
  const gearFlagList = useMemo(() => {
    if (gearFightId === undefined) return [];
    const sub = { ...report, gear: report.gear.filter((g) => g.fightId === gearFightId) };
    return gearIssues(sub, gearIssueConfig).find((r) => r.playerId === playerId)?.issues.filter((i) => i.itemId !== 0) ?? [];
  }, [report, gearFightId, playerId]);

  if (!player) return <p className="notice">Unknown player.</p>;
  if (result === null) return <p className="notice">This report was cached before RPB support — Refresh from WCL (requires credentials).</p>;

  const row = result.rows.find((r) => r.playerId === playerId);
  if (!row) return <p className="notice">No boss-fight data for {player.name}.</p>;

  const flagCount = gearFlagList.length;
  const v = verdict(row, flagCount);
  const status = consumablesStatus(consRow);
  const avgUptime = row.activity?.relativeActiveST ?? null;

  return (
    <div className="profile">
      <header className="profile-head">
        <span className={`profile-avatar cc-${classSlug(player.class)}`} style={classColorVar(player.class)} aria-hidden>{initials(player.name)}</span>
        <div className="profile-id">
          <h2 style={classColorVar(player.class)}>{player.name}</h2>
          <span className="profile-sub">{player.class} · {row.role}</span>
        </div>
        <div className="profile-verdict">
          <span className={`pill ${heatClass(v.heat)}`}>{v.label}</span>
          <span className="profile-note">{v.note}</span>
        </div>
      </header>

      <div className="profile-tiles">
        <Tile label="Deaths" value={String(row.deaths)} heat={deathsHeat(row.deaths)} />
        <Tile label="Avoidable dmg" value={row.totalAvoidableDamageTaken.toLocaleString()} />
        <Tile label="Avg uptime" value={avgUptime === null ? "—" : pct(avgUptime)} heat={avgUptime === null ? undefined : uptimeHeat(avgUptime)} />
        <Tile label="Interrupts" value={String(row.interruptedSpells)} />
        <Tile label="Consumables" value={status[0].toUpperCase() + status.slice(1)} heat={statusHeat(status)} />
        <Tile label="Gear flags" value={String(flagCount)} heat={flagCount > 0 ? "bad" : "good"} />
      </div>

      <div className="profile-body">
        <div className="profile-col">
          <section className="card">
            <h3>Per-boss breakdown</h3>
            <div className="scroll-x">
              <table>
                <thead><tr><th>Boss</th><th>Deaths</th><th>Avoidable</th><th>Uptime</th></tr></thead>
                <tbody>
                  {perBoss.map(({ fight, row: br }) => (
                    <tr key={fight.id}>
                      <td>{fight.name}</td>
                      <td className={heatClass(deathsHeat(br?.deaths ?? 0))}>{br?.deaths ?? 0}</td>
                      <td className="mono">{(br?.totalAvoidableDamageTaken ?? 0).toLocaleString()}</td>
                      <td className="mono">{br?.activity ? pct(br.activity.relativeActiveST) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h3>Consumables &amp; buffs</h3>
            <ul className="profile-list">
              <ConsLine label="Elixir / Flask" value={consRow?.elixirOrFlask ?? 0} />
              <ConsLine label="Food" value={consRow?.food ?? 0} />
              {consRow?.weaponEnhancement !== null && <ConsLine label="Weapon enhancement" value={consRow?.weaponEnhancement ?? 0} />}
              {consRow?.scrolls ? <li><span className="dot good" /> Scrolls <span className="mono">{consRow.scrolls}</span></li> : null}
            </ul>
          </section>
        </div>

        <div className="profile-col">
          <section className="card">
            <h3>Gear &amp; enchants</h3>
            <p className="intro">{flagCount === 0 ? "No gear flags — all clean." : `${flagCount} item(s) flagged.`}</p>
            <ul className="profile-list">
              {gear?.rows.find((r) => r.playerId === playerId)
                ? PROFILE_GEAR_SLOTS.map((s) => {
                    const item = gear.rows.find((r) => r.playerId === playerId)!.items[s];
                    const issue = gearFlagList.find((i) => item && i.itemId === item.itemId);
                    return (
                      <li key={s}>
                        <span className="slot-label">{SLOT_NAMES[s]}</span>
                        <span>{item?.name ?? "—"}</span>
                        {issue && <span className={`pill sev-${issue.severity}`}>{issue.issue}</span>}
                      </li>
                    );
                  })
                : <li>No gear snapshot recorded.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, heat }: { label: string; value: string; heat?: import("../../lib/heatmap").Heat }) {
  return (
    <div className={`profile-tile${heat ? ` tile-${heat}` : ""}`}>
      <span className="profile-tile__value mono">{value}</span>
      <span className="profile-tile__label">{label}</span>
    </div>
  );
}

function ConsLine({ label, value }: { label: string; value: number }) {
  const cls = value >= 0.9 ? "good" : value >= 0.5 ? "watch" : "bad";
  return <li><span className={`dot ${cls}`} /> {label} <span className="mono">{pct(value)}</span></li>;
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/components/report/PlayerProfile.test.tsx`
Expected: PASS.

- [ ] **Step 5: Append CSS** — add to `apps/web/src/index.css`:

```css
.profile-head { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.profile-avatar { width: 58px; height: 58px; display: grid; place-items: center; border-radius: 14px; background: var(--surface-sunken); color: var(--class-color); border: 1px solid var(--class-color); box-shadow: 0 0 14px -4px var(--class-color); font-family: var(--font-display); font-size: 22px; }
.profile-id h2 { font-family: var(--font-display); font-size: 27px; margin: 0; color: var(--class-color); }
.profile-sub { font-size: 13px; color: var(--text-muted); }
.profile-verdict { margin-left: auto; text-align: right; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
.profile-note { font-size: 12px; color: var(--text-muted); }
.profile-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 22px; }
.profile-tile { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--text-subtle); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.profile-tile.tile-good { border-left-color: var(--positive); } .profile-tile__value { color: var(--text); }
.profile-tile.tile-watch { border-left-color: var(--warn); }
.profile-tile.tile-bad { border-left-color: var(--danger); }
.profile-tile__value { font-size: 24px; }
.profile-tile__label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-subtle); }
.profile-body { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.profile-col { display: flex; flex-direction: column; gap: 18px; }
.profile-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.profile-list li { display: flex; align-items: center; gap: 8px; }
.slot-label { width: 90px; color: var(--text-subtle); font-size: 12px; }
.dot { width: 9px; height: 9px; border-radius: 999px; display: inline-block; }
.dot.good { background: var(--positive); } .dot.watch { background: var(--warn); } .dot.bad { background: var(--danger); }
@media (max-width: 880px) { .profile-body { grid-template-columns: 1fr; } }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/report/PlayerProfile.tsx apps/web/src/components/report/PlayerProfile.test.tsx apps/web/src/index.css
git commit -m "feat(web): by-player profile"
```

---

### Task 12: Routing + `ReportPage` assembly

**Files:**
- Rewrite: `apps/web/src/pages/ReportPage.tsx`
- Modify: `apps/web/src/App.tsx` (route + redirects)
- Test: `apps/web/src/pages/ReportPage.test.tsx`

**Interfaces:**
- Consumes: every component above; `useReport`; `useSearchParams`, `Navigate`; `ValidateView`, `ShadowResView` (existing).
- Produces: `ReportPage()` reading `:reportId` + `?lens&fight&player&cat&q`. Categories: `summary | performance | gear | consumables | drums | validate | shadowresi`. Defaults: `lens=fight`, `cat=summary`, `fight=`last boss fight id, `player=`first player id. Clicking a player name anywhere sets `lens=player&player=<id>`. The category subnav is hidden in the player lens.

- [ ] **Step 1: Write the failing test** — `apps/web/src/pages/ReportPage.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { reportFixture } from "@wcl/core";
import { ReportPage } from "./ReportPage";

vi.mock("../lib/useReport", () => ({
  useReport: () => ({ result: { data: reportFixture(), cachedAt: Date.now() }, error: null, loading: false, reload: vi.fn() }),
}));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/report/:reportId" element={<ReportPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe("ReportPage", () => {
  it("defaults to the Summary category", () => {
    renderAt("/report/abc");
    expect(screen.getByText(/Damage Dealers/i)).toBeInTheDocument();
  });
  it("switches category from the subnav", async () => {
    renderAt("/report/abc");
    fireEvent.click(screen.getByRole("button", { name: /^Performance$/i }));
    await waitFor(() => expect(screen.getAllByText("Deaths").length).toBeGreaterThan(0));
  });
  it("honors ?lens=player by showing the profile", () => {
    const report = reportFixture();
    renderAt(`/report/abc?lens=player&player=${report.players[0].id}`);
    expect(screen.getByRole("heading", { name: new RegExp(report.players[0].name) })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/pages/ReportPage.test.tsx`
Expected: FAIL — old `ReportPage` renders the legacy tabs, not the new categories.

- [ ] **Step 3: Implement ReportPage** — rewrite `apps/web/src/pages/ReportPage.tsx`:

```tsx
import { useSearchParams, useParams, Link } from "react-router-dom";
import { useReport } from "../lib/useReport";
import { ReportHeader } from "../components/ReportHeader";
import { LensBar, bossFights, type Lens } from "../components/LensBar";
import { SummaryRankings } from "../components/report/SummaryRankings";
import { PerformanceView } from "../components/report/PerformanceView";
import { GearMatrix } from "../components/report/GearMatrix";
import { ConsumablesCategory } from "../components/report/ConsumablesCategory";
import { DrumsCategory } from "../components/report/DrumsCategory";
import { PlayerProfile } from "../components/report/PlayerProfile";
import { ValidateView } from "../components/ValidateView";
import { ShadowResView } from "../components/ShadowResView";

const CATEGORIES = [
  ["summary", "Summary"], ["performance", "Performance"], ["gear", "Gear"],
  ["consumables", "Consumables"], ["drums", "Drums"], ["validate", "Validate"], ["shadowresi", "Shadow Resi"],
] as const;
type Cat = (typeof CATEGORIES)[number][0];

export function ReportPage() {
  const { reportId = "" } = useParams();
  const { result, error, loading, reload } = useReport(reportId);
  const [params, setParams] = useSearchParams();

  if (loading) return <p>Loading report…</p>;
  if (error) {
    return (
      <div role="alert">
        <p>{error.message}</p>
        {error.needsKey && <p><Link to="/settings">Add your WCL credentials</Link> to load this report.</p>}
      </div>
    );
  }
  if (!result) return null;
  const report = result.data;

  const bosses = bossFights(report);
  const lens = (params.get("lens") as Lens) ?? "fight";
  const cat = (params.get("cat") as Cat) ?? "summary";
  const query = params.get("q") ?? "";
  const fightId = Number(params.get("fight")) || bosses[bosses.length - 1]?.id || 0;
  const playerId = Number(params.get("player")) || report.players[0]?.id || 0;

  const patch = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    setParams(p, { replace: false });
  };
  const goPlayer = (name: string) => {
    const p = report.players.find((pl) => pl.name === name);
    if (p) patch({ lens: "player", player: String(p.id) });
  };

  return (
    <div className="report">
      <ReportHeader report={report} onRefresh={reload} />
      <LensBar
        report={report} lens={lens} fightId={fightId} playerId={playerId} query={query}
        onLens={(l) => patch({ lens: l })}
        onFight={(id) => patch({ fight: String(id) })}
        onPlayer={(id) => patch({ player: String(id) })}
        onQuery={(q) => patch({ q })}
      />

      {lens === "fight" ? (
        <div className="report-body">
          <nav className="cat-subnav">
            {CATEGORIES.map(([key, label]) => (
              <button key={key} className={cat === key ? "active" : ""} onClick={() => patch({ cat: key })}>{label}</button>
            ))}
          </nav>
          <div className="report-content">
            {cat === "summary" && <SummaryRankings report={report} onPlayer={goPlayer} />}
            {cat === "performance" && <PerformanceView report={report} fightId={fightId} onPlayer={goPlayer} />}
            {cat === "gear" && <GearMatrix report={report} fightId={fightId} onPlayer={goPlayer} />}
            {cat === "consumables" && <ConsumablesCategory report={report} fightId={fightId} />}
            {cat === "drums" && <DrumsCategory report={report} fightId={fightId} />}
            {cat === "validate" && <ValidateView report={report} />}
            {cat === "shadowresi" && <ShadowResView report={report} />}
          </div>
        </div>
      ) : (
        <div className="report-body"><div className="report-content">
          <PlayerProfile report={report} playerId={playerId} />
        </div></div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update routes + redirects** — rewrite `apps/web/src/App.tsx`:

```tsx
import { Navigate, Route, Routes, useParams, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { ReportPage } from "./pages/ReportPage";
import { SettingsPage } from "./pages/SettingsPage";

function LegacyRedirect({ cat }: { cat: string }) {
  const { reportId = "" } = useParams();
  const { search } = useLocation();
  const sep = search ? `${search}&` : "?";
  return <Navigate to={`/report/${reportId}${sep}cat=${cat}`} replace />;
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/report/:reportId" element={<ReportPage />} />
        <Route path="/cla/:reportId" element={<LegacyRedirect cat="gear" />} />
        <Route path="/rpb/:reportId" element={<LegacyRedirect cat="performance" />} />
      </Routes>
    </AppShell>
  );
}
```

- [ ] **Step 5: Add subnav CSS** — append to `apps/web/src/index.css`:

```css
.report-body { padding: 22px 28px; }
.cat-subnav { display: flex; gap: 18px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.cat-subnav button { background: none; border: none; padding: 8px 2px; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; }
.cat-subnav button.active { color: var(--text); border-bottom-color: var(--accent-gold, var(--primary)); }
```

- [ ] **Step 6: Run tests**

Run from `apps/web/`: `npx vitest run src/pages/ReportPage.test.tsx` → PASS. Then `npx tsc -b` → no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/ReportPage.tsx apps/web/src/App.tsx apps/web/src/index.css apps/web/src/pages/ReportPage.test.tsx
git commit -m "feat(web): report shell with lens/category URL state + legacy redirects"
```

---

### Task 13: Restyle `HomePage`

**Files:**
- Rewrite: `apps/web/src/pages/HomePage.tsx`
- Modify: `apps/web/src/pages/RpbPage.tsx` removal handled in Task 14
- Test: `apps/web/src/pages/HomePage.test.tsx` (create or update if one exists)
- Modify: `apps/web/src/index.css` (append `.home-*` rules — Step 5)

**Interfaces:**
- Consumes: `parseReportInput`, `saveLastReportId`, `useNavigate`.
- Produces: `HomePage()` — centered "Analyze a raid" card; Enter/Analyze navigates to `/report/:id`; "load a sample report" navigates to a demo id; ⚙ Settings link. (The old in-page report summary is removed; the report opens on its own page now.)

- [ ] **Step 1: Write the failing test** — `apps/web/src/pages/HomePage.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./HomePage";

function setup() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/report/:reportId" element={<div>REPORT PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  it("navigates to the report when a valid id is analyzed", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/report url or id/i), { target: { value: "abcdEFGH12345678" } });
    fireEvent.click(screen.getByRole("button", { name: /analyze/i }));
    expect(screen.getByText("REPORT PAGE")).toBeInTheDocument();
  });
  it("rejects junk input", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/report url or id/i), { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: /analyze/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

> Use a real 16-char report id pattern accepted by `parseReportInput`; confirm the exact shape by reading `packages/core/src/reportInput.ts` when implementing and adjust the literal in the test.

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/pages/HomePage.test.tsx`
Expected: FAIL — current HomePage renders an inline summary, no navigation.

- [ ] **Step 3: Implement** — rewrite `apps/web/src/pages/HomePage.tsx`:

```tsx
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseReportInput } from "@wcl/core";
import { saveLastReportId } from "../lib/storage";

const SAMPLE_ID = "JrYP2qfMmxBpD9hary"; // demo report

export function HomePage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function open(raw: string) {
    const id = parseReportInput(raw);
    if (!id) { setError("That doesn't look like a WCL report URL or id."); return; }
    setError(null);
    saveLastReportId(id);
    navigate(`/report/${id}`);
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); open(input); }

  return (
    <div className="home">
      <div className="home-brand">
        <span className="home-mark" aria-hidden>W</span>
        <h1 className="home-title">Raid Analyzer</h1>
        <p className="home-tag">TBC Classic · Combat Log Analytics</p>
      </div>
      <form className="home-card" onSubmit={onSubmit}>
        <h2>Analyze a raid</h2>
        <p className="subhead">Paste a WarcraftLogs report URL or id to begin.</p>
        <div className="home-input">
          <span aria-hidden>↗</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://classic.warcraftlogs.com/reports/…"
            aria-label="report url or id"
            className="mono"
          />
        </div>
        <div className="home-actions">
          <button type="submit" className="btn-gold">Analyze</button>
          <button type="button" className="btn-text" onClick={() => open(SAMPLE_ID)}>or load a sample report →</button>
        </div>
        {error && <p role="alert" className="sev-major">{error}</p>}
        <div className="home-footer">
          <span>Reports are cached for 24h.</span>
          <Link to="/settings">⚙ Settings</Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `apps/web/`: `npx vitest run src/pages/HomePage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Append CSS** — add to `apps/web/src/index.css`:

```css
.home { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; padding: 24px; background: radial-gradient(120% 80% at 80% 0%, var(--surface-sunken), var(--canvas)); }
.home-brand { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.home-mark { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 14px; background: var(--accent-gold-grad, var(--primary)); color: var(--on-accent, #fff); font-family: var(--font-display); font-size: 28px; }
.home-title { font-family: var(--font-display); font-size: 27px; font-weight: 400; margin: 0; }
.home-tag { text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: var(--text-subtle); margin: 0; }
.home-card { width: 100%; max-width: 560px; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 30px; box-shadow: var(--shadow-card); }
.home-card h2 { font-family: var(--font-display); font-size: 23px; font-weight: 400; margin: 0 0 6px; }
.home-input { display: flex; align-items: center; gap: 8px; background: var(--surface-sunken); border: 1px solid var(--border); border-radius: 11px; padding: 10px 12px; margin: 14px 0; }
.home-input input { flex: 1; background: none; border: none; color: var(--text); outline: none; }
.home-actions { display: flex; align-items: center; gap: 14px; }
.btn-gold { background: var(--accent-gold-grad, var(--primary)); color: var(--on-accent, #fff); border: none; border-radius: 9px; padding: 10px 18px; font-weight: 700; cursor: pointer; }
.btn-text { background: none; border: none; color: var(--text-muted); cursor: pointer; }
.home-footer { display: flex; justify-content: space-between; margin-top: 18px; font-size: 12px; color: var(--text-muted); }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/HomePage.tsx apps/web/src/pages/HomePage.test.tsx apps/web/src/index.css
git commit -m "feat(web): restyle home / paste-link screen"
```

---

### Task 14: Restyle `SettingsPage`, simplify `AppShell`, remove dead code, final verification

**Files:**
- Rewrite: `apps/web/src/pages/SettingsPage.tsx`
- Rewrite: `apps/web/src/components/AppShell.tsx`
- Delete: `apps/web/src/pages/RpbPage.tsx` and `apps/web/src/pages/RpbPage.test.tsx` (if present)
- Modify: `apps/web/src/index.css` (settings card CSS; remove now-dead `.sidebar*` rules only if unused)
- Test: `apps/web/src/pages/SettingsPage.test.tsx` (create or update)

**Interfaces:**
- Consumes: `loadCredentials/saveCredentials`, `loadWebhookUrl/saveWebhookUrl`, `isValidWebhookUrl`, `useNavigate`.
- Produces: `SettingsPage()` with a top bar (brand + **Done** → back) over a 620px column holding the two cards; `AppShell` reduced to a theme/layout wrapper (no CLA/RPB sidebar) that simply renders `children` and mounts `ThemeToggle`.

- [ ] **Step 1: Write the failing test** — `apps/web/src/pages/SettingsPage.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("saves credentials and confirms", () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/client id/i), { target: { value: "id" } });
    fireEvent.change(screen.getByLabelText(/client secret/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByText(/saved to this browser/i)).toBeInTheDocument();
  });
  it("rejects an invalid webhook url", () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/webhook url/i), { target: { value: "http://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /save webhook/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `apps/web/`: `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: FAIL — confirmation copy "Saved to this browser" not present yet.

- [ ] **Step 3: Implement SettingsPage** — rewrite `apps/web/src/pages/SettingsPage.tsx`:

```tsx
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadCredentials, saveCredentials, loadWebhookUrl, saveWebhookUrl } from "../lib/storage";
import { isValidWebhookUrl } from "../lib/discord";

export function SettingsPage() {
  const navigate = useNavigate();
  const existing = loadCredentials();
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState(existing?.clientSecret ?? "");
  const [saved, setSaved] = useState(false);
  const [webhook, setWebhook] = useState(loadWebhookUrl() ?? "");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookError, setWebhookError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveCredentials({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    setSaved(true);
  }
  function onSaveWebhook(e: FormEvent) {
    e.preventDefault(); setWebhookSaved(false); setWebhookError("");
    const trimmed = webhook.trim();
    if (trimmed && !isValidWebhookUrl(trimmed)) { setWebhookError("That doesn't look like a Discord webhook URL."); return; }
    saveWebhookUrl(trimmed); setWebhookSaved(true);
  }

  return (
    <div className="settings">
      <header className="report-header">
        <Link to="/" className="report-header__brand">
          <span className="report-header__mark" aria-hidden>W</span>
          <span className="report-header__title">Raid Analyzer</span>
        </Link>
        <div className="report-header__actions"><button className="btn-outline" onClick={() => navigate(-1)}>Done</button></div>
      </header>

      <div className="settings-col">
        <form className="card" onSubmit={onSubmit}>
          <h2>WCL API credentials</h2>
          <p>Create a (free) v2 API client at{" "}
            <a href="https://classic.warcraftlogs.com/api/clients/" target="_blank" rel="noreferrer">classic.warcraftlogs.com/api/clients</a>{" "}
            and paste the client ID and secret here. Stored only in this browser.</p>
          <label>Client ID <input value={clientId} onChange={(e) => setClientId(e.target.value)} required /></label>
          <label>Client secret <input value={clientSecret} type="password" onChange={(e) => setClientSecret(e.target.value)} required /></label>
          <button type="submit" className="btn-gold">Save</button>
          {saved && <p role="status">✓ Saved to this browser</p>}
        </form>

        <form className="card" onSubmit={onSaveWebhook}>
          <h2>Discord webhook</h2>
          <p>Paste a Discord channel webhook URL to post report links to your guild. Create one under <em>Channel Settings → Integrations → Webhooks</em>. Posted directly to Discord — it never reaches our server. Leave blank to remove.</p>
          <label>Webhook URL <input value={webhook} type="url" placeholder="https://discord.com/api/webhooks/…" onChange={(e) => setWebhook(e.target.value)} /></label>
          <button type="submit" className="btn-gold">Save webhook</button>
          {webhookError && <p role="alert" className="sev-major">{webhookError}</p>}
          {webhookSaved && <p role="status">✓ Saved to this browser</p>}
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Simplify AppShell** — rewrite `apps/web/src/components/AppShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

/** App-wide layout wrapper. The old CLA/RPB sidebar is gone — report navigation
 *  now lives in the in-report header (ReportHeader) and the Home/Settings screens
 *  provide their own full-viewport layouts. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="app-theme"><ThemeToggle /></div>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Add settings CSS + theme-toggle position** — append to `apps/web/src/index.css`:

```css
.settings-col { max-width: 620px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 18px; }
.app-theme { position: fixed; right: 14px; bottom: 14px; z-index: 40; }
```

- [ ] **Step 6: Delete dead RpbPage** — if the files exist:

```bash
git rm apps/web/src/pages/RpbPage.tsx apps/web/src/pages/RpbPage.test.tsx 2>/dev/null || true
```

Then grep for any remaining imports of `RpbPage` and remove them (there should be none after Task 12's `App.tsx` rewrite).

- [ ] **Step 7: Full verification**

Run from `apps/web/`:
```
npx vitest run
npx tsc -b
```
Expected: all tests PASS; no type errors. Then from repo root: `pnpm build` → succeeds. Investigate and fix any failures before committing (do not delete tests to make them pass).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): restyle settings, simplify app shell, drop legacy RpbPage"
```

---

## Notes for the implementer

- **`ReportSummary` / `RankingsGrid` on Home:** the previous Home embedded these. The redesign moves the report onto `/report/:id`, so Home no longer renders them. Leave `ReportSummary.tsx` and `RankingsGrid.tsx` in the tree (their tests still pass); `SummaryRankings` supersedes `RankingsGrid` inside the report. Do not delete `RankingsGrid` in this plan — a later cleanup can remove it once nothing imports it.
- **`RpbView` / `RpbRowsView` / `RpbCardsView` / `ConsumablesView` / `GearIssuesView` / `GearListingView` / `TimelineView`:** still present and tested. `PerformanceView`/`GearMatrix`/`ConsumablesCategory` are the new report surfaces; the legacy views remain for reference and are not routed to (except `ValidateView`/`ShadowResView`, now categories, and `DrumsView`, reused by `DrumsCategory`). A follow-up cleanup can prune the unused ones; this plan keeps them to limit blast radius.
- **Fight Timeline:** intentionally not a category (two-log tool). `TimelineView` stays in the tree, unrouted, for a future dedicated entry point.
- **Spec resolution:** `PerformanceView.specOf` returns the class as a safe label. If you want true spec text, resolve it from `report.rankings` by player name where present; keep the class fallback.
```
