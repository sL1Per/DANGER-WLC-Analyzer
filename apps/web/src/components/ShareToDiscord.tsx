import { useState } from "react";
import { Link } from "react-router-dom";
import { buildShareMessage, postToDiscord } from "../lib/discord";
import { loadWebhookUrl } from "../lib/storage";

type Status = "idle" | "posting" | "done" | "error";

export function ShareToDiscord({
  title,
  zoneName,
  link,
}: {
  title: string;
  zoneName: string;
  link: string;
}) {
  const webhookUrl = loadWebhookUrl();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  if (!webhookUrl) {
    return (
      <span className="navitem--disabled" title="Add a Discord webhook URL in Settings">
        <Link to="/settings">Set a Discord webhook</Link> to share
      </span>
    );
  }

  async function onShare() {
    setStatus("posting");
    setMessage("");
    try {
      await postToDiscord(webhookUrl!, buildShareMessage({ title, zoneName, link }));
      setStatus("done");
      setMessage("Posted to Discord.");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed to post.");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button className="btn-outline" onClick={onShare} disabled={status === "posting"}>
        {status === "posting" ? "Posting…" : "Share to Discord"}
      </button>
      {message && (
        <span role="status" className={status === "error" ? "sev-major" : "sev-ok"}>
          {message}
        </span>
      )}
    </div>
  );
}
