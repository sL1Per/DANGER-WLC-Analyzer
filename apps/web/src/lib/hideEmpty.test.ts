import { describe, it, expect } from "vitest";
import { applyHideEmpty } from "./hideEmpty";

/** Build a DOM container with the given innerHTML. */
function host(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

const hidden = (el: Element | null) => el?.classList.contains("eh-hidden") ?? false;

describe("applyHideEmpty", () => {
  it("hides a body row whose data cells are all empty (label th ignored)", () => {
    const root = host(`
      <table>
        <tbody>
          <tr id="full"><th>Crit</th><td>5</td><td>3</td></tr>
          <tr id="empty"><th>Dodge</th><td>—</td><td>—</td></tr>
        </tbody>
      </table>`);
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector("#full"))).toBe(false);
    expect(hidden(root.querySelector("#empty"))).toBe(true);
  });

  it("does not treat a literal 0 as empty", () => {
    const root = host(`
      <table><tbody>
        <tr id="zeros"><th>Windfury</th><td>0</td><td>0</td></tr>
      </tbody></table>`);
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector("#zeros"))).toBe(false);
  });

  it("hides an empty column (its header th and every body td)", () => {
    const root = host(`
      <table>
        <thead><tr><th></th><th id="pA">A</th><th id="pB">B</th></tr></thead>
        <tbody>
          <tr><th>Crit</th><td id="a1">5</td><td id="b1">—</td></tr>
          <tr><th>Dodge</th><td id="a2">2</td><td id="b2">—</td></tr>
        </tbody>
      </table>`);
    applyHideEmpty(root, true);
    // column B is all empty → its header + both body cells hidden
    expect(hidden(root.querySelector("#pB"))).toBe(true);
    expect(hidden(root.querySelector("#b1"))).toBe(true);
    expect(hidden(root.querySelector("#b2"))).toBe(true);
    // column A stays
    expect(hidden(root.querySelector("#pA"))).toBe(false);
    expect(hidden(root.querySelector("#a1"))).toBe(false);
  });

  it("hides a section/band header row when its whole group collapses", () => {
    const root = host(`
      <table><tbody>
        <tr id="band"><th colspan="3">Stats</th></tr>
        <tr id="r1"><th>Crit</th><td>—</td><td>—</td></tr>
        <tr id="r2"><th>Dodge</th><td>—</td><td>—</td></tr>
        <tr id="band2"><th colspan="3">Other</th></tr>
        <tr id="r3"><th>Deaths</th><td>1</td><td>0</td></tr>
      </tbody></table>`);
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector("#band"))).toBe(true); // group all hidden
    expect(hidden(root.querySelector("#band2"))).toBe(false); // r3 visible
  });

  it("restores everything when hide=false", () => {
    const root = host(`
      <table><tbody>
        <tr id="empty"><th>Dodge</th><td>—</td></tr>
      </tbody></table>`);
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector("#empty"))).toBe(true);
    applyHideEmpty(root, false);
    expect(hidden(root.querySelector("#empty"))).toBe(false);
  });

  it("handles multiple tables under one root independently", () => {
    const root = host(`
      <table><tbody><tr id="t1"><th>x</th><td>—</td></tr></tbody></table>
      <table><tbody><tr id="t2"><th>y</th><td>9</td></tr></tbody></table>`);
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector("#t1"))).toBe(true);
    expect(hidden(root.querySelector("#t2"))).toBe(false);
  });

  // ── mobile per-player cards ──────────────────────────────
  const card = (rowsHtml: string) =>
    `<div class="stat-card"><div class="stat-card__title">Thrall</div>${rowsHtml}</div>`;
  const cardRow = (id: string, value: string) =>
    `<div class="stat-card__row" id="${id}"><dt>L</dt><dd>${value}</dd></div>`;

  it("hides a card row whose value is empty, keeps non-empty rows", () => {
    const root = host(card(cardRow("full", "5") + cardRow("dash", "—") + cardRow("blank", "")));
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector("#full"))).toBe(false);
    expect(hidden(root.querySelector("#dash"))).toBe(true);
    expect(hidden(root.querySelector("#blank"))).toBe(true);
  });

  it("does not treat a literal 0 in a card row as empty", () => {
    const root = host(card(cardRow("zero", "0")));
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector("#zero"))).toBe(false);
  });

  it("hides the whole card when every row is empty", () => {
    const root = host(card(cardRow("a", "—") + cardRow("b", "")));
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector(".stat-card"))).toBe(true);
  });

  it("keeps a card that has at least one non-empty row", () => {
    const root = host(card(cardRow("a", "—") + cardRow("b", "9")));
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector(".stat-card"))).toBe(false);
  });

  it("restores hidden card rows and cards when hide=false", () => {
    const root = host(card(cardRow("a", "—") + cardRow("b", "")));
    applyHideEmpty(root, true);
    expect(hidden(root.querySelector(".stat-card"))).toBe(true);
    applyHideEmpty(root, false);
    expect(hidden(root.querySelector(".stat-card"))).toBe(false);
    expect(hidden(root.querySelector("#a"))).toBe(false);
  });
});
