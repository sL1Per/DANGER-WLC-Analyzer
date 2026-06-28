import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadCredentials, saveCredentials, loadWebhookUrl, saveWebhookUrl } from "../lib/storage";
import { isValidWebhookUrl } from "../lib/discord";

export function SettingsPage() {
  const navigate = useNavigate();
  const existing = loadCredentials();
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState(existing?.clientSecret ?? "");
  const [saved, setSaved] = useState(false);
  const [webhook, setWebhook] = useState(loadWebhookUrl() ?? "");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookError, setWebhookError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveCredentials({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    setSaved(true);
  }
  function onSaveWebhook(e: FormEvent) {
    e.preventDefault(); setWebhookSaved(false); setWebhookError("");
    const trimmed = webhook.trim();
    if (trimmed && !isValidWebhookUrl(trimmed)) { setWebhookError("That doesn't look like a Discord webhook URL."); return; }
    saveWebhookUrl(trimmed); setWebhookSaved(true);
  }

  return (
    <div className="settings">
      <header className="report-header">
        <Link to="/" className="report-header__brand">
          <span className="report-header__mark" aria-hidden><img src="/favicon.svg" alt="" className="report-header__mark-icon" /></span>
          <span className="report-header__title">DANGER Raid Analyzer <span className="brand-tag">For TBC Anniversary</span></span>
        </Link>
        <div className="report-header__actions"><button className="btn-outline" onClick={() => navigate(-1)}>Done</button></div>
      </header>

      <div className="settings-col">
        <form className="card" onSubmit={onSubmit}>
          <h2>WCL API credentials</h2>
          <p>Create a (free) v2 API client at{" "}
            <a href="https://classic.warcraftlogs.com/api/clients/" target="_blank" rel="noreferrer">classic.warcraftlogs.com/api/clients</a>{" "}
            and paste the client ID and secret here. Stored only in this browser.</p>
          <p>Use a <strong>dedicated</strong> API client for this tool, not one you reuse elsewhere — the secret is kept in this browser's local storage and can be revoked from your WCL account at any time.</p>
          <label>Client ID <input value={clientId} onChange={(e) => setClientId(e.target.value)} required /></label>
          <label>Client secret <input value={clientSecret} type="password" onChange={(e) => setClientSecret(e.target.value)} required /></label>
          <button type="submit" className="btn-gold">Save</button>
          {saved && <p role="status">✓ Saved to this browser</p>}
        </form>

        <form className="card" onSubmit={onSaveWebhook}>
          <h2>Discord webhook</h2>
          <p>Paste a Discord channel webhook URL to post report links to your guild. Create one under <em>Channel Settings → Integrations → Webhooks</em>. Posted directly to Discord — it never reaches our server. Leave blank to remove.</p>
          <label>Webhook URL <input value={webhook} type="url" placeholder="https://discord.com/api/webhooks/…" onChange={(e) => setWebhook(e.target.value)} /></label>
          <button type="submit" className="btn-gold">Save webhook</button>
          {webhookError && <p role="alert" className="sev-major">{webhookError}</p>}
          {webhookSaved && <p role="status">✓ Saved to this browser</p>}
        </form>
      </div>
    </div>
  );
}
