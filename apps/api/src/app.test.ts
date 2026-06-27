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

  it("stored payload carries no credential fields", async () => {
    const app = createApp(createMemoryShareStore());
    const post = await app.request("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const { shareId } = await post.json();
    const body = await (await app.request(`/api/share/${shareId}`)).text();
    expect(body).not.toMatch(/clientId|clientSecret|accessToken/);
  });
});
