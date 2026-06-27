import { useState } from "react";
import { Link } from "react-router-dom";
import type { ReportData } from "@wcl/core";
import { publishSnapshot, shareUrl } from "../lib/share";
import { buildShareMessage, postToDiscord } from "../lib/discord";
import { loadWebhookUrl } from "../lib/storage";

type Status = "idle" | "publishing" | "ready" | "error";
type MessageKind = "ok" | "error";

export function PublishShare({ report }: { report: ReportData }) {
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<MessageKind>("ok");
  const webhookUrl = loadWebhookUrl();

  async function onPublish() {
    setStatus("publishing"); setMessage("");
    try {
      const id = await publishSnapshot(report);
      setUrl(shareUrl(id));
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Publish failed.");
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessageKind("ok");
      setMessage("Link copied.");
    } catch {
      setMessageKind("error");
      setMessage("Couldn't copy — select the link and copy manually.");
    }
  }

  async function onPostDiscord() {
    if (!webhookUrl) return;
    try {
      await postToDiscord(webhookUrl, buildShareMessage({
        title: report.title, zoneName: report.zoneName, link: url,
      }));
      setMessageKind("ok");
      setMessage("Posted to Discord.");
    } catch (e) {
      setMessageKind("error");
      setMessage(e instanceof Error ? e.message : "Failed to post.");
    }
  }

  if (status !== "ready") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn-outline" onClick={onPublish} disabled={status === "publishing"}>
          {status === "publishing" ? "Publishing…" : "Publish & share"}
        </button>
        {status === "error" && <span role="status" className="sev-major">{message}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input readOnly value={url} aria-label="Shareable link" style={{ minWidth: 240 }} />
      <button className="btn-outline" onClick={onCopy}>Copy link</button>
      {webhookUrl
        ? <button className="btn-outline" onClick={onPostDiscord}>Post to Discord</button>
        : <span className="navitem--disabled"><Link to="/settings">Set a webhook</Link> to post</span>}
      {message && <span role="status" className={messageKind === "ok" ? "sev-ok" : "sev-major"}>{message}</span>}
    </div>
  );
}
