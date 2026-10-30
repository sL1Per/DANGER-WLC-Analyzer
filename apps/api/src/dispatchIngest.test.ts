import { describe, expect, it, vi } from "vitest";
import { dispatchIngest } from "./dispatchIngest";

describe("dispatchIngest", () => {
  it("starts the auto-ingest workflow on main as a live (non-dry) run", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await dispatchIngest({ token: "ghp_x", repo: "owner/repo" }, fetchFn)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/owner/repo/actions/workflows/auto-ingest.yml/dispatches");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_x");
    expect(headers["User-Agent"]).toBeTruthy();
    expect(JSON.parse(init.body as string)).toEqual({ ref: "main", inputs: { dry_run: "false" } });
  });

  it("does nothing when the token or repo isn't configured", async () => {
    const fetchFn = vi.fn();
    expect(await dispatchIngest({ repo: "owner/repo" }, fetchFn)).toBe(false);
    expect(await dispatchIngest({ token: "ghp_x" }, fetchFn)).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("throws with GitHub's status and message on failure", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("Bad credentials", { status: 401 }));
    await expect(dispatchIngest({ token: "bad", repo: "owner/repo" }, fetchFn)).rejects.toThrow(/401.*Bad credentials/);
  });
});
