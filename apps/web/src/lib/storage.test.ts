import { beforeEach, describe, expect, it } from "vitest";
import { loadCredentials, saveCredentials, loadToken, saveToken } from "./storage";

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
