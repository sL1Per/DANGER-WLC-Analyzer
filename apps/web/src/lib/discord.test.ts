import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShareMessage, isValidWebhookUrl, postToDiscord } from "./discord";

afterEach(() => vi.unstubAllGlobals());

describe("isValidWebhookUrl", () => {
  it("accepts a canonical discord webhook url", () => {
    expect(isValidWebhookUrl("https://discord.com/api/webhooks/123/abc-DEF_xyz")).toBe(true);
  });
  it("accepts the discordapp.com and ptb hosts", () => {
    expect(isValidWebhookUrl("https://discordapp.com/api/webhooks/1/tok")).toBe(true);
    expect(isValidWebhookUrl("https://ptb.discord.com/api/webhooks/1/tok")).toBe(true);
  });
  it("trims surrounding whitespace", () => {
    expect(isValidWebhookUrl("  https://discord.com/api/webhooks/1/tok ")).toBe(true);
  });
  it("rejects non-discord and malformed urls", () => {
    expect(isValidWebhookUrl("https://evil.com/api/webhooks/1/tok")).toBe(false);
    expect(isValidWebhookUrl("http://discord.com/api/webhooks/1/tok")).toBe(false);
    expect(isValidWebhookUrl("https://discord.com/api/webhooks/")).toBe(false);
    expect(isValidWebhookUrl("not a url")).toBe(false);
  });
});

describe("buildShareMessage", () => {
  it("includes the title, zone and link", () => {
    const msg = buildShareMessage({ title: "Tuesday SSC", zoneName: "Serpentshrine Cavern", link: "https://x/cla/abc" });
    expect(msg).toContain("Tuesday SSC");
    expect(msg).toContain("Serpentshrine Cavern");
    expect(msg).toContain("https://x/cla/abc");
  });

  it("includes the view description when provided", () => {
    const msg = buildShareMessage({
      title: "Tuesday SSC",
      zoneName: "SSC",
      link: "https://x/cla/abc",
      view: "Role breakdown · Lady Vashj",
    });
    expect(msg).toContain("Role breakdown · Lady Vashj");
  });

  it("omits the view line when no view is given", () => {
    const msg = buildShareMessage({ title: "T", zoneName: "Z", link: "https://x" });
    expect(msg).toBe("📊 **T** — Z\nhttps://x");
  });

  it("places the details line between the header and the view", () => {
    const msg = buildShareMessage({
      title: "ssc / tk",
      zoneName: "SSC / TK",
      details: "SSC / TK · 25 players · 6/21/2026",
      view: "Rankings · BOSSES",
      link: "https://x",
    });
    expect(msg).toBe(
      "📊 **ssc / tk** — SSC / TK\nSSC / TK · 25 players · 6/21/2026\nRankings · BOSSES\nhttps://x",
    );
  });
});

describe("postToDiscord", () => {
  it("POSTs the content as JSON to the webhook", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    await postToDiscord("https://discord.com/api/webhooks/1/tok", "hello");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/webhooks/1/tok");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ content: "hello" });
  });
  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(postToDiscord("https://discord.com/api/webhooks/1/tok", "hi")).rejects.toThrow(/429/);
  });
  it("rejects an invalid webhook url before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(postToDiscord("https://evil.com/x", "hi")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
