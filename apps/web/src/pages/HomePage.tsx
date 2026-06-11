import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseReportInput } from "@wcl/core";

export function HomePage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = parseReportInput(input);
    if (!id) {
      setError("That doesn't look like a WCL report URL or id.");
      return;
    }
    navigate(`/report/${id}`);
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>WCL Raid Analyzer</h1>
      <p>Paste a WarcraftLogs report URL or id:</p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="https://classic.warcraftlogs.com/reports/…"
        size={60}
      />
      <button type="submit">Analyze</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
