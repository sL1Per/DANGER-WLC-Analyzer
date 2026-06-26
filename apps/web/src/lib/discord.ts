// Discord webhook URLs look like
//   https://discord.com/api/webhooks/<id>/<token>
// also served from discordapp.com and the ptb/canary subdomains.
const WEBHOOK_RE =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isValidWebhookUrl(url: string): boolean {
  return WEBHOOK_RE.test(url.trim());
}

export function buildShareMessage(opts: {
  title: string;
  zoneName: string;
  link: string;
  details?: string;
  view?: string;
}): string {
  const lines = [`📊 **${opts.title}** — ${opts.zoneName}`];
  if (opts.details) lines.push(opts.details);
  if (opts.view) lines.push(opts.view);
  lines.push(opts.link);
  return lines.join("\n");
}

// Posts straight from the browser; Discord webhook endpoints send
// `Access-Control-Allow-Origin: *`, so no API proxy is needed.
export async function postToDiscord(webhookUrl: string, content: string): Promise<void> {
  const url = webhookUrl.trim();
  if (!isValidWebhookUrl(url)) {
    throw new Error("That doesn't look like a Discord webhook URL.");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`Discord rejected the post (HTTP ${res.status}).`);
  }
}
