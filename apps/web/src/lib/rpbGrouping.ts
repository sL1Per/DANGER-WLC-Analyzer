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
