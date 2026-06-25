/**
 * Column-highlight-on-hover for every <table> under a root. CSS can't target a
 * whole column on hover, so we tag each cell with its grid column (colspan/rowspan
 * aware) and, on hover, add `.xh-col` to every cell sharing that column — a
 * translucent overlay that works over any cell background. Makes wide tables
 * (e.g. the transposed Role Breakdown sheets) easy to read down a player column.
 */

/** Tag every single-column cell with its grid column index (`data-xcol`). */
export function tagColumns(root: HTMLElement): void {
  for (const table of root.querySelectorAll("table")) {
    const carry: number[] = []; // remaining rows a spanning cell occupies, per column
    for (const tr of [...table.rows]) {
      let col = 0;
      for (const cell of [...tr.cells]) {
        while ((carry[col] ?? 0) > 0) col++;
        const colspan = cell.colSpan || 1;
        const rowspan = cell.rowSpan || 1;
        if (colspan === 1) cell.dataset.xcol = String(col);
        else delete cell.dataset.xcol; // band/section headers span columns → no single column
        for (let c = col; c < col + colspan; c++) carry[c] = rowspan;
        col += colspan;
      }
      for (let c = 0; c < carry.length; c++) if ((carry[c] ?? 0) > 0) carry[c]!--;
    }
  }
}

function clear(root: HTMLElement): void {
  for (const el of root.querySelectorAll(".xh-col")) el.classList.remove("xh-col");
}

/** Attach the column-hover behaviour to `root`. Returns a cleanup function. */
export function attachColumnHover(root: HTMLElement): () => void {
  const onOver = (e: Event) => {
    const cell = (e.target as HTMLElement).closest("td, th") as HTMLTableCellElement | null;
    if (!cell || !root.contains(cell)) return;
    const col = cell.dataset.xcol;
    const table = cell.closest("table");
    if (col === undefined || !table) {
      clear(root);
      return;
    }
    clear(root);
    for (const c of table.querySelectorAll(`[data-xcol="${col}"]`)) c.classList.add("xh-col");
  };
  const onLeave = () => clear(root);

  root.addEventListener("mouseover", onOver);
  root.addEventListener("mouseleave", onLeave);
  return () => {
    root.removeEventListener("mouseover", onOver);
    root.removeEventListener("mouseleave", onLeave);
    clear(root);
  };
}
