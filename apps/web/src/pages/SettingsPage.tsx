import { type FormEvent, useState } from "react";
import { loadCredentials, saveCredentials, loadWebhookUrl, saveWebhookUrl } from "../lib/storage";
import { isValidWebhookUrl } from "../lib/discord";

export function SettingsPage() {
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
    e.preventDefault();
    setWebhookSaved(false);
    setWebhookError("");
    const trimmed = webhook.trim();
    if (trimmed && !isValidWebhookUrl(trimmed)) {
      setWebhookError("That doesn't look like a Discord webhook URL.");
      return;
    }
    saveWebhookUrl(trimmed);
    setWebhookSaved(true);
  }

  return (
    <>
      <form className="card card--center" onSubmit={onSubmit}>
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

      <form className="card card--center" onSubmit={onSaveWebhook}>
        <h1>Discord webhook</h1>
        <p>
          Paste a Discord channel webhook URL to post report links straight to your guild
          channel. Create one in Discord under <em>Channel Settings → Integrations → Webhooks</em>.
          The URL is stored only in this browser and posted directly to Discord — it never
          reaches our server. Leave blank to remove it.
        </p>
        <label>
          Webhook URL{" "}
          <input
            value={webhook}
            type="url"
            placeholder="https://discord.com/api/webhooks/…"
            onChange={(e) => setWebhook(e.target.value)}
          />
        </label>
        <button type="submit">Save webhook</button>
        {webhookError && <p role="alert" className="sev-major">{webhookError}</p>}
        {webhookSaved && <p role="status">Saved.</p>}
      </form>
    </>
  );
}
