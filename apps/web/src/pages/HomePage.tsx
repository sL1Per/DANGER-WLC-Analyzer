import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseReportInput } from "@wcl/core";
import { saveLastReportId } from "../lib/storage";

const SAMPLE_ID = "JrYP2qfMmxBpD9ha"; // demo report (16-char WCL code)

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
        <span className="home-mark" aria-hidden>W</span>
        <h1 className="home-title">Raid Analyzer</h1>
        <p className="home-tag">TBC Classic · Combat Log Analytics</p>
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
          <button type="button" className="btn-text" onClick={() => open(SAMPLE_ID)}>or load a sample report →</button>
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
