# WoW Classic TBC — Raid Analysis Tools (CLA + RPB)

## What this folder is

This folder contains **reference material, not code**. The two `.xlsx` files are Excel
exports of two well-known Google Sheets tools by **Shariva** (Shariva#8127, Discord:
https://discord.gg/nGvt5zH), version **1.6.0a**, used to analyze World of Warcraft
Classic TBC raid logs:

1. `WoW Classic TBC - Combat Log Analytics V1.6.0a.xlsx` — **CLA**
2. `WoW Classic TBC - Role Performance Breakdown V1.6.0a.xlsx` — **RPB**

The goal of this project is to **rebuild the same functionality as standalone
software**. Treat the xlsx files as read-only functional specs: they show the exact
inputs, outputs, layouts, and embedded reference data of the original tools.

## How the original tools work (architecture)

Both are *spreadsheet generators* built on Google Sheets + **Google Apps Script**
(the script code is NOT included in the xlsx exports — only the resulting data and
layouts are). The workflow:

1. User makes a copy of the Google Sheet.
2. User enters their **WarcraftLogs (WCL) v1 API key** ("V1 Client Key" from
   https://classic.warcraftlogs.com/profile).
3. User enters a **WCL report URL or report ID**.
4. Optional filters: `trash & bosses` / `only bosses` / `only trash` (each with a
   "no wipes" variant), a single **fight id** (also supports `last`), a
   **start–end timestamp** range (fight id and start–end are mutually exclusive),
   and a comma-separated **character name filter**.
5. User presses a Start button → Apps Script pulls data from the WCL v1 API
   (~30–120 s per sheet; all CLA sheets ≈ 300 WCL points; RPB ≈ 48 + 15/player.
   Free WCL accounts are limited to 3,600 points/hour; subscribers get 36,000).
6. Results are written into the tabs.
7. An **export step** copies selected result tabs to a new, shareable spreadsheet
   (stripped of the API key); the link can optionally be posted to a **Discord
   webhook**.

Other cross-cutting features:
- **Multi-language UI** (EN / DE / FR / 简体中文 / RU): every label is resolved via
  `VLOOKUP(key, trans!I:J, ...)` against a hidden `trans` key→string sheet that is
  itself imported from a master translation spreadsheet.
- **Supported zones (TBC raids):** Karazhan, Gruul/Magtheridon, Serpentshrine
  Cavern (SSC), Tempest Keep (TK), Mount Hyjal (MH), Black Temple (BT), Zul'Aman
  (ZA), Sunwell Plateau (SW/SWP). Vanilla/WotLK reports are rejected.
- Sheet name pattern for generated outputs: `"CLA for <report> on <zone> in <time>"`,
  `"RPB for <player/role> on <zone> in <time> <part>"`.

## Tool 1 — Combat Log Analytics (CLA)

Report-wide hygiene/preparation auditing. Visible tabs (each runs independently):

### `gear issues`
Per player, one row per player, flags every equipped item with a problem:
- **Enchants:** `no enchant`, `bad enchant`, `suboptimal enchant`, and a
  configurable list of "cheap or bad enchants" (enchant id + name, e.g.
  "Bracers - 7 Str", "+10 Critical Strike"). Output format: `Item Name [issue]`.
- **Gems:** `no gem used`, `common/uncommon/rare gem used` versus a configurable
  **minimum required gem quality** (default rare); `uncut gem`; **inactive meta
  gem** (per boss fight, e.g. `[meta gem inactive on Kael'thas Sunstrider]`).
  Uses the hidden `sockets` sheet (item id → number of sockets, ~1,500 items) to
  know how many gems each item should have.
- **Wrong-purpose gear:** spell-hit gear on non-casters / melee-hit gear on
  casters; vs.-undead items (Rune of the Dawn, Blessed Wizard Oil,
  Consecrated Sharpening Stone) used vs. non-undead/non-demon; useless
  riding/slowfall/engineering/SR/PvP gear on specific bosses; empty item slots
  (`no item on <slot>`); known "fun" items (fishing poles, Kael legendaries…)
  from an **excluded gear** list (item id + name).
- Settings: minimum gem quality, "list players with no issues?",
  "exclude Mother Shahraz" (SR gear is legitimate there), ignore-gems variants,
  italic-marking an entry in the config lists excludes it from tracking.
- Note shown to users: *gear is only recorded at the start of boss fights*
  (WCL `combatantInfo`).

### `gear listing`
Full equipped gear per player for one chosen boss fight (default: last boss fight
containing gear info). Columns = 17 slots: Head, Neck, Shoulders, Cloak, Chest,
Bracers, Hands, Waist, Legs, Feet, Ring1, Ring2, Trinket1, Trinket2, Weapon,
Off-Hand, Wand/Idol/Relic.

### `buff consumables`
Per-player consumable discipline on **boss fights only** (uptime fractions 0–1,
conditional-formatted; supports up to 50 players):
- Columns: `Elixir or Flask` (combined), `Battle Elixir`, `Guardian Elixir`,
  `Flask`, `Food Buff`, `Scrolls` (% with which scroll types, `*` if below lvl 5),
  `Weapon Enhancement`, `# of boss fights a JC neck was used on` (plus
  `inactive neck equipped on N fight(s)`), `suboptimal stuff found` (names of
  suboptimal consumables, e.g. "Superior Wizard Oil", "Flask of Mighty
  Restoration", "Well Fed"), and a `total average (excl. Scrolls)`.
- Caveat shown: some T6 fights miss `combatantInfo`; loggers should stand close
  to the boss at fight start. JC necks are not flagged inactive on Kael'thas.

### `drums`
Drums of Battle/War/Restoration effectiveness (Leatherworking raid buff):
per player: `# of battle drums` (with average buffs applied per cast, ⌀),
`# of war drums`, `# of restoration drums`, `# of drums on Tinnitus` (casts while
targets had the Tinnitus debuff = 0 targets buffed = wasted),
`# of drums total`, `buffs per drum (⌀)`, and a `weighted score`.
Also flags use of the *lesser* (non-Greater) drum versions.

### `validate`
Speedrun-log validation against speedrun rules (supports MH/BT/ZA/SW and earlier
zones; zone can be manually overridden):
- Table of required **trash mob types** (NPC ids, possibly comma-separated groups,
  e.g. `25363,25367,...` = "Sunblade Arch Mage/Cabalist/…") with
  `minimum to kill` / `how many killed?` / `killed enough?` per row.
- Plus: `number of bosses killed (N necessary)` (split requirements for combined
  zones, e.g. "5 for MH and 9 for BT"), `Contains a valid starting point`,
  `total number of characters used`, and an overall verdict
  `Is the log a valid log (also are the trash requirements met)?`.
- Advice: run multiple loggers so all mob deaths are registered despite d/cs.
- The full per-zone trash-requirement tables (Kara/SSC/TK/MH/BT/ZA/SW) live in
  the `trans` sheet (columns W–AA hold the mob name lists per zone).

### `shadow resi`
Per-player **Shadow Resistance** breakdown for the SR-relevant bosses
(Mother Shahraz in BT; Kaz'rogal and Azgalor in Hyjal). Boss selectable; analyzes
the kill or the longest wipe. Columns: `SR from gear + buffs`, `SR from gear`,
`SR from buffs`, then per item slot the contributing item, e.g.
`Pendant of Shadow's End (~30 SR)` (item's innate SR) and/or `+15 SR` (enchant).
Caveats: talents/abilities not counted; random-enchant items presumed SR rolls;
priest/mage buff SR missing (a Blizzard logging issue). Backed by the hidden
`shadow resistance config` sheet (item id → SR value database, ~1,500 rows).

### `fightsSW` (fights)
Speedrun **timeline comparison of two logs** side by side: per pull (trash pack
or boss) the `name`, `idle` time since the previous pull, `start time`,
`duration`, `end time`; per boss the running `time difference` between the two
logs and a `total idle time`. Used to find where time is lost in a speedrun.

### Hidden sheets (CLA)
- `sockets` — item id → number of sockets (~1,505 rows).
- `shadow resistance config` — item id → SR amount (~1,492 rows).
- `trans` — translation keys + per-zone trash mob lists + enchant/excluded-item
  master lists (imported from a master sheet via `IMPORTRANGE`).

## Tool 2 — Role Performance Breakdown (RPB)

Per-player performance overview, grouped by **role**. Roles: **Tank, Healer,
Caster, Physical** — auto-detected since v1.4.3, manually adjustable in row 4 of
the generated sheets, and saved per character. The per-role sheets are created by
the script, then *deleted from the master* and only kept in the exported
shareable spreadsheet — which is why the export only contains the `All` template.

### `All` tab (template + settings)
Settings block: trash/bosses filter, optional fight id (or `last`), optional
start–end timestamps, optional character-name list, per-row `hide if empty?`
toggles. Header shows report `title`, `zone`, `date`.

### Metrics produced per player (from the translation keys + changelog)
- **Uptimes / effective usage** of class abilities, buffs and debuffs —
  `uptime`, `uptime%`, "= effective usage (or total uptime for non-actives)",
  "= mostly lower rank used if only max rank is optimal" (rank-checking of
  casts), "on boss fights only (unless it says 'total')", split columns
  `used or gained* on trash` / `on bosses`.
- **Activity:** `seconds active on single target` / `on aoe`, `relative active %`
  (single target / aoe / total), WCL's own active % (with and without trash),
  `# of hits per aoe cast on average (⌀)`. Spell-haste-aware: subtracts seconds
  for spell-haste buffs using the hidden `spell haste config` sheet
  (spell id → cast-time value, ~543 rows). Known caveat: inaccurate for melee.
- **Avoidable damage:** `Raw avoidable damage taken by tracked abilities`,
  `Total (partly) avoidable damage taken`, each value hyperlinked to the WCL
  query (since v1.4.1c).
- **Deaths:** `# of deaths in total`.
- **Interrupts:** `# of interrupted spells` + names and sources.
- **Self-inflicted/odd damage:** `Damage reflected`, `Friendly Fire`
  (e.g. Charges/Plague; counted as done to self), `Damage to hostile players`
  (PvP; counted as done to self).
- **Absorbs:** `total absorbed` (with exclusions); absorb necks attributed to
  the player with the absorb.
- **Misc:** `temporary weapon enhancement uptime`, `damage done with Engineering
  etc. total` (+ dps as note), `damage done only with Oil of Immolation`,
  `trinkets equipped on bosses` (hover text), drums, `Battle Shout uptime on
  you%`, class-specific checks (e.g. Mage "winter chill?", Paladin "twisted
  swings on bosses%" for Seal of the Crusader). Kalecgos is excluded from all
  numbers (the fight's portal mechanic breaks them).

### Hidden sheets (RPB)
- `settings` — small UI prefs (e.g. "player role" column not hidden).
- `spell haste config` — spell id → value used for activity correction.
- `trans` — translation keys.

## Domain glossary

- **WCL** — WarcraftLogs (classic.warcraftlogs.com), the combat-log hosting
  site. A **report** (id like `aaaaaaaaaaaaa` in the URL) contains numbered
  **fights** (`#fight=28`), each either a **boss** fight (kill or **wipe**) or
  **trash**. The **v1 API** (key-based REST) is what these tools use.
- **combatantInfo** — WCL event at boss-fight start carrying each player's gear,
  gems, enchants, and buffs. Only recorded at boss pull → all gear/consumable
  analysis is boss-fight based.
- **Consumable categories (TBC):** Battle Elixir + Guardian Elixir (stack) vs.
  Flask (replaces both), Food Buff, Scrolls (Agi/Str/Prot levels), temporary
  weapon enhancements (oils/stones), JC ("jewelcrafting") necks with on-use
  absorb effects.
- **Drums / Tinnitus:** Drums of Battle/War/Restoration buff nearby raiders;
  applying drums gives the target the Tinnitus debuff, during which they cannot
  receive drums again — drums cast on already-debuffed targets are wasted.
- **SR fights:** Mother Shahraz, Kaz'rogal, Azgalor require Shadow Resistance
  gear; elsewhere SR gear is "useless gear".
- **Speedrun validation:** community speedrun rules require minimum kill counts
  of specific trash NPC ids per zone and a valid starting point; `validate`
  checks a log against these.

## Reusable data embedded in the xlsx files

When building the new software, these databases can be extracted directly from
the workbooks instead of recreated:
- CLA `sockets`: item id → socket count (~1,505 items).
- CLA `shadow resistance config`: item id → SR value (~1,492 items).
- RPB `spell haste config`: spell id → haste/cast value (~543 spells).
- CLA/RPB `trans`: full translation key→EN table (~500 keys) + per-zone speedrun
  trash mob name/id lists + "cheap or bad enchants" list (enchant id + slot +
  name) + "excluded gear" item list.

## Reading the xlsx files programmatically

```python
import openpyxl
wb = openpyxl.load_workbook(path, data_only=True)  # cached values
```
- These are Google Sheets exports: formulas appear as
  `=IFERROR(__xludf.DUMMYFUNCTION("..."),"fallback")` — the *fallback/cached
  value* is the real content; use `data_only=True`.
- Hidden sheets (`ws.sheet_state == 'hidden'`) hold the config databases.
- Player names in the sample data are anonymized (`Player1`, `Player2`, …).
- A full plain-text dump of all sheets was generated at `/tmp/wow_dump/`
  (`<CLA|RPB>__<sheet>.txt`) — regenerate with the snippet above if needed.

## Notes for the rebuild

- **Data source:** original uses the WCL **v1 API** (deprecated-ish); the modern
  replacement is the **v2 GraphQL API** (OAuth client credentials). Decide which
  to target before implementation — v2 is the safer long-term choice.
- **Rate limits matter:** original quotes ~300 points per CLA run and
  ~48 + 15/player per RPB run against a 3,600 points/hour free budget; the
  rebuild should cache report data and batch queries.
- Keep the filter model (trash/bosses/no-wipes, fight id or `last`, start–end,
  character names) — it's mutually-exclusive fight-id vs. timestamp range.
- Role assignment should be auto-detected but user-overridable and persisted
  per character name.
- Output today is a shareable spreadsheet + optional Discord webhook post;
  the rebuild can keep the Discord webhook and replace the spreadsheet with its
  own UI/exports.
- Known data caveats to carry over (worth surfacing in the UI): only in-combat
  actions are logged; gear/consumables only at boss pull; some T6 fights miss
  combatantInfo; melee activity % is approximate; Kalecgos excluded (RPB).
