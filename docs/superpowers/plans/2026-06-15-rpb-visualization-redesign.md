# RPB Visualization Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `apps/web` RPB view with a Rows⟷Cards layout toggle, full green→red heatmap coloring of every metric cell, and class-grouped, class-colored players nested inside each role section.

**Architecture:** Frontend-only change. `packages/core` `rpb()` is untouched — `RpbRow` already carries `className`, `role`, and every metric. New pure presentation helpers (`classColors`, `rpbGrouping`, `heatmap`) plus localStorage view-mode persistence feed two interchangeable presentational components (`RpbRowsView`, `RpbCardsView`). `RpbView` owns view-mode state and delegates.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + @testing-library/react, plain CSS with `data-theme="dark"` custom properties and the existing `sev-*` severity-class convention.

**Branch:** Work happens on the current `rpb-visualization-redesign` branch (frontend-only, no worktree needed).

**Run tests from:** `apps/web` (`cd apps/web && npm test`). Vitest config already wired (`apps/web/vitest.config.ts`, jsdom + `src/test-setup.ts`).

---

## File Structure

**New files (all in `apps/web/src`):**
- `lib/classColors.ts` — WoW Classic class → color map, canonical class order, neutral fallback, CSS-var helper.
- `lib/classColors.test.ts` — unit tests.
- `lib/rpbGrouping.ts` — `groupByClass(rows)` → ordered `{ className, rows }[]`.
- `lib/rpbGrouping.test.ts` — unit tests.
- `lib/heatmap.ts` — value→`Heat` bucket classifiers + `Heat`→`sev-*` class mapping.
- `lib/heatmap.test.ts` — unit tests.
- `components/PlayerRoleSelect.tsx` — extracted per-player role `<select>` (shared by both views).
- `components/RpbRowsView.tsx` — per-class-group tables with heatmap cells + dynamic class-ability columns.
- `components/RpbCardsView.tsx` — responsive card grid, one card per player.

**Modified files:**
- `lib/storage.ts` — add `RpbViewMode` + `saveRpbViewMode`/`loadRpbViewMode`.
- `lib/storage.test.ts` — add view-mode round-trip tests.
- `components/RpbView.tsx` — owns view state + toggle; groups by class within role; delegates to the active view.
- `components/RpbView.test.tsx` — extend per the design Testing section.
- `index.css` — add `sev-neutral`, class-band, class-dot, player-cell, card-grid/card styles.

**Design decision (resolves spec Open Question 1):** Rows view uses **one `<table>` per class group** under a class-band heading. Because every row in a group is the same class, their `classRows` share keys → the class abilities become real, heatmapped columns. This is the per-class-group option the mockup used.

---

### Task 1: View-mode storage helpers

**Files:**
- Modify: `apps/web/src/lib/storage.ts`
- Test: `apps/web/src/lib/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/storage.test.ts`. Update the import block at the top to add the two new functions:

```ts
import {
  loadCredentials,
  saveCredentials,
  loadToken,
  saveToken,
  loadWebhookUrl,
  saveWebhookUrl,
  clearWebhookUrl,
  loadTheme,
  saveTheme,
  loadRpbViewMode,
  saveRpbViewMode,
} from "./storage";
```

Append this describe block at the end of the file:

```ts
describe("rpb view-mode storage", () => {
  it("defaults to rows when nothing stored", () => {
    expect(loadRpbViewMode()).toBe("rows");
  });
  it("round-trips a view mode", () => {
    saveRpbViewMode("cards");
    expect(loadRpbViewMode()).toBe("cards");
  });
  it("falls back to rows for a junk stored value", () => {
    localStorage.setItem("wcl.rpbViewMode", "spreadsheet");
    expect(loadRpbViewMode()).toBe("rows");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `loadRpbViewMode`/`saveRpbViewMode` are not exported.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/storage.ts`, after the `THEME_KEY` line add:

```ts
const RPB_VIEW_KEY = "wcl.rpbViewMode";
```

And after the `loadTheme` function add:

```ts
export type RpbViewMode = "rows" | "cards";

export function saveRpbViewMode(m: RpbViewMode): void {
  localStorage.setItem(RPB_VIEW_KEY, m);
}
export function loadRpbViewMode(): RpbViewMode {
  return localStorage.getItem(RPB_VIEW_KEY) === "cards" ? "cards" : "rows";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/storage.test.ts`
Expected: PASS (all storage tests green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/storage.ts apps/web/src/lib/storage.test.ts
git commit -m "feat(rpb): persist Rows/Cards view mode in localStorage"
```

---

### Task 2: Class color map

**Files:**
- Create: `apps/web/src/lib/classColors.ts`
- Test: `apps/web/src/lib/classColors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/classColors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classColor, CLASS_ORDER } from "./classColors";

