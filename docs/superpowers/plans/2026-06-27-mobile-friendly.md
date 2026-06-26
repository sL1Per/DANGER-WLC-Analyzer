# Mobile-Friendly WCL Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/web` fully usable on a phone — navigable nav, no horizontal page scroll, and dense report tables presented as readable per-player cards.

**Architecture:** A small `useMediaQuery` hook drives a phone breakpoint (`max-width: 640px`). On phones, report navigation collapses into a hamburger drawer, and each dense table view conditionally renders per-player cards (via a shared `StatCard` primitive) instead of its `<table>`. Everything else (header slimming, spacing, touch targets, one-column stacking) is pure CSS `@media`. No analysis logic, data shapes, or `SCHEMA_VERSION` change.

**Tech Stack:** React 19, react-router-dom 6, Vite, Vitest + @testing-library/react (jsdom). Plain CSS in `src/index.css` (imports `src/theme.css`).

## Global Constraints

- Breakpoint: phone = `(max-width: 640px)`. Use the exported `PHONE_QUERY` constant everywhere in JS; CSS `@media` rules use the literal `640px`. The existing legacy breakpoint at `720px` and the `880px`/`900px` rules stay as-is.
- Presentation only: do NOT change `@wcl/core`/`@wcl/data`, analysis functions, `SCHEMA_VERSION`, data shapes, or cached output.
- Card switching is JS conditional render (`useIsPhone()`), never CSS `display` hacks on `<table>`.
- Preserve existing severity classes (`sev-major` / `sev-moderate` / `sev-minor` / `sev-ok` / `sev-neutral`) and heat classes on values so the color encoding still reads in card mode.
- Preserve `player-link` buttons and `classColorVar(class)` coloring on player titles.
- Minimum 44px tap target on interactive nav controls on small screens.
- jsdom has no `window.matchMedia`; tests that depend on viewport MUST stub it via the `mockMatchMedia` helper (Task 1).
- Run all web commands from `apps/web`. Test: `pnpm test`. Typecheck/build: `pnpm build`.

---

## Phase 1 — Foundation, navigation, polish

Ships a phone-navigable app: drawer nav, scrollable fight chips, comfortable tap targets, stacked Home/Settings, no 320px page overflow. Tables still scroll horizontally inside `.scroll-x` (unchanged) until Phase 2.

### Task 1: `useMediaQuery` hook + phone breakpoint + test helper

