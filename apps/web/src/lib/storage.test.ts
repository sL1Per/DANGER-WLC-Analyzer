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
} from "./storage";

beforeEach(() => localStorage.clear());

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