describe("classColors", () => {
  it("returns the standard color for a known class", () => {
    expect(classColor("Mage")).toBe("#69CCF0");
    expect(classColor("Warlock")).toBe("#9482C9");
  });
  it("falls back to a neutral color for an unknown/missing class", () => {
    expect(classColor("Tinker")).toBe("#9aa3b2");
    expect(classColor("")).toBe("#9aa3b2");
  });
  it("lists the nine TBC classes in canonical order, Warrior first", () => {
    expect(CLASS_ORDER[0]).toBe("Warrior");
    expect(CLASS_ORDER).toContain("Druid");
    expect(CLASS_ORDER).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/classColors.test.ts`
Expected: FAIL — module `./classColors` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/classColors.ts`:

```ts
import type { CSSProperties } from "react";

// Canonical WoW Classic TBC class order (no Death Knight in TBC).
export const CLASS_ORDER = [
  "Warrior", "Paladin", "Hunter", "Rogue", "Priest",
  "Shaman", "Mage", "Warlock", "Druid",
] as const;

// Standard WoW class colors (WCL `Player.class` strings → hex).
const CLASS_COLORS: Record<string, string> = {
  Warrior: "#C79C6E",
  Paladin: "#F58CBA",
  Hunter: "#ABD473",
  Rogue: "#FFF569",
  Priest: "#FFFFFF",
  Shaman: "#0070DE",
  Mage: "#69CCF0",
  Warlock: "#9482C9",
  Druid: "#FF7D0A",
};

const NEUTRAL = "#9aa3b2";

export function classColor(className: string): string {
  return CLASS_COLORS[className] ?? NEUTRAL;
}

/**
 * Inline style exposing the class color as the `--class-color` custom property.
 * CSS uses it for the class dot, left border, and `color-mix` header tints so a
 * single property drives every class-tinted element (and dark mode can adapt the
 * surrounding surface vars without per-class overrides).
 */
export function classColorVar(className: string): CSSProperties {
  return { "--class-color": classColor(className) } as CSSProperties;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/classColors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/classColors.ts apps/web/src/lib/classColors.test.ts
git commit -m "feat(rpb): add WoW class color map + CSS-var helper"
```

---

### Task 3: Group-by-class helper

**Files:**
- Create: `apps/web/src/lib/rpbGrouping.ts`
- Test: `apps/web/src/lib/rpbGrouping.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/rpbGrouping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { RpbRow } from "@wcl/core";
import { groupByClass } from "./rpbGrouping";

const mk = (name: string, className: string): RpbRow => ({
  playerId: name.length,
  playerName: name,
  className,
  role: "caster",
  deaths: 0,
  interruptedSpells: 0,
  interruptSources: [],
  totalAbsorbed: 0,
  friendlyFire: 0,
  damageReflected: 0,
  damageToHostilePlayers: 0,
  totalAvoidableDamageTaken: 0,
  totalPartlyAvoidable: 0,
  classRows: [],
  engineeringDamage: 0,
  oilOfImmolationDamage: 0,
  battleShoutUptime: 0,
  activity: null,
  severity: "ok",
});

describe("groupByClass", () => {
  it("orders classes canonically and sorts players by name within a class", () => {
    const groups = groupByClass([mk("Zed", "Mage"), mk("Ana", "Warrior"), mk("Bob", "Mage")]);
    expect(groups.map((g) => g.className)).toEqual(["Warrior", "Mage"]);
    expect(groups[1]!.rows.map((r) => r.playerName)).toEqual(["Bob", "Zed"]);
  });
  it("appends unknown classes after the known canonical ones", () => {
    const groups = groupByClass([mk("X", "Tinker"), mk("Y", "Priest")]);
    expect(groups.map((g) => g.className)).toEqual(["Priest", "Tinker"]);
  });
  it("returns an empty list for no rows", () => {
    expect(groupByClass([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/rpbGrouping.test.ts`
Expected: FAIL — module `./rpbGrouping` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/rpbGrouping.ts`:

```ts
import type { RpbRow } from "@wcl/core";
import { CLASS_ORDER } from "./classColors";

export interface ClassGroup {
  className: string;
  rows: RpbRow[];
}

const classRank = (c: string): number => {
  const i = (CLASS_ORDER as readonly string[]).indexOf(c);
  return i === -1 ? CLASS_ORDER.length : i;
};

/**
 * Group a role's rows by class. Classes come back in canonical WoW order with
 * any unknown class appended (sorted by name among themselves); players within a
 * class are sorted by name (matching the existing playerName sort in rpb()).
 */
export function groupByClass(rows: RpbRow[]): ClassGroup[] {
  const byClass = new Map<string, RpbRow[]>();
  for (const r of rows) {
    const list = byClass.get(r.className) ?? [];
    list.push(r);
    byClass.set(r.className, list);
  }
  return [...byClass.keys()]
    .sort((a, b) => classRank(a) - classRank(b) || a.localeCompare(b))
    .map((className) => ({
      className,
      rows: byClass
        .get(className)!
        .slice()
        .sort((a, b) => a.playerName.localeCompare(b.playerName)),
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/rpbGrouping.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/rpbGrouping.ts apps/web/src/lib/rpbGrouping.test.ts
git commit -m "feat(rpb): add group-by-class helper (canonical order)"
```

---

### Task 4: Heatmap classifier

**Files:**
- Create: `apps/web/src/lib/heatmap.ts`
- Test: `apps/web/src/lib/heatmap.test.ts`

Thresholds are intentionally simple (the spec defers tuning, mirroring the `severityFor` note in `rpb.ts`). `neutral` is the non-alarming bucket for magnitude metrics with no agreed threshold yet (damage numbers, absorbs, haste seconds).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/heatmap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  heatClass, deathsHeat, friendlyFireHeat, uptimeHeat, activeHeat, severityHeat,
} from "./heatmap";

describe("heatmap", () => {
  it("flags any death as bad, none as good", () => {
    expect(deathsHeat(0)).toBe("good");
    expect(deathsHeat(2)).toBe("bad");
  });
  it("maps friendly fire to watch when present", () => {
    expect(friendlyFireHeat(0)).toBe("good");
    expect(friendlyFireHeat(5)).toBe("watch");
  });
  it("buckets uptime fractions", () => {
    expect(uptimeHeat(0.95)).toBe("good");
    expect(uptimeHeat(0.6)).toBe("watch");
    expect(uptimeHeat(0.2)).toBe("bad");
  });
  it("buckets activity fractions", () => {
    expect(activeHeat(0.9)).toBe("good");
    expect(activeHeat(0.7)).toBe("watch");
    expect(activeHeat(0.4)).toBe("bad");
  });
  it("maps core severity buckets to heat", () => {
    expect(severityHeat("major")).toBe("bad");
    expect(severityHeat("moderate")).toBe("watch");
    expect(severityHeat("minor")).toBe("good");
    expect(severityHeat("ok")).toBe("good");
  });
  it("maps heat buckets to sev css classes", () => {
    expect(heatClass("good")).toBe("sev-minor");
    expect(heatClass("watch")).toBe("sev-moderate");
    expect(heatClass("bad")).toBe("sev-major");
    expect(heatClass("neutral")).toBe("sev-neutral");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/heatmap.test.ts`
Expected: FAIL — module `./heatmap` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/heatmap.ts`:

```ts
import type { RpbSeverity } from "@wcl/core";

/** Heatmap buckets. `neutral` = no value judgment (magnitude metrics, empties). */
export type Heat = "good" | "watch" | "bad" | "neutral";

// Reuse the shared severity color classes (green / yellow / red); `sev-neutral`
// is added in the CSS task as a transparent, non-alarming cell.
const HEAT_CLASS: Record<Heat, string> = {
  good: "sev-minor",
  watch: "sev-moderate",
  bad: "sev-major",
  neutral: "sev-neutral",
};

export function heatClass(h: Heat): string {
  return HEAT_CLASS[h];
}

export function deathsHeat(n: number): Heat {
  return n > 0 ? "bad" : "good";
}

export function friendlyFireHeat(n: number): Heat {
  return n > 0 ? "watch" : "good";
}

export function uptimeHeat(pct: number): Heat {
  if (pct >= 0.9) return "good";
  if (pct >= 0.5) return "watch";
  return "bad";
}

export function activeHeat(pct: number): Heat {
  if (pct >= 0.85) return "good";
  if (pct >= 0.6) return "watch";
  return "bad";
}

/** Reuse a class-ability row's already-computed core severity. */
export function severityHeat(s: RpbSeverity): Heat {
  switch (s) {
    case "major":
      return "bad";
    case "moderate":
      return "watch";
    default:
      return "good"; // "minor" | "ok"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/heatmap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/heatmap.ts apps/web/src/lib/heatmap.test.ts
git commit -m "feat(rpb): add value→heatmap classifier (sev-* buckets)"
```

---

### Task 5: Heatmap, class-band, and card CSS

**Files:**
- Modify: `apps/web/src/index.css`

No unit test (visual/style). Verification = build succeeds and existing render tests still pass. Add styles at the end of `index.css`.

- [ ] **Step 1: Add the styles**

Append to `apps/web/src/index.css`:

```css
/* ---------------------------------------------- RPB redesign (M8) */

/* neutral heatmap cell: no value judgment, plain surface */
tr td.sev-neutral { background: transparent; color: var(--text); font-weight: normal; }

/* class band heading above each per-class table */
.class-group { margin-top: 14px; }
.class-band {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
  padding: 4px 10px;
  font-size: 0.92rem;
  font-weight: 600;
  border-radius: var(--radius-control);
  border-left: 4px solid var(--class-color, var(--border));
  background: color-mix(in srgb, var(--class-color, transparent) 14%, var(--surface-sunken));
}

.class-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--class-color, var(--text-subtle));
  border: 1px solid rgba(0, 0, 0, 0.25);
  flex: none;
}

.player-cell { border-left: 3px solid var(--class-color, transparent); }
.player-cell .class-dot { margin-right: 6px; vertical-align: middle; }

/* cards view */
.cardgrid { display: flex; flex-wrap: wrap; gap: 12px; }
.pcard {
  flex: 1 1 260px;
  max-width: 340px;
  border: 1px solid var(--border);
  border-top: 3px solid var(--class-color, var(--border));
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  padding: 12px 14px;
}
.pcard-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--hairline);
}
.pcard-name { font-weight: 600; }
.pcard-class { color: var(--text-subtle); font-size: 0.82em; }
.pcard-head select { margin-left: auto; }
.pcard-chips { list-style: none; display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 8px; padding: 0; }
.pcard-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; margin: 0; }
.pcard-metrics div { display: flex; justify-content: space-between; gap: 8px; font-size: 0.85em; }
.pcard-metrics dt { color: var(--text-muted); }
.pcard-metrics dd { margin: 0; font-weight: 550; }
.pcard-abilities { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 3px 6px; }
.pcard-abilities li { padding: 0 5px; border-radius: 3px; font-size: 0.8em; }
.pcard-abilities li.sev-major { background: var(--danger-bg); color: var(--danger); }
.pcard-abilities li.sev-moderate { background: var(--warn-bg); color: var(--warn); }
.pcard-abilities li.sev-minor, .pcard-abilities li.sev-ok { background: var(--positive-bg); color: var(--positive); }
```

- [ ] **Step 2: Verify build + existing tests still pass**

Run: `cd apps/web && npm run build && npm test`
Expected: build succeeds; all existing tests still PASS (no behavior change yet — RpbView untouched).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "style(rpb): heatmap, class-band, and card styles"
```

---

### Task 6: Shared role-select component

**Files:**
- Create: `apps/web/src/components/PlayerRoleSelect.tsx`
- Test: `apps/web/src/components/PlayerRoleSelect.test.tsx`

Extracts the per-player role `<select>` (with its `sr-only` label and `aria-label`) so both views reuse it identically. The parent owns persistence + re-render via the `onChange(playerName, role)` callback.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/PlayerRoleSelect.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { RpbRow } from "@wcl/core";
import { PlayerRoleSelect } from "./PlayerRoleSelect";

const row = { playerId: 7, playerName: "Aragorn", role: "physical" } as RpbRow;

describe("PlayerRoleSelect", () => {
  it("renders an accessible role select and reports changes", () => {
    const onChange = vi.fn();
    render(<PlayerRoleSelect row={row} onChange={onChange} />);
    const select = screen.getByLabelText(/role for Aragorn/i);
    fireEvent.change(select, { target: { value: "tank" } });
    expect(onChange).toHaveBeenCalledWith("Aragorn", "tank");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/PlayerRoleSelect.test.tsx`
Expected: FAIL — module `./PlayerRoleSelect` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/PlayerRoleSelect.tsx`:

```tsx
import type { Role, RpbRow } from "@wcl/core";

const ROLES: Role[] = ["tank", "healer", "caster", "physical"];

export function PlayerRoleSelect({
  row,
  onChange,
}: {
  row: RpbRow;
  onChange: (playerName: string, role: Role) => void;
}) {
  return (
    <>
      <label className="sr-only" htmlFor={`role-${row.playerId}`}>
        role for {row.playerName}
      </label>
      <select
        id={`role-${row.playerId}`}
        aria-label={`role for ${row.playerName}`}
        value={row.role}
        onChange={(e) => onChange(row.playerName, e.target.value as Role)}
      >
        {ROLES.map((ro) => (
          <option key={ro} value={ro}>
            {ro}
          </option>
        ))}
      </select>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/PlayerRoleSelect.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PlayerRoleSelect.tsx apps/web/src/components/PlayerRoleSelect.test.tsx
git commit -m "refactor(rpb): extract PlayerRoleSelect component"
```

---

### Task 7: Rows view (per-class tables, heatmap cells, ability columns)

**Files:**
- Create: `apps/web/src/components/RpbRowsView.tsx`
- Test: `apps/web/src/components/RpbRowsView.test.tsx`

Renders one `<table>` per class group under a class band. Secondary metrics from the old badge sub-row (absorbed, reflected, to-hostile) are promoted to columns. Class abilities become dynamic columns built from the group's `classRows` (same class ⇒ same keys; union preserves first-seen order for safety). Every metric cell gets a heatmap class.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/RpbRowsView.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RpbRow } from "@wcl/core";
import { RpbRowsView } from "./RpbRowsView";

const base = (over: Partial<RpbRow>): RpbRow => ({
  playerId: 1, playerName: "Mageguy", className: "Mage", role: "caster",
  deaths: 0, interruptedSpells: 0, interruptSources: [], totalAbsorbed: 0,
  friendlyFire: 0, damageReflected: 0, damageToHostilePlayers: 0,
  totalAvoidableDamageTaken: 0, totalPartlyAvoidable: 0, classRows: [],
  engineeringDamage: 0, oilOfImmolationDamage: 0, battleShoutUptime: 1,
  activity: null, severity: "ok",
  ...over,
});

describe("RpbRowsView", () => {
  it("renders a class band heading and a player row", () => {
    const groups = [{ className: "Mage", rows: [base({})] }];
    render(<table><tbody /></table>); // ensure clean DOM
    const { container } = render(<RpbRowsView groups={groups} onRoleChange={vi.fn()} />);
    expect(screen.getByText("Mage")).toBeInTheDocument(); // class band
    expect(screen.getByText("Mageguy")).toBeInTheDocument();
    // a death-free cell is "good" (green = sev-minor)
    const deathCell = container.querySelector("td.sev-minor");
    expect(deathCell).not.toBeNull();
  });

  it("heatmaps a death as a problem (red = sev-major)", () => {
    const groups = [{ className: "Mage", rows: [base({ deaths: 2 })] }];
    const { container } = render(<RpbRowsView groups={groups} onRoleChange={vi.fn()} />);
    const bad = container.querySelector("td.sev-major");
    expect(bad?.textContent).toBe("2");
  });

  it("turns class abilities into columns", () => {
    const groups = [{
      className: "Mage",
      rows: [base({
        classRows: [{ key: "wc", name: "Winter's Chill", measure: "enemy-debuff-uptime", uptimePct: 0.95, rankFlag: false, verified: true, severity: "ok" }],
      })],
    }];
    render(<RpbRowsView groups={groups} onRoleChange={vi.fn()} />);
    expect(screen.getByRole("columnheader", { name: /Winter's Chill/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/RpbRowsView.test.tsx`
Expected: FAIL — module `./RpbRowsView` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/RpbRowsView.tsx`:

```tsx
import type { Role, RpbRow } from "@wcl/core";
import type { ClassGroup } from "../lib/rpbGrouping";
import { classColorVar } from "../lib/classColors";
import {
  heatClass, deathsHeat, friendlyFireHeat, uptimeHeat, activeHeat, severityHeat,
} from "../lib/heatmap";
import { PlayerRoleSelect } from "./PlayerRoleSelect";

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const neutral = heatClass("neutral");

/** Distinct class-ability columns for a group, first-seen order (same class ⇒ same keys). */
function abilityColumns(rows: RpbRow[]): { key: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const r of rows) for (const c of r.classRows) if (!seen.has(c.key)) seen.set(c.key, c.name);
  return [...seen].map(([key, name]) => ({ key, name }));
}

export function RpbRowsView({
  groups,
  onRoleChange,
}: {
  groups: ClassGroup[];
  onRoleChange: (playerName: string, role: Role) => void;
}) {
  return (
    <>
      {groups.map((g) => {
        const cols = abilityColumns(g.rows);
        return (
          <div key={g.className} className="class-group">
            <h4 className="class-band" style={classColorVar(g.className)}>
              <span className="class-dot" /> {g.className}
            </h4>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>player</th><th>role</th><th>deaths</th><th>interrupts</th>
                    <th>total dmg taken</th><th>friendly fire</th>
                    <th>absorbed</th><th>reflected</th><th>to hostile</th>
                    <th>engi dmg</th><th>oil dmg</th><th>shout uptime</th>
                    <th>active % (ST/AoE)</th><th>haste s saved</th>
                    {cols.map((c) => <th key={c.key}>{c.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => {
                    const byKey = new Map(r.classRows.map((c) => [c.key, c]));
                    return (
                      <tr key={r.playerId}>
                        <td className="player-cell" style={classColorVar(r.className)}>
                          <span className="class-dot" /> {r.playerName}
                        </td>
                        <td><PlayerRoleSelect row={r} onChange={onRoleChange} /></td>
                        <td className={heatClass(deathsHeat(r.deaths))}>{r.deaths}</td>
                        <td
                          className={neutral}
                          title={r.interruptedSpells > 0 ? `enemies whose casts were interrupted: ${r.interruptSources.join(", ")}` : "no interrupts"}
                        >
                          {r.interruptedSpells > 0 ? `${r.interruptedSpells} (${r.interruptSources.join(", ")})` : 0}
                        </td>
                        <td className={neutral} title={`all boss damage taken: ${r.totalPartlyAvoidable.toLocaleString()}`}>
                          {r.totalAvoidableDamageTaken.toLocaleString()}
                        </td>
                        <td className={heatClass(friendlyFireHeat(r.friendlyFire))}>{r.friendlyFire.toLocaleString()}</td>
                        <td className={neutral}>{r.totalAbsorbed.toLocaleString()}</td>
                        <td className={neutral} title="self/reflected damage (counts as done to self)">{r.damageReflected.toLocaleString()}</td>
                        <td className={neutral} title="damage to hostile players (PvP; counts as done to self)">{r.damageToHostilePlayers.toLocaleString()}</td>
                        <td className={neutral}>{r.engineeringDamage.toLocaleString()}</td>
                        <td className={neutral}>{r.oilOfImmolationDamage.toLocaleString()}</td>
                        <td className={heatClass(uptimeHeat(r.battleShoutUptime))}>{pct(r.battleShoutUptime)}</td>
                        <td className={r.activity ? heatClass(activeHeat(r.activity.relativeActiveST)) : neutral}>
                          {r.activity ? `${pct(r.activity.relativeActiveST)} / ${pct(r.activity.relativeActiveAoe)}` : "—"}
                        </td>
                        <td className={neutral}>{r.activity ? r.activity.secondsSubtractedHaste.toFixed(1) : "—"}</td>
                        {cols.map((col) => {
                          const c = byKey.get(col.key);
                          if (!c) return <td key={col.key} className={neutral}>—</td>;
                          const text = c.measure === "cast-count" ? `${c.castCount}×` : pct(c.uptimePct ?? 0);
                          const flags = [c.rankFlag ? "mostly a lower rank than optimal" : "", !c.verified ? "spell ids not yet Wowhead-verified" : ""]
                            .filter(Boolean).join("; ");
                          return (
                            <td key={col.key} className={heatClass(severityHeat(c.severity))} title={flags || undefined}>
                              {text}{c.rankFlag && " ⚠"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/RpbRowsView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/RpbRowsView.tsx apps/web/src/components/RpbRowsView.test.tsx
git commit -m "feat(rpb): rows view — per-class tables, heatmap cells, ability columns"
```

---

### Task 8: Cards view

**Files:**
- Create: `apps/web/src/components/RpbCardsView.tsx`
- Test: `apps/web/src/components/RpbCardsView.test.tsx`

One card per player (flowing across all class groups in the role). Class-tinted header with class dot + role select; worst issues as colored chips; remaining metrics as compact key/value lines; class abilities as heatmapped lines.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/RpbCardsView.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RpbRow } from "@wcl/core";
import { RpbCardsView } from "./RpbCardsView";

const base = (over: Partial<RpbRow>): RpbRow => ({
  playerId: 1, playerName: "Mageguy", className: "Mage", role: "caster",
  deaths: 0, interruptedSpells: 0, interruptSources: [], totalAbsorbed: 0,
  friendlyFire: 0, damageReflected: 0, damageToHostilePlayers: 0,
  totalAvoidableDamageTaken: 0, totalPartlyAvoidable: 0, classRows: [],
  engineeringDamage: 0, oilOfImmolationDamage: 0, battleShoutUptime: 1,
  activity: null, severity: "ok",
  ...over,
});

describe("RpbCardsView", () => {
  it("renders one card per player with name and class", () => {
    const groups = [{ className: "Mage", rows: [base({})] }];
    render(<RpbCardsView groups={groups} onRoleChange={vi.fn()} />);
    expect(screen.getByText("Mageguy")).toBeInTheDocument();
    expect(screen.getByText("Mage")).toBeInTheDocument();
  });

  it("surfaces a death as a red chip", () => {
    const groups = [{ className: "Mage", rows: [base({ deaths: 1 })] }];
    const { container } = render(<RpbCardsView groups={groups} onRoleChange={vi.fn()} />);
    const chip = container.querySelector(".pcard-chips .sev-major");
    expect(chip?.textContent).toMatch(/death/i);
  });

  it("lists class abilities on the card", () => {
    const groups = [{
      className: "Mage",
      rows: [base({
        classRows: [{ key: "wc", name: "Winter's Chill", measure: "enemy-debuff-uptime", uptimePct: 0.9, rankFlag: false, verified: true, severity: "ok" }],
      })],
    }];
    render(<RpbCardsView groups={groups} onRoleChange={vi.fn()} />);
    expect(screen.getByText(/Winter's Chill/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/RpbCardsView.test.tsx`
Expected: FAIL — module `./RpbCardsView` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/RpbCardsView.tsx`:

```tsx
import type { Role, RpbRow } from "@wcl/core";
import type { ClassGroup } from "../lib/rpbGrouping";
import { classColorVar } from "../lib/classColors";
import { heatClass, severityHeat } from "../lib/heatmap";
import { PlayerRoleSelect } from "./PlayerRoleSelect";

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

/** Worst issues to surface as colored chips at the top of a card. */
function worstChips(r: RpbRow): { label: string; cls: string }[] {
  const chips: { label: string; cls: string }[] = [];
  if (r.deaths > 0) chips.push({ label: `${r.deaths} death${r.deaths > 1 ? "s" : ""}`, cls: "sev-major" });
  if (r.friendlyFire > 0) chips.push({ label: `friendly fire ${r.friendlyFire.toLocaleString()}`, cls: "sev-moderate" });
  for (const c of r.classRows) {
    if (c.severity === "major" || c.severity === "moderate") {
      const v = c.measure === "cast-count" ? `${c.castCount}×` : pct(c.uptimePct ?? 0);
      chips.push({ label: `${c.name} ${v}`, cls: `sev-${c.severity}` });
    }
  }
  return chips;
}

export function RpbCardsView({
  groups,
  onRoleChange,
}: {
  groups: ClassGroup[];
  onRoleChange: (playerName: string, role: Role) => void;
}) {
  const rows = groups.flatMap((g) => g.rows);
  return (
    <div className="cardgrid">
      {rows.map((r) => {
        const chips = worstChips(r);
        return (
          <div key={r.playerId} className="pcard" style={classColorVar(r.className)}>
            <header className="pcard-head">
              <span className="class-dot" />
              <span className="pcard-name">{r.playerName}</span>
              <span className="pcard-class">{r.className}</span>
              <PlayerRoleSelect row={r} onChange={onRoleChange} />
            </header>
            {chips.length > 0 && (
              <ul className="pcard-chips">
                {chips.map((c, i) => (
                  <li key={i} className={`chip ${c.cls}`}>{c.label}</li>
                ))}
              </ul>
            )}
            <dl className="pcard-metrics">
              <div><dt>deaths</dt><dd>{r.deaths}</dd></div>
              <div><dt>total dmg taken</dt><dd>{r.totalAvoidableDamageTaken.toLocaleString()}</dd></div>
              <div><dt>shout uptime</dt><dd>{pct(r.battleShoutUptime)}</dd></div>
              <div><dt>active ST/AoE</dt><dd>{r.activity ? `${pct(r.activity.relativeActiveST)} / ${pct(r.activity.relativeActiveAoe)}` : "—"}</dd></div>
              {r.totalAbsorbed > 0 && <div><dt>absorbed</dt><dd>{r.totalAbsorbed.toLocaleString()}</dd></div>}
              {r.engineeringDamage > 0 && <div><dt>engi dmg</dt><dd>{r.engineeringDamage.toLocaleString()}</dd></div>}
            </dl>
            {r.classRows.length > 0 && (
              <ul className="pcard-abilities">
                {r.classRows.map((c) => (
                  <li
                    key={c.key}
                    className={heatClass(severityHeat(c.severity))}
                    title={!c.verified ? "spell ids not yet Wowhead-verified" : undefined}
                  >
                    {c.name}: {c.measure === "cast-count" ? `${c.castCount}×` : `${pct(c.uptimePct ?? 0)} uptime`}
                    {c.rankFlag && " ⚠"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/RpbCardsView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/RpbCardsView.tsx apps/web/src/components/RpbCardsView.test.tsx
git commit -m "feat(rpb): cards view — class-tinted player cards with issue chips"
```

---

### Task 9: Wire up RpbView (toggle, persistence, delegation)

**Files:**
- Modify: `apps/web/src/components/RpbView.tsx`
- Test: `apps/web/src/components/RpbView.test.tsx`

`RpbView` keeps the `rpb()` call, the null-result message, and the role-override application; it now owns view-mode state (seeded from localStorage), renders the Rows/Cards toggle (reusing the `.segmented` radio pattern), groups each role's rows by class, and delegates to the active view.

- [ ] **Step 1: Write the failing test**

Replace `apps/web/src/components/RpbView.test.tsx` with:

```tsx
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { RpbView } from "./RpbView";
import { reportFixture } from "@wcl/core";

describe("RpbView", () => {
  beforeEach(() => localStorage.clear());

  it("renders players grouped under their class band", () => {
    render(<RpbView report={reportFixture} />);
    expect(screen.getByText("Playerone")).toBeInTheDocument();
    expect(screen.getByText("Playertwo")).toBeInTheDocument();
    // class bands present (Mage for Playerone, Warrior for Playertwo)
    expect(screen.getByRole("heading", { name: "Mage" })).toBeInTheDocument();
  });

  it("shows a refresh notice for a pre-M5 report", () => {
    const r = structuredClone(reportFixture);
    delete (r as { playerTotals?: unknown }).playerTotals;
    render(<RpbView report={r} />);
    expect(screen.getByText(/cached before/i)).toBeInTheDocument();
  });

  it("persists a manual role override", () => {
    render(<RpbView report={reportFixture} />);
    const select = screen.getAllByLabelText(/role for/i)[0]!;
    fireEvent.change(select, { target: { value: "tank" } });
    expect(JSON.parse(localStorage.getItem("wcl.roles")!)).toMatchObject({ Playerone: "tank" });
  });

  it("renders class-specific ability metrics", () => {
    render(<RpbView report={reportFixture} />);
    expect(screen.getAllByText(/Winter's Chill/).length).toBeGreaterThan(0);
  });

  it("toggles to cards view and persists the choice", () => {
    render(<RpbView report={reportFixture} />);
    expect(document.querySelector(".cardgrid")).toBeNull(); // rows by default
    fireEvent.click(screen.getByLabelText(/cards view/i));
    expect(document.querySelector(".cardgrid")).not.toBeNull();
    expect(localStorage.getItem("wcl.rpbViewMode")).toBe("cards");
  });

  it("starts in cards view when that was persisted", () => {
    localStorage.setItem("wcl.rpbViewMode", "cards");
    render(<RpbView report={reportFixture} />);
    expect(document.querySelector(".cardgrid")).not.toBeNull();
  });

  it("applies a class color to a player marker", () => {
    const { container } = render(<RpbView report={reportFixture} />);
    const dot = container.querySelector(".class-dot") as HTMLElement | null;
    expect(dot).not.toBeNull();
    // the --class-color custom property is set on the band/cell via inline style
    const band = screen.getByRole("heading", { name: "Mage" });
    expect(band.getAttribute("style")).toContain("--class-color");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/RpbView.test.tsx`
Expected: FAIL — toggle/cardgrid/class-band assertions fail against the current single-table RpbView.

- [ ] **Step 3: Write minimal implementation**

Replace `apps/web/src/components/RpbView.tsx` with:

```tsx
import { useMemo, useState } from "react";
import { rpb, type Role, type ReportData } from "@wcl/core";
import {
  spellCastTimes, roleSignals, casterClasses, hasteBuffs, engineeringDamageIds,
  oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
  classAbilities, avoidableAbilityIds,
} from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";
import { RpbRowsView } from "./RpbRowsView";
import { RpbCardsView } from "./RpbCardsView";
import { groupByClass } from "../lib/rpbGrouping";
import {
  loadRoleOverrides, saveRoleOverride,
  loadRpbViewMode, saveRpbViewMode, type RpbViewMode,
} from "../lib/storage";

const ROLES: Role[] = ["tank", "healer", "caster", "physical"];

export function RpbView({ report }: { report: ReportData }) {
  const [, force] = useState(0);
  const [view, setView] = useState<RpbViewMode>(() => loadRpbViewMode());
  const overrides = loadRoleOverrides();
  const result = useMemo(() => rpb(report, {
    roles: { signals: roleSignals, casterClasses },
    activity: { castTimes: spellCastTimes, hasteBuffs, aoeWindowMs: 500 },
    engineeringDamageIds, oilOfImmolationSpellId, battleShoutBuffIds, absorbExcludedSpellIds,
    classAbilities, avoidableAbilityIds,
  }), [report]);

  if (result === null) {
    return <p>This report was cached before RPB support — refresh it from WCL (requires credentials).</p>;
  }

  // apply per-character overrides on top of auto-detected roles
  const rows = result.rows.map((r) => ({ ...r, role: overrides[r.playerName] ?? r.role }));

  const onRoleChange = (playerName: string, role: Role) => {
    saveRoleOverride(playerName, role);
    force((n) => n + 1);
  };
  const setMode = (m: RpbViewMode) => {
    setView(m);
    saveRpbViewMode(m);
  };

  return (
    <div>
      <p><small>Roles are auto-detected and adjustable per character (saved in your browser). Players are grouped and colored by class. Kalecgos is excluded. Activity is spell-haste corrected; melee activity is approximate.</small></p>

      <div className="segmented" role="group" aria-label="RPB layout">
        {(["rows", "cards"] as const).map((m) => (
          <label key={m} className={view === m ? "active" : ""}>
            <input
              type="radio"
              name="rpb-view"
              aria-label={`${m} view`}
              checked={view === m}
              onChange={() => setMode(m)}
            />
            {m}
          </label>
        ))}
      </div>

      <SeverityLegend />

      {ROLES.map((role) => {
        const group = rows.filter((r) => r.role === role);
        if (group.length === 0) return null;
        const groups = groupByClass(group);
        return (
          <section key={role}>
            <h3 style={{ textTransform: "capitalize" }}>{role}</h3>
            {view === "rows"
              ? <RpbRowsView groups={groups} onRoleChange={onRoleChange} />
              : <RpbCardsView groups={groups} onRoleChange={onRoleChange} />}
          </section>
        );
      })}

      <p><small>Heatmap: green = good, yellow = watch, red = problem. "Total dmg taken" shows avoidable damage from tracked abilities (hover for total); ⚠ flags a lower-than-optimal rank; class abilities still pending Wowhead confirmation are marked on hover.</small></p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/RpbView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/RpbView.tsx apps/web/src/components/RpbView.test.tsx
git commit -m "feat(rpb): Rows/Cards toggle, class grouping, heatmap — wire up RpbView"
```

---

### Task 10: Full verification + cleanup

**Files:** none (verification only).

- [ ] **Step 1: Run the full web test suite**

Run: `cd apps/web && npm test`
Expected: ALL tests PASS (storage, classColors, rpbGrouping, heatmap, PlayerRoleSelect, RpbRowsView, RpbCardsView, RpbView, plus pre-existing suites).

- [ ] **Step 2: Typecheck + production build**

Run: `cd apps/web && npm run build`
Expected: `tsc -b` clean (no type errors), Vite build succeeds.

- [ ] **Step 3: Lint**

Run: `cd apps/web && npm run lint`
Expected: no errors. (If the unused-`Fragment`/`pct` import lint trips from the old RpbView, it is already gone in the rewrite — confirm clean.)

- [ ] **Step 4: Confirm no stale references to removed badge sub-row CSS**

Run: `grep -rn "class-rows\|class-ability-list" apps/web/src`
Expected: only matches inside `index.css` (harmless leftover rules) — no `.tsx` still references them. If a `.tsx` match appears, it is a missed migration; fix before finishing. (The old `.class-rows`/`.class-ability-list` CSS rules may be left in place or deleted; deletion is optional cleanup, not required.)

- [ ] **Step 5: Final commit (only if Step 4 required a fix)**

```bash
git add -A
git commit -m "chore(rpb): remove stale badge sub-row references"
```

---

## Self-Review

**Spec coverage:**
- Goal 1 (Rows⟷Cards toggle, persisted) → Tasks 1, 9. ✓
- Goal 2 (heatmap every cell) → Tasks 4, 7, 8. ✓
- Goal 3 (group + color by class) → Tasks 2, 3, 7, 8, 9. ✓
- Goal 4 (preserve role detection/override, Kalecgos, metrics, a11y) → `rpb()` untouched; override via Tasks 6 + 9; Kalecgos handled in core; a11y in Tasks 6, 9. ✓
- Components & Structure (classColors lib, grouping helper, heatmap classifier, two views) → Tasks 2, 3, 4, 7, 8. ✓
- Data flow (localStorage mirror of theme) → Task 1. ✓
- Styling (sev-neutral, dark-mode-capable via custom props + color-mix) → Task 5. ✓
- Edge handling (null result, empty role skipped, unknown class neutral, empty values neutral) → Task 9 (null + empty role), Tasks 2/3 (unknown class), Task 4 (neutral). ✓
- Accessibility (button group aria, class name as text, value stays in cell, sr-only select) → Tasks 6, 9. ✓
- Testing section items → covered across Tasks 1–9. ✓
- Open Question 1 (per-class-group tables) → resolved in File Structure note. ✓
- Open Question 2 (thresholds) → Task 4 with simple documented thresholds. ✓

**Type consistency:** `ClassGroup` defined in Task 3, consumed unchanged in Tasks 7/8/9. `Heat`/`heatClass`/classifier names defined in Task 4, used verbatim in Tasks 7/8. `RpbViewMode` defined in Task 1, used in Task 9. `PlayerRoleSelect` signature `(row, onChange)` defined in Task 6, called identically in Tasks 7/8. `classColorVar` defined in Task 2, used in Tasks 7/8/9. `onRoleChange(playerName, role)` consistent across Tasks 6–9.

**Placeholder scan:** No TBD/TODO; every code step shows full content; thresholds are concrete numbers.