**Files:**
- Create: `apps/web/src/lib/useMediaQuery.ts`
- Create: `apps/web/src/lib/useMediaQuery.test.tsx`
- Create: `apps/web/src/test-utils/matchMedia.ts`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean`; `PHONE_QUERY: string` (`"(max-width: 640px)"`); `useIsPhone(): boolean`.
- Produces (test util): `mockMatchMedia(matches: boolean): void` — installs a `window.matchMedia` stub returning `matches` for every query.

- [ ] **Step 1: Write the test helper**

`apps/web/src/test-utils/matchMedia.ts`:

```ts
/** Install a window.matchMedia stub (jsdom has none). All queries return `matches`. */
export function mockMatchMedia(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
```

- [ ] **Step 2: Write the failing test**

`apps/web/src/lib/useMediaQuery.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../test-utils/matchMedia";
import { useIsPhone, useMediaQuery, PHONE_QUERY } from "./useMediaQuery";

afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("useMediaQuery", () => {
  it("returns true when the query matches", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(true);
  });

  it("returns false when the query does not match", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(false);
  });

  it("returns false when matchMedia is unavailable", () => {
    const { result } = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(false);
  });

  it("useIsPhone uses the phone breakpoint", () => {
    const spy = vi.fn((query: string) => ({
      matches: true, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }));
    // @ts-expect-error stub
    window.matchMedia = spy;
    renderHook(() => useIsPhone());
    expect(spy).toHaveBeenCalledWith(PHONE_QUERY);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- useMediaQuery`
Expected: FAIL — `Cannot find module './useMediaQuery'`.

- [ ] **Step 4: Implement the hook**

`apps/web/src/lib/useMediaQuery.ts`:

```ts
import { useEffect, useState } from "react";

export const PHONE_QUERY = "(max-width: 640px)";

/** Reactive media-query match. SSR/jsdom-safe: returns false when matchMedia is absent. */
export function useMediaQuery(query: string): boolean {
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // sync in case it changed between render and effect
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- useMediaQuery`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/useMediaQuery.ts apps/web/src/lib/useMediaQuery.test.tsx apps/web/src/test-utils/matchMedia.ts
git commit -m "feat(web): add useMediaQuery hook + phone breakpoint"
```

---

### Task 2: Report drawer navigation + slim top bar

Replaces `ReportHeader` + `LensBar`'s control rows on phones with a slim bar (title + active label + hamburger) and a slide-out drawer holding the controls. The drawer renders the SAME callbacks already wired in `ReportPage`. On ≥641px nothing changes.

**Files:**
- Create: `apps/web/src/components/report/ReportDrawer.tsx`
- Create: `apps/web/src/components/report/ReportDrawer.test.tsx`
- Modify: `apps/web/src/pages/ReportPage.tsx` (render the drawer/slim bar on phones; hide header/lens-bar control rows)
- Modify: `apps/web/src/index.css` (drawer + slim-bar styles)

**Interfaces:**
- Consumes: `useIsPhone` (Task 1).
- Produces: `ReportDrawer` component:

```ts
interface ReportDrawerProps {
  title: string;          // report.title (truncated by CSS)
  activeLabel: string;    // e.g. "Gear · BOSSES" — reuse ReportPage's viewLabel
  children: ReactNode;    // drawer contents (nav + actions), provided by ReportPage
}
```

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/report/ReportDrawer.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportDrawer } from "./ReportDrawer";

const setup = () =>
  render(
    <ReportDrawer title="My Raid" activeLabel="Gear · BOSSES">
      <button>Inside drawer</button>
    </ReportDrawer>,
  );

describe("ReportDrawer", () => {
  it("starts closed: menu button shows aria-expanded=false and content is not visible", () => {
    setup();
    const btn = screen.getByRole("button", { name: /menu/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Inside drawer")).not.toBeInTheDocument();
  });

  it("opens on menu click and shows children", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    expect(screen.getByRole("button", { name: /menu/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Inside drawer")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Inside drawer")).not.toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    fireEvent.click(screen.getByTestId("drawer-backdrop"));
    expect(screen.queryByText("Inside drawer")).not.toBeInTheDocument();
  });

  it("renders the title and active label in the slim bar", () => {
    setup();
    expect(screen.getByText("My Raid")).toBeInTheDocument();
    expect(screen.getByText("Gear · BOSSES")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- ReportDrawer`
Expected: FAIL — `Cannot find module './ReportDrawer'`.

- [ ] **Step 3: Implement `ReportDrawer`**

`apps/web/src/components/report/ReportDrawer.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from "react";

interface ReportDrawerProps {
  title: string;
  activeLabel: string;
  children: ReactNode;
}

export function ReportDrawer({ title, activeLabel, children }: ReportDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="report-slimbar">
      <span className="report-slimbar__title">{title}</span>
      <span className="report-slimbar__active">{activeLabel}</span>
      <button
        type="button"
        className="report-slimbar__menu"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="report-drawer"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>☰</span>
      </button>

      {open && (
        <>
          <div className="report-drawer__backdrop" data-testid="drawer-backdrop" onClick={() => setOpen(false)} />
          <div
            id="report-drawer"
            className="report-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Report navigation"
            onClick={() => setOpen(false)}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
```

Note: the outer `onClick={() => setOpen(false)}` closes the drawer after any control inside is used (selection closes the drawer, per spec). Controls still fire their own handlers first via bubbling.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- ReportDrawer`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire into `ReportPage`**

In `apps/web/src/pages/ReportPage.tsx`:

Add imports near the top:

```tsx
import { useIsPhone } from "../lib/useMediaQuery";
import { ReportDrawer } from "../components/report/ReportDrawer";
```

Inside `ReportPage`, after `const report = result.data;` and after `viewLabel` is computed, add:

```tsx
const isPhone = useIsPhone();
```

Replace the existing `<ReportHeader ... />` line with a phone branch:

```tsx
{isPhone ? (
  <ReportDrawer title={report.title} activeLabel={viewLabel}>
    <nav className="drawer-nav">
      {categories.map(([key, label]) => (
        <button key={key} className={cat === key ? "active" : ""} onClick={() => patch({ cat: key })}>{label}</button>
      ))}
    </nav>
    <div className="drawer-actions">
      <Link to="/settings" className="btn-outline">Settings</Link>
      <Link to="/" className="btn-outline">New report</Link>
      <button className="btn-outline" onClick={reload}>Refresh from WCL</button>
    </div>
  </ReportDrawer>
) : (
  <ReportHeader report={report} onRefresh={reload} />
)}
```

`viewLabel` is declared with `const` below its first use here; move the `viewLabel` and `reportDetails` declarations to ABOVE this `return`'s JSX (they are already computed before the `return` — keep them there; just ensure `viewLabel` is defined before the drawer uses it, which it is since both are above `return`).

Keep `<LensBar .../>` as-is — Task 3 makes its fight strip scroll on phones, and the existing `cat-subnav` stays for desktop. On phones the category buttons live in the drawer, so hide the desktop `cat-subnav` via CSS (Task 2 Step 6).

- [ ] **Step 6: Add CSS**

Append to `apps/web/src/index.css`:

```css
/* ── mobile report nav (≤640px) ──────────────────────────── */
.report-slimbar { display: none; }
.report-drawer, .report-drawer__backdrop { display: none; }

@media (max-width: 640px) {
  .report-slimbar {
    position: sticky; top: 0; z-index: 35;
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; background: var(--surface-sunken);
    border-bottom: 1px solid var(--border);
  }
  .report-slimbar__title {
    font-family: var(--font-display); font-size: 16px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45vw;
  }
  .report-slimbar__active {
    font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
    color: var(--text-subtle); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .report-slimbar__menu {
    margin-left: auto; min-width: 44px; min-height: 44px;
    display: grid; place-items: center; font-size: 22px;
    background: transparent; border: 1px solid var(--border); border-radius: 10px;
    color: var(--text); cursor: pointer;
  }
  .report-drawer__backdrop {
    display: block; position: fixed; inset: 0; z-index: 45;
    background: rgba(0, 0, 0, 0.5);
  }
  .report-drawer {
    display: flex; flex-direction: column; gap: 18px;
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 46;
    width: min(82vw, 320px); padding: 20px 18px;
    background: var(--surface); border-left: 1px solid var(--border);
    box-shadow: -12px 0 32px rgba(0, 0, 0, 0.35); overflow-y: auto;
  }
  .drawer-nav { display: flex; flex-direction: column; gap: 4px; }
  .drawer-nav button {
    text-align: left; padding: 12px 14px; min-height: 44px;
    border: 0; border-radius: 10px; background: transparent;
    color: var(--text-muted); font-weight: 600; font-size: 15px; cursor: pointer;
  }
  .drawer-nav button.active { background: var(--primary-tint); color: var(--text); }
  .drawer-actions { display: flex; flex-direction: column; gap: 8px; }
  .drawer-actions .btn-outline { width: 100%; min-height: 44px; text-align: center; }

  /* desktop header + the in-body category subnav are replaced by the drawer */
  .report-header { display: none; }
  .cat-subnav { display: none; }
}
```

- [ ] **Step 7: Run the full suite + build**

Run: `pnpm test`
Expected: PASS (existing tests unaffected — they render at desktop width, `isPhone` is false). Then:
Run: `pnpm build`
Expected: typecheck + build succeed.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/report/ReportDrawer.tsx apps/web/src/components/report/ReportDrawer.test.tsx apps/web/src/pages/ReportPage.tsx apps/web/src/index.css
git commit -m "feat(web): mobile drawer nav + slim top bar for reports"
```

---

### Task 3: Fight-chip scroll strip + touch targets + Home/Settings polish

Make the lens-bar fight/roster strip a horizontal scroll strip on phones, enlarge tap targets on lens toggles and chips, and verify Home/Settings stack to one column with no 320px overflow.

**Files:**
- Modify: `apps/web/src/index.css` only.

**Interfaces:** none (CSS-only).

- [ ] **Step 1: Add CSS**

Append to `apps/web/src/index.css`:

```css
@media (max-width: 640px) {
  /* lens bar: keep toggles, scroll the chip strip horizontally */
  .lens-bar { padding: 12px 14px; }
  .lens-strip {
    flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch;
    padding-bottom: 4px; scrollbar-width: thin;
  }
  .fight-chip, .player-chip { flex: 0 0 auto; min-height: 44px; }
  .lens-toggle { flex-wrap: wrap; }
  .lens-toggle > button { min-height: 44px; }
  .lens-toggle__actions { margin-left: 0; width: 100%; }
  .lens-hint { width: 100%; }
  .roster-search { width: 100%; min-height: 44px; }

  /* report body breathing room */
  .report-body { padding: 16px 14px 40px; }

  /* home + settings stack to one column, full-width controls */
  .home { padding: 18px; gap: 18px; }
  .home-card { padding: 20px; border-radius: 14px; }
  .home-actions { flex-direction: column; align-items: stretch; }
  .home-actions .btn-gold { width: 100%; min-height: 44px; }
  .home-footer { flex-direction: column; gap: 6px; }
  .settings-col { padding: 16px; }
  .settings-col .btn-gold { width: 100%; min-height: 44px; }

  /* never force horizontal page scroll on tiny screens */
  .report, .home, .settings { overflow-x: hidden; }
  .mono { overflow-wrap: anywhere; }
}
```

- [ ] **Step 2: Verify the suite still passes**

Run: `pnpm test`
Expected: PASS (CSS-only change; no test impact).

- [ ] **Step 3: Manual viewport check**

Run: `pnpm dev`, open the app, use browser devtools device toolbar at **375px** and **320px**. Confirm: report drawer opens/closes, fight chips scroll sideways, no page-level horizontal scroll, Home/Settings stack with full-width buttons.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat(web): mobile chip scroll strip, touch targets, home/settings stacking"
```

---

## Phase 2 — Report views as per-player cards

Each task adds a phone card branch to one view using the shared `StatCard`. Desktop tables are untouched. Existing tests keep passing (default jsdom width → table branch). Each card task adds a `mockMatchMedia(true)` test asserting cards render and a `mockMatchMedia(false)` test asserting the table renders.

### Task 4: Shared `StatCard` primitive

**Files:**
- Create: `apps/web/src/components/report/StatCard.tsx`
- Create: `apps/web/src/components/report/StatCard.test.tsx`
- Modify: `apps/web/src/index.css` (card styles)

**Interfaces:**
- Produces:

```ts
import type { CSSProperties, ReactNode } from "react";

export interface StatCardRow { label: ReactNode; value: ReactNode; className?: string; }
export interface StatCardProps {
  title: ReactNode;
  titleStyle?: CSSProperties;   // e.g. classColorVar(class)
  titleClassName?: string;
  onTitleClick?: () => void;    // when set, title renders as a .player-link button
  rows: StatCardRow[];
}
// Components: StatCard(props: StatCardProps), StatCards({children}: {children: ReactNode})
```

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/report/StatCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatCard, StatCards } from "./StatCard";

describe("StatCard", () => {
  it("renders title and label/value rows with classNames", () => {
    render(
      <StatCard
        title="Thrall"
        rows={[
          { label: "Head", value: "Helm of Doom", className: "sev-major" },
          { label: "Neck", value: "Choker" },
        ]}
      />,
    );
    expect(screen.getByText("Thrall")).toBeInTheDocument();
    expect(screen.getByText("Head")).toBeInTheDocument();
    expect(screen.getByText("Helm of Doom").closest(".stat-card__row")).toHaveClass("sev-major");
  });

  it("renders a clickable title when onTitleClick is given", () => {
    const onClick = vi.fn();
    render(<StatCard title="Thrall" onTitleClick={onClick} rows={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Thrall" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("StatCards wraps children in a grid container", () => {
    const { container } = render(<StatCards><div>x</div></StatCards>);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- StatCard`
Expected: FAIL — `Cannot find module './StatCard'`.

- [ ] **Step 3: Implement `StatCard`**

`apps/web/src/components/report/StatCard.tsx`:

```tsx
import type { CSSProperties, ReactNode } from "react";

export interface StatCardRow {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

export interface StatCardProps {
  title: ReactNode;
  titleStyle?: CSSProperties;
  titleClassName?: string;
  onTitleClick?: () => void;
  rows: StatCardRow[];
}

export function StatCard({ title, titleStyle, titleClassName, onTitleClick, rows }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-card__title ${titleClassName ?? ""}`} style={titleStyle}>
        {onTitleClick ? (
          <button type="button" className="player-link" onClick={onTitleClick}>{title}</button>
        ) : (
          title
        )}
      </div>
      <dl className="stat-card__rows">
        {rows.map((r, i) => (
          <div key={i} className={`stat-card__row ${r.className ?? ""}`}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function StatCards({ children }: { children: ReactNode }) {
  return <div className="stat-cards">{children}</div>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- StatCard`
Expected: PASS (3 tests).

- [ ] **Step 5: Add CSS**

Append to `apps/web/src/index.css`:

```css
/* ── stat cards (phone presentation of dense tables) ─────── */
.stat-cards { display: flex; flex-direction: column; gap: 12px; }
.stat-card { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow: hidden; }
.stat-card__title {
  padding: 10px 14px; font-weight: 700; font-size: 15px;
  border-bottom: 1px solid var(--border); background: var(--surface-sunken);
}
.stat-card__title .player-link { font: inherit; color: inherit; }
.stat-card__rows { margin: 0; padding: 4px 0; }
.stat-card__row {
  display: flex; justify-content: space-between; gap: 14px;
  padding: 7px 14px; align-items: baseline;
}
.stat-card__row dt { color: var(--text-muted); font-size: 13px; flex: 0 0 auto; max-width: 50%; }
.stat-card__row dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
/* severity/heat classes set on the row tint its value */
.stat-card__row.sev-major dd, .stat-card__row.bad dd { color: var(--danger); }
.stat-card__row.sev-moderate dd, .stat-card__row.watch dd { color: var(--warn); }
.stat-card__row.sev-minor dd, .stat-card__row.sev-ok dd, .stat-card__row.good dd { color: var(--positive); }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/report/StatCard.tsx apps/web/src/components/report/StatCard.test.tsx apps/web/src/index.css
git commit -m "feat(web): shared StatCard primitive for mobile card views"
```

---

### Task 5: Gear cards (`GearMatrix`)

**Files:**
- Modify: `apps/web/src/components/report/GearMatrix.tsx`
- Create: `apps/web/src/components/report/GearMatrix.mobile.test.tsx`

**Interfaces:**
- Consumes: `useIsPhone` (Task 1), `StatCard`/`StatCards` (Task 4), existing `gearListing`/`gearIssues`/`SLOT_NAMES`/`SEVERITY_RANK`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/report/GearMatrix.mobile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { GearMatrix } from "./GearMatrix";
import type { ReportData } from "@wcl/core";
import { ALL_FIGHTS } from "../../lib/scopeReport";

// Minimal report with one boss fight + one player + one gear snapshot.
const report = {
  reportId: "r1", title: "T", zoneName: "BT", startTime: 0,
  players: [{ id: 1, name: "Thrall", class: "Shaman" }],
  fights: [{ id: 10, name: "Najentus", isBoss: true, kill: true, startTime: 0, endTime: 1000 }],
  gear: [{ fightId: 10, playerId: 1, items: { 0: { itemId: 100, name: "Helm" } } }],
} as unknown as ReportData;

afterEach(() => { /* @ts-expect-error */ delete window.matchMedia; });

describe("GearMatrix mobile", () => {
  it("renders stat cards (no table) on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<GearMatrix report={report} fightId={ALL_FIGHTS} onPlayer={() => {}} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table (no cards) on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<GearMatrix report={report} fightId={ALL_FIGHTS} onPlayer={() => {}} />);
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector(".stat-cards")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- GearMatrix.mobile`
Expected: FAIL — both assertions fail (no `.stat-cards`; component still always renders a table).

- [ ] **Step 3: Add the phone branch to `GearMatrix`**

In `apps/web/src/components/report/GearMatrix.tsx`, add imports:

```tsx
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";
```

Inside the component, after `const [selected, setSelected] = useState<Selection | null>(null);` add:

```tsx
const isPhone = useIsPhone();
```

After the `if (!fight) return ...` guard, before the desktop `return (`, insert:

```tsx
if (isPhone) {
  return (
    <>
      {isAll && <p className="notice">Gear is a snapshot per pull — showing {fight.name}.</p>}
      <StatCards>
        {sortedRows.map((r) => (
          <StatCard
            key={r.playerId}
            title={r.playerName}
            titleStyle={classColorVar(classOf.get(r.playerId) ?? "")}
            onTitleClick={() => onPlayer(r.playerName)}
            rows={PROFILE_GEAR_SLOTS.map((s) => {
              const item = r.items[s];
              const itemIssues = item ? issues.get(r.playerId)?.get(item.itemId) : undefined;
              const worst = itemIssues?.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
              return {
                label: SLOT_NAMES[s],
                value: item?.name ?? "—",
                className: worst ? `sev-${worst.severity}` : undefined,
              };
            })}
          />
        ))}
      </StatCards>
    </>
  );
}
```

(The gear-issue modal is desktop-only; on phones the severity color on the row conveys the flag. This is acceptable per spec — card rows keep the `sev-*` encoding.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- GearMatrix`
Expected: PASS (mobile + any existing GearMatrix tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/report/GearMatrix.tsx apps/web/src/components/report/GearMatrix.mobile.test.tsx
git commit -m "feat(web): gear matrix renders per-player cards on phones"
```

---

### Task 6: Rankings cards (`SummaryRankings`)

**Files:**
- Modify: `apps/web/src/components/report/SummaryRankings.tsx`
- Create: `apps/web/src/components/report/SummaryRankings.mobile.test.tsx`

**Interfaces:** Consumes `useIsPhone`, `StatCard`/`StatCards`, existing `buildRankingsGrid`, `parseClass`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/report/SummaryRankings.mobile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { SummaryRankings } from "./SummaryRankings";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    buildRankingsGrid: () => ({
      bosses: [{ fightID: 1, name: "Najentus" }],
      sections: [{
        role: "dps",
        players: [{ name: "Thrall", class: "Shaman", overall: 95, perBoss: { 1: { rankPercent: 95 } } }],
      }],
    }),
  };
});

const report = { rankings: {} } as unknown as ReportData;
afterEach(() => { /* @ts-expect-error */ delete window.matchMedia; });

describe("SummaryRankings mobile", () => {
  it("renders cards on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<SummaryRankings report={report} onPlayer={() => {}} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<SummaryRankings report={report} onPlayer={() => {}} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- SummaryRankings.mobile`
Expected: FAIL — no `.stat-cards`.

- [ ] **Step 3: Add the phone branch**

In `apps/web/src/components/report/SummaryRankings.tsx`, add imports:

```tsx
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";
```

Make the component compute `const isPhone = useIsPhone();` at the top (before the early `return`s is fine — hooks must run unconditionally, so place it as the first statement of the component body). Then, after the two early guards (`rankings === undefined`, `!grid`), in the per-section render replace the `<div className="scroll-x">...table...</div>` with a conditional. Concretely, change each section body to:

```tsx
{grid.sections.map((section) => (
  <section key={section.role} className="card">
    <h3>{ROLE_LABEL[section.role]}</h3>
    {isPhone ? (
      <StatCards>
        {section.players.map((p) => (
          <StatCard
            key={p.name}
            title={p.name}
            titleStyle={classColorVar(p.class)}
            onTitleClick={() => onPlayer(p.name)}
            rows={[
              { label: "Avg", value: Math.round(p.overall), className: parseClass(p.overall) },
              ...grid.bosses.map((b) => {
                const cell = p.perBoss[b.fightID];
                return {
                  label: b.name,
                  value: cell ? cell.rankPercent : "—",
                  className: cell ? parseClass(cell.rankPercent) : "sev-neutral",
                };
              }),
            ]}
          />
        ))}
      </StatCards>
    ) : (
      <div className="scroll-x">
        <table className="rank-table">
          {/* unchanged existing thead/tbody */}
        </table>
      </div>
    )}
  </section>
))}
```

Keep the existing `<thead>`/`<tbody>` markup verbatim inside the desktop `<table>`.

Note: `parseClass` returns a parse-color class, not a `sev-*` class, so card-row tinting for rankings comes from `parseClass` styling already present in `index.css` applied to `dd` — if parse colors are defined as text colors on those classes they will apply to the `dd`. Verify visually in Step 5; no extra CSS needed because `parseClass` classes already color text.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- SummaryRankings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/report/SummaryRankings.tsx apps/web/src/components/report/SummaryRankings.mobile.test.tsx
git commit -m "feat(web): rankings render per-player cards on phones"
```

---

### Task 7: Buff-consumables cards (`ConsumablesView`)

**Files:**
- Modify: `apps/web/src/components/ConsumablesView.tsx`
- Create: `apps/web/src/components/ConsumablesView.mobile.test.tsx`

**Interfaces:** Consumes `useIsPhone`, `StatCard`/`StatCards`, existing `consumables`, `uptimeSeverity`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/ConsumablesView.mobile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../test-utils/matchMedia";
import { ConsumablesView } from "./ConsumablesView";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    consumables: () => ({
      rows: [{
        playerId: 1, playerName: "Thrall", totalAverage: 0.9, elixirOrFlask: 1,
        battleElixir: 0, battleElixirNames: [], guardianElixir: 0, guardianElixirNames: [],
        flask: 1, flaskNames: ["Flask of Relentless Assault"], food: 1, scrolls: "",
        weaponEnhancement: 1, jcNeck: { equipped: false, usedOnFights: 0, inactiveOnFights: 0 },
        suboptimal: [],
      }],
    }),
  };
});

const report = { players: [{ id: 1, name: "Thrall", class: "Shaman" }] } as unknown as ReportData;
afterEach(() => { /* @ts-expect-error */ delete window.matchMedia; });

describe("ConsumablesView mobile", () => {
  it("renders cards on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<ConsumablesView report={report} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<ConsumablesView report={report} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- ConsumablesView.mobile`
Expected: FAIL — no `.stat-cards`.

- [ ] **Step 3: Add the phone branch**

In `apps/web/src/components/ConsumablesView.tsx`, add imports:

```tsx
import { useIsPhone } from "../lib/useMediaQuery";
import { StatCard, StatCards } from "./report/StatCard";
```

Add `const isPhone = useIsPhone();` as the first statement of the component body (before early returns; hooks run unconditionally). After the `rows.length === 0` guard and before the desktop `return`, insert:

```tsx
if (isPhone) {
  const sev = (v: number) => `sev-${uptimeSeverity(v)}`;
  return (
    <div>
      <p><small>Only boss fights evaluated. Some T6 fights miss combatantInfo — stand close to the boss at pull.</small></p>
      <StatCards>
        {rows.map((r) => (
          <StatCard
            key={r.playerId}
            title={r.playerName}
            titleStyle={classColorVar(classOf.get(r.playerId) ?? "")}
            onTitleClick={onPlayer ? () => onPlayer(r.playerName) : undefined}
            rows={[
              { label: "Total avg (excl. Scrolls)", value: pct(r.totalAverage), className: sev(r.totalAverage) },
              { label: "Elixir or Flask", value: pct(r.elixirOrFlask), className: sev(r.elixirOrFlask) },
              { label: "Battle Elixir", value: `${pct(r.battleElixir)}${r.battleElixirNames.length ? ` — ${r.battleElixirNames.join(", ")}` : ""}` },
              { label: "Guardian Elixir", value: `${pct(r.guardianElixir)}${r.guardianElixirNames.length ? ` — ${r.guardianElixirNames.join(", ")}` : ""}` },
              { label: "Flask", value: `${pct(r.flask)}${r.flaskNames.length ? ` — ${r.flaskNames.join(", ")}` : ""}` },
              { label: "Food Buff", value: pct(r.food), className: sev(r.food) },
              { label: "Scrolls", value: r.scrolls || "—" },
              { label: "Weapon Enhancement", value: r.weaponEnhancement === null ? "—" : pct(r.weaponEnhancement), className: r.weaponEnhancement === null ? undefined : sev(r.weaponEnhancement) },
              { label: "JC neck", value: r.jcNeck.equipped ? `${r.jcNeck.usedOnFights}${r.jcNeck.inactiveOnFights > 0 ? ` — inactive on ${r.jcNeck.inactiveOnFights}` : ""}` : "—", className: r.jcNeck.inactiveOnFights > 0 ? "sev-moderate" : undefined },
              { label: "Suboptimal found", value: r.suboptimal.length ? r.suboptimal.join(", ") : "—", className: r.suboptimal.length ? "sev-moderate" : undefined },
            ]}
          />
        ))}
      </StatCards>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- ConsumablesView`
Expected: PASS (mobile + existing `ConsumablesView.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ConsumablesView.tsx apps/web/src/components/ConsumablesView.mobile.test.tsx
git commit -m "feat(web): buff-consumables render per-player cards on phones"
```

---

### Task 8: Consumable-matrix cards (`ConsumableMatrix`)

This view is transposed (consumables = rows, players = columns). On phones, pivot to one card per player; rows are the catalog entries with that player's count/uptime.

**Files:**
- Modify: `apps/web/src/components/ConsumableMatrix.tsx`
- Create: `apps/web/src/components/ConsumableMatrix.mobile.test.tsx`

**Interfaces:** Consumes `useIsPhone`, `StatCard`/`StatCards`. Props unchanged (`rows: RpbConsumableRow[]`, `catalog`, `onPlayer?`).

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/ConsumableMatrix.mobile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "../test-utils/matchMedia";
import { ConsumableMatrix } from "./ConsumableMatrix";
import type { RpbConsumableRow } from "@wcl/core";

const rows = [
  { playerId: 1, playerName: "Thrall", className: "Shaman", counts: { drums: 3 }, uptimes: {} },
] as unknown as RpbConsumableRow[];
const catalog = [{ key: "drums", name: "Drums of Battle" }];

afterEach(() => { /* @ts-expect-error */ delete window.matchMedia; });

describe("ConsumableMatrix mobile", () => {
  it("renders one card per player on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
    expect(screen.getByText("Drums of Battle")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<ConsumableMatrix rows={rows} catalog={catalog} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- ConsumableMatrix.mobile`
Expected: FAIL — no `.stat-cards`.

- [ ] **Step 3: Add the phone branch**

In `apps/web/src/components/ConsumableMatrix.tsx`, add imports:

```tsx
import { useIsPhone } from "../lib/useMediaQuery";
import { StatCard, StatCards } from "./report/StatCard";
```

Add `const isPhone = useIsPhone();` as the first statement of the component body. After the `rows.length === 0` guard (keep it) and after computing `players`, insert before the desktop `return`:

```tsx
if (isPhone) {
  return (
    <StatCards>
      {players.map((p) => (
        <StatCard
          key={p.playerId}
          title={p.playerName}
          titleStyle={classColorVar(p.className)}
          onTitleClick={onPlayer ? () => onPlayer(p.playerName) : undefined}
          rows={catalog
            .map((c) => {
              const count = p.counts[c.key] ?? 0;
              if (count === 0) return null;
              const value = c.uptime
                ? `${count} (${Math.round((p.uptimes?.[c.key] ?? 0) * 100)}%)`
                : String(count);
              return { label: c.name, value };
            })
            .filter((r): r is { label: string; value: string } => r !== null)}
        />
      ))}
    </StatCards>
  );
}
```

(Zero-count entries are omitted on phones to keep cards short — matches the desktop blank-cell behavior.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- ConsumableMatrix`
Expected: PASS (mobile + existing `ConsumableMatrix.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ConsumableMatrix.tsx apps/web/src/components/ConsumableMatrix.mobile.test.tsx
git commit -m "feat(web): consumable matrix renders per-player cards on phones"
```

---

### Task 9: Shadow-resistance cards (`ShadowResView`)

**Files:**
- Modify: `apps/web/src/components/ShadowResView.tsx`
- Create: `apps/web/src/components/ShadowResView.mobile.test.tsx`

**Interfaces:** Consumes `useIsPhone`, `StatCard`/`StatCards`, existing `shadowResistance`, `LISTING_SLOTS`, `SLOT_NAMES`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/ShadowResView.mobile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../test-utils/matchMedia";
import { ShadowResView } from "./ShadowResView";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    shadowResistance: () => ({
      boss: "Mother Shahraz", availableBosses: ["Mother Shahraz"], isKill: true,
      players: [{ playerId: 1, name: "Thrall", total: 60, fromGear: 45, fromBuffs: 15, severity: "ok", slots: { 0: "Hood (~30 SR)" } }],
    }),
  };
});

const report = {} as unknown as ReportData;
afterEach(() => { /* @ts-expect-error */ delete window.matchMedia; });

describe("ShadowResView mobile", () => {
  it("renders cards on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<ShadowResView report={report} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<ShadowResView report={report} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- ShadowResView.mobile`
Expected: FAIL — no `.stat-cards`.

- [ ] **Step 3: Add the phone branch**

In `apps/web/src/components/ShadowResView.tsx`, add imports:

```tsx
import { useIsPhone } from "../lib/useMediaQuery";
import { StatCard, StatCards } from "./report/StatCard";
```

Add `const isPhone = useIsPhone();` as the first statement of the component body. After the `result === null` guard, insert before the desktop `return`:

```tsx
if (isPhone) {
  return (
    <div>
      <p>
        <label>
          boss:{" "}
          <select value={result.boss} onChange={(e) => setBoss(e.target.value as SrBoss)}>
            {result.availableBosses.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>{" "}
        <small>analyzing the {result.isKill ? "kill" : "longest wipe"}.</small>
      </p>
      <StatCards>
        {result.players.map((p) => (
          <StatCard
            key={p.playerId}
            title={p.name}
            rows={[
              { label: "SR (gear + buffs)", value: p.total, className: `sev-${p.severity}` },
              { label: "from gear", value: p.fromGear },
              { label: "from buffs", value: p.fromBuffs },
              ...LISTING_SLOTS
                .filter((s) => p.slots[s])
                .map((s) => ({ label: SLOT_NAMES[s], value: p.slots[s] as string })),
            ]}
          />
        ))}
      </StatCards>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- ShadowResView`
Expected: PASS (mobile + existing `ShadowResView.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ShadowResView.tsx apps/web/src/components/ShadowResView.mobile.test.tsx
git commit -m "feat(web): shadow-res renders per-player cards on phones"
```

---

### Task 10: Performance-summary cards (`PerformanceView`)

The panels are ranked source/ability lists (not per-player rows). On phones, render each panel's rows as `StatCards` where each card title is the source/ability name and rows are %/amount/rate.

**Files:**
- Modify: `apps/web/src/components/report/PerformanceView.tsx`
- Create: `apps/web/src/components/report/PerformanceView.mobile.test.tsx`

**Interfaces:** Consumes `useIsPhone`, `StatCard`/`StatCards`. `SourcePanel`/`AbilityPanel`/`DeathsPanel` gain an internal phone branch.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/report/PerformanceView.mobile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { PerformanceView } from "./PerformanceView";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    performanceSummary: () => ({
      damageBySource: [{ id: 1, name: "Thrall", className: "Shaman", percent: 0.5, amount: 100000, rate: 2500 }],
      healingBySource: [],
      damageTakenByAbility: [],
      deaths: [],
    }),
  };
});

const report = {} as unknown as ReportData;
afterEach(() => { /* @ts-expect-error */ delete window.matchMedia; });

describe("PerformanceView mobile", () => {
  it("renders cards on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<PerformanceView report={report} fightId={0} onPlayer={() => {}} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders tables on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<PerformanceView report={report} fightId={0} onPlayer={() => {}} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- PerformanceView.mobile`
Expected: FAIL — no `.stat-cards`.

- [ ] **Step 3: Add phone branches to the panels**

In `apps/web/src/components/report/PerformanceView.tsx`, add imports:

```tsx
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";
```

In `SourcePanel`, add `const isPhone = useIsPhone();` as the first line and branch before the existing `<div className="scroll-x">`:

```tsx
if (isPhone) {
  return (
    <section className="card perf-panel">
      <h3>{title}</h3>
      <StatCards>
        {rows.map((r) => (
          <StatCard
            key={r.id}
            title={r.name}
            titleStyle={classColorVar(r.className ?? "")}
            onTitleClick={() => onPlayer(r.name)}
            rows={[
              { label: "%", value: pct(r.percent) },
              { label: "Amount", value: amount(r.amount) },
              { label: rateLabel, value: rate(r.rate) },
            ]}
          />
        ))}
      </StatCards>
    </section>
  );
}
```

Apply the same pattern to `AbilityPanel` (titles = ability name; rows = `%`, `Amount`, `DTPS`; no `onTitleClick`) and `DeathsPanel` (title = player name with `classColorVar`/`onPlayer`; rows = the death's ability/time fields as currently shown in its table). Read each panel's existing `<tbody>` to mirror exactly which fields and formatters (`pct`, `amount`, `rate`, `mmss`) it uses, and reuse those same formatters in the card rows.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- PerformanceView`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/report/PerformanceView.tsx apps/web/src/components/report/PerformanceView.mobile.test.tsx
git commit -m "feat(web): performance summary renders cards on phones"
```

---

### Task 11: Role-breakdown cards — By Stats (`RoleSheetTable`)

Transposed table (metrics = rows, players = columns). On phones, pivot to one card per player; card rows are the metric rows (with band labels prefixed). Preserve `player-link` + class color on title.

**Files:**
- Modify: `apps/web/src/components/report/RoleSheetTable.tsx`
- Create: `apps/web/src/components/report/RoleSheetTable.mobile.test.tsx`

**Interfaces:** Consumes `useIsPhone`, `StatCard`/`StatCards`. The existing `sections`/`MetricRow`/`Cell` types are reused to build card rows.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/report/RoleSheetTable.mobile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { RoleSheetTable } from "./RoleSheetTable";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    roleSheet: () => ([
      {
        playerId: 1, playerName: "Thrall", className: "Shaman",
        battleShoutUptime: 0, hitStats: undefined, trinketUses: [], avoidableByAbility: [],
        damageReflected: 0, damageToHostilePlayers: 0, friendlyFire: 0, deaths: 2,
        totalAvoidableDamageTaken: 5000, debuffsApplied: [],
      },
    ]),
  };
});

const report = {} as unknown as ReportData;
afterEach(() => { /* @ts-expect-error */ delete window.matchMedia; });

describe("RoleSheetTable mobile", () => {
  it("renders one card per player on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<RoleSheetTable report={report} fightId={0} role="tank" onPlayer={() => {}} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<RoleSheetTable report={report} fightId={0} role="tank" onPlayer={() => {}} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- RoleSheetTable.mobile`
Expected: FAIL — no `.stat-cards`.

- [ ] **Step 3: Add the phone branch**

In `apps/web/src/components/report/RoleSheetTable.tsx`, add imports:

```tsx
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";
```

Add `const isPhone = useIsPhone();` as the first statement of the component body (before the early `return`s; hooks run unconditionally). After `sections` is built and before the desktop `return (`, insert:

```tsx
if (isPhone) {
  return (
    <StatCards>
      {rows.map((r) => (
        <StatCard
          key={r.playerId}
          title={r.playerName}
          titleStyle={classColorVar(r.className)}
          onTitleClick={() => onPlayer(r.playerName)}
          rows={sections.flatMap((s) =>
            s.rows.map((mr) => {
              const c = mr.cell(r);
              return { label: `${s.band} · ${mr.label}`, value: c.content, className: c.className };
            }),
          )}
        />
      ))}
    </StatCards>
  );
}
```

(`sections` and the `Cell.className` carry the same heat/severity classes as the table, so card rows keep their coloring.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- RoleSheetTable`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/report/RoleSheetTable.tsx apps/web/src/components/report/RoleSheetTable.mobile.test.tsx
git commit -m "feat(web): role-breakdown stats render per-player cards on phones"
```

---

### Task 12: Role-breakdown cards — By Casts (`RoleCastsTable`)

Transposed per class block (abilities = rows, players = columns). On phones, for each class block render one card per player; rows = ability cast counts grouped by category band, then the activity rows.

**Files:**
- Modify: `apps/web/src/components/report/RoleCastsTable.tsx`
- Create: `apps/web/src/components/report/RoleCastsTable.mobile.test.tsx`

**Interfaces:** Consumes `useIsPhone`, `StatCard`/`StatCards`. Reuses existing `CATEGORY_ORDER`, `CATEGORY_LABELS`, `ACTIVITY_ROWS`, `abilitiesByCategory`, `presentCategories`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/report/RoleCastsTable.mobile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { RoleCastsTable } from "./RoleCastsTable";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    roleCasts: () => ([
      {
        className: "Shaman",
        players: [{ playerId: 1, playerName: "Thrall" }],
        abilities: [{ key: "lb", name: "Lightning Bolt", category: "single" }],
        counts: new Map([["1:lb", { castCount: 12 }]]),
        activity: new Map([[1, { secondsActiveST: 100, relativeActiveST: 0.8, relativeActiveTotal: 0.8, relativeActiveAoe: 0, secondsActiveAoe: 0 }]]),
      },
    ]),
  };
});

const report = {} as unknown as ReportData;
afterEach(() => { /* @ts-expect-error */ delete window.matchMedia; });

describe("RoleCastsTable mobile", () => {
  it("renders one card per player on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<RoleCastsTable report={report} fightId={0} role="caster" onPlayer={() => {}} />);
    expect(container.querySelector(".stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.getByText("Thrall")).toBeInTheDocument();
    expect(screen.getByText(/Lightning Bolt/)).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<RoleCastsTable report={report} fightId={0} role="caster" onPlayer={() => {}} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- RoleCastsTable.mobile`
Expected: FAIL — no `.stat-cards`.

- [ ] **Step 3: Add the phone branch**

In `apps/web/src/components/report/RoleCastsTable.tsx`, add imports:

```tsx
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";
```

Add `const isPhone = useIsPhone();` as the first statement of the component body. The component already computes `visibleBlocks` and (per block) `abilitiesByCategory`/`presentCategories` inside the `visibleBlocks.map`. To share that grouping with the card branch, the per-block grouping logic is currently inline in the map. For the phone branch, replicate the same grouping in a small helper used by both branches:

Define above the `return`, after `visibleBlocks` is computed:

```tsx
const groupAbilities = (block: (typeof visibleBlocks)[number]) => {
  const byCat = new Map<CastCategory, { key: string; name: string; category: CastCategory }[]>();
  for (const cat of CATEGORY_ORDER) {
    const abils = block.abilities.filter((a) => a.category === cat);
    if (abils.length > 0) byCat.set(cat, abils);
  }
  return { byCat, present: CATEGORY_ORDER.filter((c) => byCat.has(c)) };
};
```

Refactor the existing desktop map to call `const { byCat: abilitiesByCategory, present: presentCategories } = groupAbilities(block);` instead of the inline construction (replace the two inline blocks that build `abilitiesByCategory` and `presentCategories` with this one line; the `countsByAbility` block stays).

Then insert before the desktop `return (`:

```tsx
if (isPhone) {
  return (
    <div className="role-casts-table">
      {/* class filter unchanged — keep the existing classNames.length > 1 block here too */}
      {visibleBlocks.map((block) => {
        const { byCat, present } = groupAbilities(block);
        return (
          <section key={block.className} className="class-cast-block">
            <h3 className="class-cast-title">{block.className}s</h3>
            <StatCards>
              {block.players.map((player) => (
                <StatCard
                  key={player.playerId}
                  title={player.playerName}
                  style={undefined}
                  titleStyle={classColorVar(block.className)}
                  onTitleClick={() => onPlayer(player.playerName)}
                  rows={[
                    ...present.flatMap((cat) =>
                      (byCat.get(cat) ?? []).map((ability) => {
                        const count = block.counts.get(`${player.playerId}:${ability.key}`)?.castCount ?? 0;
                        return { label: `${CATEGORY_LABELS[cat]} · ${ability.name}`, value: count === 0 ? "—" : count };
                      }),
                    ),
                    ...ACTIVITY_ROWS.map((ar) => {
                      const act = block.activity.get(player.playerId) ?? null;
                      return { label: `Activity · ${ar.label}`, value: act ? ar.fmt(act) : "—" };
                    }),
                  ]}
                />
              ))}
            </StatCards>
          </section>
        );
      })}
    </div>
  );
}
```

Remove the stray `style={undefined}` line if your linter flags it — `StatCard` has no `style` prop; it was illustrative. Keep only `titleStyle`.

To reuse the class-filter UI in both branches without duplication, extract the existing `classNames.length > 1` filter `<div>` into a local `const classFilter = (...)` element declared before both branches and render `{classFilter}` at the top of each branch's wrapper.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- RoleCastsTable`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/report/RoleCastsTable.tsx apps/web/src/components/report/RoleCastsTable.mobile.test.tsx
git commit -m "feat(web): role-breakdown casts render per-player cards on phones"
```

---

### Task 13: Player-profile inner table + final polish

`PlayerProfile` is already mostly card-like (tiles + `.card` sections) and stacks via the existing `@media (max-width: 880px)`. Only its "Per-boss breakdown" `<table>` needs phone treatment, plus a final 320px overflow pass.

**Files:**
- Modify: `apps/web/src/components/report/PlayerProfile.tsx`
- Create: `apps/web/src/components/report/PlayerProfile.mobile.test.tsx`
- Modify: `apps/web/src/index.css` (final polish only if the manual pass finds gaps)

**Interfaces:** Consumes `useIsPhone`, `StatCard`/`StatCards`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/report/PlayerProfile.mobile.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../test-utils/matchMedia";
import { PlayerProfile } from "./PlayerProfile";
import type { ReportData } from "@wcl/core";

vi.mock("@wcl/core", async (orig) => {
  const actual = await orig<typeof import("@wcl/core")>();
  return {
    ...actual,
    rpb: () => ({ rows: [{ playerId: 1, role: "physical", deaths: 1, totalAvoidableDamageTaken: 0, interruptedSpells: 0, activity: { relativeActiveST: 0.9 } }] }),
    consumables: () => ({ rows: [] }),
    gearListing: () => ({ rows: [] }),
    gearIssues: () => ([]),
    listGearFights: () => ([{ id: 10 }]),
  };
});

const report = {
  players: [{ id: 1, name: "Thrall", class: "Shaman" }],
  fights: [{ id: 10, name: "Najentus", isBoss: true, kill: true, startTime: 0, endTime: 1000 }],
  gear: [],
} as unknown as ReportData;

afterEach(() => { /* @ts-expect-error */ delete window.matchMedia; });

describe("PlayerProfile mobile", () => {
  it("renders the per-boss breakdown as cards (no inner table) on phones", () => {
    mockMatchMedia(true);
    const { container } = render(<PlayerProfile report={report} playerId={1} />);
    expect(container.querySelector(".profile .stat-cards")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
  });

  it("renders the per-boss breakdown table on desktop", () => {
    mockMatchMedia(false);
    const { container } = render(<PlayerProfile report={report} playerId={1} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- PlayerProfile.mobile`
Expected: FAIL — table still renders on phones.

- [ ] **Step 3: Add the phone branch for the per-boss table**

In `apps/web/src/components/report/PlayerProfile.tsx`, add imports:

```tsx
import { useIsPhone } from "../../lib/useMediaQuery";
import { StatCard, StatCards } from "./StatCard";
```

Add `const isPhone = useIsPhone();` as the first statement of the component body (before early returns). Replace the per-boss `<div className="scroll-x"><table>...</table></div>` block (inside the "Per-boss breakdown" `<section className="card">`) with:

```tsx
{isPhone ? (
  <StatCards>
    {perBoss.map(({ fight, row: br }) => (
      <StatCard
        key={fight.id}
        title={fight.name}
        rows={[
          { label: "Deaths", value: br?.deaths ?? 0, className: heatClass(deathsHeat(br?.deaths ?? 0)) },
          { label: "Avoidable", value: (br?.totalAvoidableDamageTaken ?? 0).toLocaleString() },
          { label: "Uptime", value: br?.activity ? pct(br.activity.relativeActiveST) : "—" },
        ]}
      />
    ))}
  </StatCards>
) : (
  <div className="scroll-x">
    <table>
      {/* unchanged existing thead/tbody */}
    </table>
  </div>
)}
```

Keep the existing `<thead>`/`<tbody>` verbatim inside the desktop `<table>`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- PlayerProfile`
Expected: PASS.

- [ ] **Step 5: Full-suite + build + manual 320px audit**

Run: `pnpm test` → all pass.
Run: `pnpm build` → succeeds.
Run: `pnpm dev` and at 320px / 375px walk every report category (Rankings, Summary, Role breakdown both modes, Gear, Consumables, Buff consumables, Resistances) and a player profile. Confirm: no horizontal page scroll, cards readable, severity colors visible, drawer works. If any view overflows, add a targeted rule under the existing `@media (max-width: 640px)` block (e.g. `.stat-card__row dd { max-width: 60%; }`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/report/PlayerProfile.tsx apps/web/src/components/report/PlayerProfile.mobile.test.tsx apps/web/src/index.css
git commit -m "feat(web): player-profile per-boss cards + final mobile polish"
```

---

## Self-Review

**Spec coverage:**
- Mechanism & breakpoints (`useMediaQuery`, 640px) → Task 1. ✓
- Drawer nav + slim bar → Task 2. ✓
- Fight-chip scroll strip → Task 3. ✓
- Touch targets, Home/Settings stacking, 320px overflow → Tasks 3 & 13. ✓
- Shared `StatCard` primitive → Task 4. ✓
- Per-view cards: Gear (5), Rankings (6), Consumables/Buff (7), Consumable matrix (8), Shadow res (9), Performance (10), Role casts (12)/sheet (11), Player profile (13). ✓
- Testing: hook test (1), drawer test (2), per-view card-vs-table tests via `mockMatchMedia` (5–13). ✓
- Non-goals respected: no core/analysis/`SCHEMA_VERSION` changes (Global Constraints). ✓

**Placeholder scan:** Task 10 (`AbilityPanel`/`DeathsPanel`) and Task 12 (class-filter extraction) instruct reading the existing `<tbody>` to mirror fields — these reference concrete existing code in the same file rather than leaving content "TBD"; the formatters (`pct`, `amount`, `rate`, `mmss`) and patterns are named explicitly. Acceptable because the desktop source is the authoritative, present reference.

**Type consistency:** `StatCardRow`/`StatCardProps` (Task 4) are used consistently in Tasks 5–13. `mockMatchMedia` (Task 1) imported from `../test-utils/matchMedia` / `../../test-utils/matchMedia` per directory depth. `useIsPhone`/`PHONE_QUERY` consistent.

**Scope note:** The plan is large but single-subsystem (mobile presentation). It is split into Phase 1 (independently shippable) and Phase 2 (per-view, each task independently shippable) so reviews stay bounded.
