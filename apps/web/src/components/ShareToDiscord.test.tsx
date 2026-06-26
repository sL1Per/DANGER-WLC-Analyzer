import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ShareToDiscord } from "./ShareToDiscord";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderShare() {
  return render(
    <MemoryRouter>
      <ShareToDiscord title="Tuesday SSC" zoneName="SSC" link="https://x/cla/abc" />
    </MemoryRouter>,
  );
}

describe("ShareToDiscord", () => {
  it("prompts to set a webhook when none is configured", () => {
    renderShare();
    expect(screen.getByText(/Set a Discord webhook/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Share to Discord/i })).not.toBeInTheDocument();
  });

  it("posts the share message and confirms success", async () => {
    localStorage.setItem("wcl.discordWebhook", "https://discord.com/api/webhooks/1/tok");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    renderShare();
    fireEvent.click(screen.getByRole("button", { name: /Share to Discord/i }));

    await waitFor(() => expect(screen.getByText(/Posted to Discord/i)).toBeInTheDocument());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.content).toContain("https://x/cla/abc");
    expect(body.content).toContain("Tuesday SSC");
  });

  it("includes the current view description in the posted message", async () => {
    localStorage.setItem("wcl.discordWebhook", "https://discord.com/api/webhooks/1/tok");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <ShareToDiscord title="Tuesday SSC" zoneName="SSC" link="https://x/cla/abc" view="Role breakdown · Lady Vashj" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Share to Discord/i }));

    await waitFor(() => expect(screen.getByText(/Posted to Discord/i)).toBeInTheDocument());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.content).toContain("Role breakdown · Lady Vashj");
  });

  it("surfaces an error when the post fails", async () => {
    localStorage.setItem("wcl.discordWebhook", "https://discord.com/api/webhooks/1/tok");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    renderShare();
    fireEvent.click(screen.getByRole("button", { name: /Share to Discord/i }));

    await waitFor(() => expect(screen.getByText(/429/)).toBeInTheDocument());
  });
});
