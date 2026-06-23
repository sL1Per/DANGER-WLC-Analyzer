import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseReportInput } from "@wcl/core";
import { saveLastReportId } from "../lib/storage";

export function HomePage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function open(raw: string) {
    const id = parseReportInput(raw);
    if (!id) { setError("That doesn't look like a WCL report URL or id."); return; }
    setError(null);
    saveLastReportId(id);
    navigate(`/report/${id}`);
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); open(input); }

  return (
    <div className="home">
      <div className="home-brand">
        <span className="home-mark" aria-hidden>D</span>
        <h1 className="home-title">DANGER Raid Analyzer</h1>
        <p className="home-tag">Combat Log Analytics &amp; Role Performance Breakdown</p>
      </div>
      <form className="home-card" onSubmit={onSubmit}>
        <h2>Analyze a raid</h2>
        <p className="subhead">Paste a WarcraftLogs report URL or id to begin.</p>
        <div className="home-input">
          <span aria-hidden>↗</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://classic.warcraftlogs.com/reports/…"
            aria-label="report url or id"
            className="mono"
          />
        </div>
        <div className="home-actions">
          <button type="submit" className="btn-gold">Analyze</button>
        </div>
        {error && <p role="alert" className="sev-major">{error}</p>}
        <div className="home-footer">
          <span>Reports are cached for 24h.</span>
          <Link to="/settings">⚙ Settings</Link>
        </div>
      </form>
    </div>
  );
}
