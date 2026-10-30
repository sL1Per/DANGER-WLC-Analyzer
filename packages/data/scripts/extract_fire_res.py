#!/usr/bin/env python3
"""Extract item innate Fire Resistance from a wago.tools ItemSparse CSV export.

Usage: extract_fire_res.py <ItemSparse.csv>
  CSV from https://wago.tools/db2/ItemSparse/csv?build=2.5.6.70577 (TBC
  Anniversary). Resistances_2 is Fire (0 physical, 1 holy, 2 fire, 3 nature,
  4 frost, 5 shadow, 6 arcane — checked against item-shadow-res.json's exact
  values on Resistances_5).
"""
import csv
import json
import os
import sys

OUT = os.path.join(os.path.dirname(__file__), "..", "json", "item-fire-res.json")

if len(sys.argv) != 2:
    raise SystemExit(__doc__)

out = {}
with open(sys.argv[1], encoding="utf-8") as f:
    for row in csv.DictReader(f):
        fr = int(row["Resistances_2"] or 0)
        if fr > 0:
            out[row["ID"]] = fr

out = dict(sorted(out.items(), key=lambda kv: int(kv[0])))
with open(OUT, "w") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
print(f"wrote item-fire-res.json: {len(out)} entries")
