import { beforeEach, describe, expect, it } from "vitest";
import {
  loadCredentials,
  saveCredentials,
  loadToken,
  saveToken,
  loadWebhookUrl,
  saveWebhookUrl,
  clearWebhookUrl,
  loadTheme,
  saveTheme,
  loadRecentReports,
  addRecentReport,
  saveDensity,
  loadDensity,
} from "./storage";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe("credentials storage", () => {
  it("round-trips credentials", () => {
    saveCredentials({ clientId: "id", clientSecret: "sec" });
    expect(loadCredentials()).toEqual({ clientId: "id", clientSecret: "sec" });
  });
  it("returns null when nothing stored", () => {
    expect(loadCredentials()).toBeNull();
    expect(loadToken()).toBeNull();
  });
  it("drops expired tokens", () => {
    saveToken({ accessToken: "tok", expiresAt: Date.now() - 1000 });
    expect(loadToken()).toBeNull();
  });
  it("returns valid tokens", () => {
    saveToken({ accessToken: "tok", expiresAt: Date.now() + 60_000 });
    expect(loadToken()?.accessToken).toBe("tok");
  });
  it("keeps the token in sessionStorage (not persisted to disk like the secret)", () => {
    saveToken({ accessToken: "tok", expiresAt: Date.now() + 60_000 });
    expect(sessionStorage.getItem("wcl.token")).not.toBeNull();
    expect(localStorage.getItem("wcl.token")).toBeNull();
  });
  it("drops corrupt credentials", () => {
    localStorage.setItem("wcl.credentials", "{bad json");
    expect(loadCredentials()).toBeNull();
    expect(localStorage.getItem("wcl.credentials")).toBeNull();
  });
});

describe("webhook url storage", () => {
  it("round-trips a webhook url (trimmed)", () => {
    saveWebhookUrl("  https://discord.com/api/webhooks/1/abc  ");
    expect(loadWebhookUrl()).toBe("https://discord.com/api/webhooks/1/abc");
  });
  it("returns null when nothing stored", () => {
    expect(loadWebhookUrl()).toBeNull();
  });
  it("clears the webhook url", () => {
    saveWebhookUrl("https://discord.com/api/webhooks/1/abc");
    clearWebhookUrl();
    expect(loadWebhookUrl()).toBeNull();
  });
  it("treats a blank url as a clear", () => {
    saveWebhookUrl("https://discord.com/api/webhooks/1/abc");
    saveWebhookUrl("   ");
    expect(loadWebhookUrl()).toBeNull();
  });
});

describe("theme storage", () => {
  it("round-trips a theme", () => {
    saveTheme("dark");
    expect(loadTheme()).toBe("dark");
  });
  it("returns null when nothing stored", () => {
    expect(loadTheme()).toBeNull();
  });
  it("ignores a junk stored value", () => {
    localStorage.setItem("wcl.theme", "neon");
    expect(loadTheme()).toBeNull();
  });
});

describe("recent reports storage", () => {
  const mk = (id: string, title = id) => ({ id, title, zoneName: "Gruul", players: 21, startTime: 1 });

  it("returns an empty list when nothing stored", () => {
    expect(loadRecentReports()).toEqual([]);
  });
  it("prepends most-recent and stamps viewedAt", () => {
    addRecentReport(mk("a"));
    addRecentReport(mk("b"));
    const list = loadRecentReports();
    expect(list.map((r) => r.id)).toEqual(["b", "a"]);
    expect(list[0].viewedAt).toBeGreaterThan(0);
  });
  it("dedupes by id, moving an existing report to the front", () => {
    addRecentReport(mk("a"));
    addRecentReport(mk("b"));
    addRecentReport(mk("a", "a-again"));
    const list = loadRecentReports();
    expect(list.map((r) => r.id)).toEqual(["a", "b"]);
    expect(list[0].title).toBe("a-again");
  });
  it("caps the list at 12 entries", () => {
    for (let i = 0; i < 15; i++) addRecentReport(mk(`r${i}`));
    expect(loadRecentReports()).toHaveLength(12);
  });
  it("recovers from a corrupt stored value", () => {
    localStorage.setItem("wcl.recentReports", "{bad json");
    expect(loadRecentReports()).toEqual([]);
    expect(localStorage.getItem("wcl.recentReports")).toBeNull();
  });
});

describe("density", () => {
  it("round-trips a saved density", () => {
    saveDensity("compact");
    expect(loadDensity()).toBe("compact");
  });
  it("returns null when nothing is stored", () => {
    localStorage.clear();
    expect(loadDensity()).toBeNull();
  });
  it("ignores a corrupt stored value", () => {
    localStorage.setItem("wcl.density", "roomy");
    expect(loadDensity()).toBeNull();
  });
});
