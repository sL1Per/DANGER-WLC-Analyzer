import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { applyHideEmpty } from "../../lib/hideEmpty";
import { tagColumns, attachColumnHover } from "../../lib/tableCrosshair";

const KEY = "wcl.hideEmpty";

/**
 * Wraps report content with a "Hide empty rows & columns" checkbox and a
 * row+column highlight-on-hover crosshair, both applied to every <table> rendered
 * inside it (the row half is CSS, the column half is tagged here). Works on the
 * rendered DOM, so it covers all tabs/tables uniformly. A MutationObserver
 * re-applies on tab/data changes; the choice persists in localStorage.
 */
export function EmptyToggle({ children }: { children: ReactNode }) {
  const [hide, setHide] = useState(() => localStorage.getItem(KEY) === "1");
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => {
      applyHideEmpty(el, hide);
      tagColumns(el); // (re)tag columns for the hover crosshair
    };
    run();
    const detach = attachColumnHover(el);
    // Re-apply when the rendered tables change (tab switch, async load). Disconnect
    // around our own mutations so setting eh-hidden doesn't re-trigger the observer.
    const obs = new MutationObserver(() => {
      obs.disconnect();
      run();
      obs.observe(el, { childList: true, subtree: true, characterData: true });
    });
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      detach();
    };
  }, [hide]);

  return (
    <>
      <label className="empty-toggle">
        <input
          type="checkbox"
          checked={hide}
          onChange={(e) => {
            setHide(e.target.checked);
            localStorage.setItem(KEY, e.target.checked ? "1" : "0");
          }}
        />
        Hide empty rows &amp; columns
      </label>
      <div ref={ref} className="empty-toggle-body">
        {children}
      </div>
    </>
  );
}
