import { describe, it, expect } from "vitest";
import { tagColumns, attachColumnHover } from "./tableCrosshair";

function host(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("tableCrosshair", () => {
  it("tags single-column cells with their grid column, honoring colspan", () => {
    const root = host(`
      <table>
        <thead><tr><th id="corner"></th><th id="pA">A</th><th id="pB">B</th></tr></thead>
        <tbody>
          <tr><th colspan="3" id="band">Stats</th></tr>
          <tr><th id="lbl">Crit</th><td id="a1">5</td><td id="b1">3</td></tr>
        </tbody>
      </table>`);
    tagColumns(root);
    expect((root.querySelector("#corner") as HTMLElement).dataset.xcol).toBe("0");
    expect((root.querySelector("#pA") as HTMLElement).dataset.xcol).toBe("1");
    expect((root.querySelector("#pB") as HTMLElement).dataset.xcol).toBe("2");
    expect((root.querySelector("#lbl") as HTMLElement).dataset.xcol).toBe("0");
    expect((root.querySelector("#a1") as HTMLElement).dataset.xcol).toBe("1");
    expect((root.querySelector("#b1") as HTMLElement).dataset.xcol).toBe("2");
    // the band header spans columns → not tagged
    expect((root.querySelector("#band") as HTMLElement).dataset.xcol).toBeUndefined();
  });

  it("highlights the hovered column and clears on leave", () => {
    const root = host(`
      <table>
        <thead><tr><th></th><th id="pA">A</th><th id="pB">B</th></tr></thead>
        <tbody>
          <tr><th>Crit</th><td id="a1">5</td><td id="b1">3</td></tr>
          <tr><th>Dodge</th><td id="a2">2</td><td id="b2">1</td></tr>
        </tbody>
      </table>`);
    tagColumns(root);
    const detach = attachColumnHover(root);

    root.querySelector("#a1")!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    // whole column A highlighted (header + both body cells), column B not
    expect(root.querySelector("#pA")!.classList.contains("xh-col")).toBe(true);
    expect(root.querySelector("#a2")!.classList.contains("xh-col")).toBe(true);
    expect(root.querySelector("#b1")!.classList.contains("xh-col")).toBe(false);

    root.dispatchEvent(new MouseEvent("mouseleave"));
    expect(root.querySelector("#pA")!.classList.contains("xh-col")).toBe(false);

    detach();
  });
});
