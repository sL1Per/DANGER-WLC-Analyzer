import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createMemoryShareStore } from "./shareStore";
import type { ReportData } from "@wcl/core";

const data = { reportId: "abc", title: "T5", players: [] } as unknown as ReportData;

describe("share endpoints", () => {
  it("POST /api/share stores and returns a shareId; GET returns it back", async () => {
    const app = createApp(createMemoryShareStore());
    const post = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    expect(post.status).toBe(200);
    const { shareId } = await post.json();
    expect(typeof shareId).toBe("string");

    const get = await app.request(`/api/share/${shareId}`);
    expect(get.status).toBe(200);
    expect((await get.json()).reportId).toBe("abc");
  });

  it("GET unknown shareId returns 404", async () => {
    const app = createApp(createMemoryShareStore());
    expect((await app.request("/api/share/missing")).status).toBe(404);
  });

  it("stored payload carries no credential fields (strips clientId/clientSecret/accessToken at publish boundary)", async () => {
    // Fixture intentionally carries credential-like fields to prove the strip is real.
    // If stripCredentials() is removed from the POST handler this test must fail.
    const withCreds = {
      reportId: "abc",
      title: "T5",
      players: [],
      clientId: "my-client-id",
      clientSecret: "super-secret",
      accessToken: "tok_12345",
    } as unknown as ReportData;

    const app = createApp(createMemoryShareStore());
    const post = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(withCreds),
    });
    expect(post.status).toBe(200);
    const { shareId } = await post.json();

    const body = await (await app.request(`/api/share/${shareId}`)).text();

    // (a) Credential fields must NOT be present in the served snapshot
    expect(body).not.toMatch(/clientId|clientSecret|accessToken/);

    // (b) Legitimate field reportId IS still present (strip removed only creds)
    expect(JSON.parse(body).reportId).toBe("abc");
  });

  it("POST /api/share returns 400 when body is missing a valid reportId", async () => {
    const app = createApp(createMemoryShareStore());

    // Missing reportId entirely
    const r1 = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "x" }),
    });
    expect(r1.status).toBe(400);

    // reportId present but not a string
    const r2 = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: 42 }),
    });
    expect(r2.status).toBe(400);
  });

  it("POST /api/share returns 400 for malformed JSON body", async () => {
    const app = createApp(createMemoryShareStore());
    const res = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "not-valid-json{{{",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON");
  });
});
