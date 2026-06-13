import { useMemo, useState } from "react";
import { validate, type ReportData } from "@wcl/core";
import { validateRules, zoneCodeByName } from "@wcl/data";
import { SeverityLegend } from "./SeverityLegend";

const ZONE_CODES = validateRules.map((r) => r.zone);

export function ValidateView({ report }: { report: ReportData }) {
  const [override, setOverride] = useState<string | undefined>(undefined);
  const result = useMemo(
    () => validate(report, { rules: validateRules, zoneCodeByName }, { zoneOverride: override }),
    [report, override],
  );

  if (result === null) {
    return <p>This report was cached before speedrun validation — refresh it from WCL (requires credentials).</p>;
  }

  return (
    <div>
      <p>
        <label>
          zone:{" "}
          <select value={result.zone} onChange={(e) => setOverride(e.target.value || undefined)}>
            <option value="">↺ auto-detect</option>
            {!ZONE_CODES.includes(result.zone) && <option value={result.zone}>{result.zone} (auto)</option>}
            {ZONE_CODES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        {!result.zoneVerified && !result.unsupportedZone && (
          <span className="sev-moderate"> unverified speedrun rules — cross-check against WCL</span>
        )}
      </p>

      {result.unsupportedZone ? (
        <p className="sev-moderate">No speedrun rules are configured for "{result.zone}". Pick a zone manually above.</p>
      ) : (
        <>
          <SeverityLegend />
          <div className="scroll-x">
            <table>
              <thead>
                <tr><th>name</th><th>minimum to kill</th><th>how many killed?</th><th>killed enough?</th></tr>
              </thead>
              <tbody>
                {result.trash.map((t) => (
                  <tr key={t.name}>
                    <td>{t.name}</td>
                    <td>{t.minKills}</td>
                    <td>{t.killed}</td>
                    <td className={t.severity === "minor" ? "sev-ok" : "sev-major"}>{t.enough ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="validate-summary">
            <li className={result.bosses.enough ? "sev-ok" : "sev-major"}>
              bosses killed ({result.bosses.required} necessary): {result.bosses.killed}
            </li>
            <li className={result.validStartingPoint ? "sev-ok" : "sev-major"}>
              contains a valid starting point: {result.validStartingPoint ? "yes" : "no"}
            </li>
            <li>total characters used: {result.totalCharacters}</li>
            <li className={result.isValid ? "sev-ok" : "sev-major"}>
              <strong>is the log valid (trash + boss requirements met): {result.isValid ? "yes" : "no"}</strong>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
