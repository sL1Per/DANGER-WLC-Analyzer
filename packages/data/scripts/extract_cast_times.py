#!/usr/bin/env python3
# packages/data/scripts/extract_cast_times.py
"""Build spell-cast-times.json (spell id -> base cast time in deci-seconds) by
joining wago.tools SpellMisc.CastingTimeIndex -> SpellCastTimes.Base for TBC.

Usage: python3 packages/data/scripts/extract_cast_times.py
Writes packages/data/json/spell-cast-times.json. Re-run to refresh from wago.tools.
"""
import csv, io, json, os, urllib.error, urllib.request

BUILD = "2.5.4.44833"  # TBC 2.5.4 final patch build
BASE = "https://wago.tools/db2"
OUT = os.path.join(os.path.dirname(__file__), "..", "json", "spell-cast-times.json")


def fetch_csv(table):
    # wago.tools sits behind Cloudflare, which 403s the default urllib User-Agent.
    url = f"{BASE}/{table}/csv?build={BUILD}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req) as r:
            return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))
    except urllib.error.URLError as e:
        raise SystemExit(f"Failed to fetch {url}: {e}")


def main():
    cast_times = {row["ID"]: int(row["Base"]) for row in fetch_csv("SpellCastTimes")}
    out = {}
    for row in fetch_csv("SpellMisc"):
        idx = row.get("CastingTimeIndex")
        spell_id = row.get("SpellID")
        if not idx or not spell_id:
            continue
        base_ms = cast_times.get(idx)
        if not base_ms:           # index 0 / instant -> skip (0 active seconds)
            continue
        deci = round(base_ms / 100)
        if deci > 0:
            out[spell_id] = deci
    ordered = {k: out[k] for k in sorted(out, key=int)}
    with open(OUT, "w") as f:
        json.dump(ordered, f, separators=(",", ":"), sort_keys=False)
    print(f"wrote {len(ordered)} cast times to {OUT}")


if __name__ == "__main__":
    main()
