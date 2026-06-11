import { type FormEvent, useState } from "react";
import { loadCredentials, saveCredentials } from "../lib/storage";

export function SettingsPage() {
  const existing = loadCredentials();
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState(existing?.clientSecret ?? "");
  const [saved, setSaved] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveCredentials({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>WCL API credentials</h1>
      <p>
        Create a (free) v2 API client at{" "}
        <a href="https://classic.warcraftlogs.com/api/clients/" target="_blank" rel="noreferrer">
          classic.warcraftlogs.com/api/clients
        </a>{" "}
        and paste the client ID and secret here. They are stored only in this browser.
      </p>
      <label>
        Client ID{" "}
        <input value={clientId} onChange={(e) => setClientId(e.target.value)} required />
      </label>
      <label>
        Client secret{" "}
        <input
          value={clientSecret}
          type="password"
          onChange={(e) => setClientSecret(e.target.value)}
          required
        />
      </label>
      <button type="submit">Save</button>
      {saved && <p role="status">Saved.</p>}
    </form>
  );
}
