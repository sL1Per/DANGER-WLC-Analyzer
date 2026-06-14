import { useMemo, useState } from "react";
import { filterFights, type FightMode, type ReportData } from "@wcl/core";

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ReportSummary({ report, cachedAt }: { report: ReportData; cachedAt: number }) {
  const [mode, setMode] = useState<FightMode>("all");
  const [excludeWipes, setExcludeWipes] = useState(false);

  const fights = useMemo(
    () => filterFights(report.fights, { mode, excludeWipes }),
    [report.fights, mode, excludeWipes],
  );

  return (
    <div>
      <header>
        <h1>{report.title}</h1>
        <p>
          <strong>{report.zoneName}</strong> · {new Date(report.startTime).toLocaleString()} ·{" "}
          <small>cached {new Date(cachedAt).toLocaleTimeString()}</small>
        </p>
      </header>

      <div className="segmented" role="group" aria-label="Fights">
        {(["all", "bosses", "trash"] as const).map((m) => (
          <label key={m} className={mode === m ? "active" : ""}>
            <input
              type="radio"
              name="mode"
              aria-label={m === "all" ? "trash & bosses" : `only ${m}`}
              checked={mode === m}
              onChange={() => setMode(m)}
            />
            {m === "all" ? "trash & bosses" : `only ${m}`}
          </label>
        ))}
        <label className={excludeWipes ? "active" : ""}>
          <input
            type="checkbox"
            aria-label="no wipes"
            checked={excludeWipes}
            onChange={(e) => setExcludeWipes(e.target.checked)}
          />
          no wipes
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>name</th>
            <th>type</th>
            <th>result</th>
            <th>duration</th>
          </tr>
        </thead>
        <tbody>
          {fights.map((f) => (
            <tr key={f.id}>
              <td>{f.id}</td>
              <td>{f.name}</td>
              <td>{f.isBoss ? "boss" : "trash"}</td>
              <td className={f.isBoss ? (f.kill ? "sev-ok" : "sev-major") : undefined}>
                {f.isBoss ? (f.kill ? "kill" : "wipe") : "—"}
              </td>
              <td>{fmtDuration(f.endTime - f.startTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Players ({report.players.length})</h2>
      <ul className="chips">
        {report.players.map((p) => (
          <li key={p.id}>
            <span className="chip-player">
              <span className="chip-avatar" aria-hidden>
                {p.name.slice(0, 2).toUpperCase()}
              </span>
              {p.name} <small>({p.class})</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
