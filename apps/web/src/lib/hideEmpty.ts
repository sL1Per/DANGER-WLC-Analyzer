/**
 * Generic "hide empty rows/columns" for any rendered <table>.
 *
 * The app marks an absent value with an em dash ("—") or a blank cell, so those
 * are treated as empty. A literal "0" is real data and is NOT hidden. The helper
 * works on the rendered DOM (rather than each table's data model) so a single
 * toggle can cover every table in a view regardless of how it was built.
 */

/** Cell text values treated as "empty". */
const EMPTY = new Set(["", "—", "-"]);

const isEmptyCell = (c: Element): boolean => EMPTY.has((c.textContent ?? "").trim());

const isHeaderRow = (tr: HTMLTableRowElement): boolean =>
  tr.cells.length > 0 && [...tr.cells].every((c) => c.tagName === "TH");

/**
 * Hide (hide=true) or restore (hide=false) empty rows and columns in every
 * <table> under `root`. Idempotent: hidden elements are marked with the
 * `eh-hidden` class (CSS sets display:none), and every call first clears the
 * previous marks, so toggling off fully restores the original layout.
 */
export function applyHideEmpty(root: HTMLElement, hide: boolean): void {
  for (const el of root.querySelectorAll(".eh-hidden")) el.classList.remove("eh-hidden");
  if (!hide) return;
  for (const table of root.querySelectorAll("table")) hideInTable(table);
  hideInCards(root);
}

/**
 * Mobile presentation of the same toggle: report views render one `.stat-card`
 * per player instead of a table, with each metric a `.stat-card__row` (`dt`
 * label + `dd` value). Hide rows whose value is empty, and hide a whole card
 * when every row is empty (the per-card analog of an empty column/row).
 */
function hideInCards(root: HTMLElement): void {
  for (const card of root.querySelectorAll<HTMLElement>(".stat-card")) {
    const rows = [...card.querySelectorAll<HTMLElement>(".stat-card__row")];
    if (rows.length === 0) continue;
    let visible = 0;
    for (const row of rows) {
      const value = row.querySelector("dd");
      if (value && isEmptyCell(value)) row.classList.add("eh-hidden");
      else visible++;
    }
    if (visible === 0) card.classList.add("eh-hidden");
  }
}

interface GridCell {
  cell: HTMLTableCellElement;
  col: number;
  colspan: number;
  body: boolean;
  data: boolean; // <td> (data) vs <th> (label/header)
}

function hideInTable(table: HTMLTableElement): void {
  const rows = [...table.rows];

  // Map every cell to its starting column, honouring colspan/rowspan.
  const grid: GridCell[] = [];
  const carry: number[] = []; // remaining rows a spanning cell occupies, per column
  for (const tr of rows) {
    const body = tr.parentElement?.tagName === "TBODY";
    let col = 0;
    for (const cell of [...tr.cells]) {
      while ((carry[col] ?? 0) > 0) col++;
      const colspan = cell.colSpan || 1;
      const rowspan = cell.rowSpan || 1;
      grid.push({ cell, col, colspan, body, data: cell.tagName === "TD" });
      for (let c = col; c < col + colspan; c++) carry[c] = rowspan;
      col += colspan;
    }
    for (let c = 0; c < carry.length; c++) if ((carry[c] ?? 0) > 0) carry[c]!--;
  }

  const bodyRows = rows.filter((tr) => tr.parentElement?.tagName === "TBODY");

  // Empty rows: a body row whose <td> cells are all empty (label <th> ignored).
  for (const tr of bodyRows) {
    const tds = [...tr.cells].filter((c) => c.tagName === "TD");
    if (tds.length > 0 && tds.every(isEmptyCell)) tr.classList.add("eh-hidden");
  }

  // Empty columns: hide every single-column cell (header + body) of a column
  // whose body <td> cells are all empty.
  const maxCol = grid.reduce((m, g) => Math.max(m, g.col + g.colspan), 0);
  for (let k = 0; k < maxCol; k++) {
    const colData = grid.filter((g) => g.body && g.data && g.colspan === 1 && g.col === k);
    if (colData.length === 0 || !colData.every((g) => isEmptyCell(g.cell))) continue;
    for (const g of grid) if (g.colspan === 1 && g.col === k) g.cell.classList.add("eh-hidden");
  }

  // Section/band header rows (only <th>): hide when their whole group is hidden.
  for (let i = 0; i < bodyRows.length; i++) {
    if (!isHeaderRow(bodyRows[i]!)) continue;
    let any = false;
    let allHidden = true;
    for (let j = i + 1; j < bodyRows.length && !isHeaderRow(bodyRows[j]!); j++) {
      any = true;
      if (!bodyRows[j]!.classList.contains("eh-hidden")) {
        allHidden = false;
        break;
      }
    }
    if (any && allHidden) bodyRows[i]!.classList.add("eh-hidden");
  }
}
