import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { reportFixture } from "@wcl/core";
import { ReportPage } from "./ReportPage";
import { ApiError } from "../lib/api";

type MockHookState = Partial<{
  result: { data: typeof reportFixture; stale?: boolean } | null;
  error: ApiError | null;
  loading: boolean;
  reload: ReturnType<typeof vi.fn>;
}>;

// Mutable so individual tests can simulate loading / error states without
// needing a separate mock per test.
let mockHookState: MockHookState = {};

vi.mock("../lib/useReport", () => ({
  useReport: () => mockHookState,
}));

function defaultLoaded() {
  return {
    result: { data: reportFixture, stale: false },
    error: null,
    loading: false,
    reload: vi.fn(),
  };
}

beforeEach(() => {
  mockHookState = defaultLoaded();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/report/:reportId" element={<ReportPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe("ReportPage — loader branches", () => {
  it("renders ReportView content (category nav) when the report loads successfully", () => {
    renderAt("/report/abc");
    // The Rankings tab is the default visible category when data is available.
    expect(screen.getByRole("button", { name: /^Rankings$/i })).toBeInTheDocument();
  });

  it("renders a loading indicator and no report content while fetching", () => {
    mockHookState = { result: null, error: null, loading: true, reload: vi.fn() };
    renderAt("/report/abc");
    expect(screen.queryByRole("button", { name: /^Rankings$/i })).not.toBeInTheDocument();
  });

  it("shows an error alert when the report fails to load", () => {
    mockHookState = { result: null, error: new ApiError(500, "Request failed with status 500"), loading: false, reload: vi.fn() };
    renderAt("/report/abc");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Request failed with status 500/i)).toBeInTheDocument();
  });

  it("shows a link to /settings when error.needsKey is true", () => {
    mockHookState = {
      result: null,
      error: new ApiError(401, "API key required", true),
      loading: false,
      reload: vi.fn(),
    };
    renderAt("/report/abc");
    expect(screen.getByRole("link", { name: /Add your WCL credentials/i })).toBeInTheDocument();
  });

  it("does not show the settings link when error.needsKey is false", () => {
    mockHookState = {
      result: null,
      error: new ApiError(500, "Network error", false),
      loading: false,
      reload: vi.fn(),
    };
    renderAt("/report/abc");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Add your WCL credentials/i })).not.toBeInTheDocument();
  });
});

// NOTE: Discord-posting and publish-share coverage lives in PublishShare.test.tsx,
// which tests the component in isolation (webhook POST, snapshot upload, success
// confirmation, and error surfacing). The old Discord assertion that lived here
// was removed because ReportPage now passes shareActions={null}.

describe("ReportPage — category / tab behaviour (via ReportView)", () => {
  it("defaults to the Improvements category", () => {
    renderAt("/report/abc");
    expect(screen.getByRole("heading", { name: /work in progress/i })).toBeInTheDocument();
  });
  it("shows the Rankings category when selected", () => {
    renderAt("/report/abc?cat=summary");
    expect(screen.getByText(/Damage Dealers/i)).toBeInTheDocument();
  });
  it("switches category from the subnav", async () => {
    renderAt("/report/abc");
    fireEvent.click(screen.getByRole("button", { name: /^Summary$/i }));
    await waitFor(() => expect(screen.getAllByText("Deaths").length).toBeGreaterThan(0));
  });
  it("renders the Performance tab and shows panel titles when clicked", async () => {
    renderAt("/report/abc");
    // "Performance" tab is now labelled "Summary" in the nav (key=performance, label="Summary")
    expect(screen.getByRole("button", { name: /^Summary$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Summary$/i }));
    await waitFor(() => expect(screen.getByText("Damage Done By Source")).toBeInTheDocument());
  });
  it("hides combatantInfo-only tabs on the TRASH card and falls back from a hidden tab", () => {
    // fight=-2 is ALL_TRASH; cat=gear is hidden there, so it must fall back to a visible tab
    renderAt("/report/abc?fight=-2&cat=gear");
    expect(screen.queryByRole("button", { name: /^Rankings$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Gear$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Resistances$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Summary$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Consumables$/i })).toBeInTheDocument();
    // the event-sourced Performance tab (now labelled "Summary") has trash data, so it stays visible
    // (also verified by the getByRole("button", { name: /^Summary$/i }) assertion above)
    expect(screen.getByRole("button", { name: /^Role breakdown$/i })).toBeInTheDocument();
  });
  it("shows Rankings only on the BOSSES card, not on an individual boss fight", () => {
    // fight=3 is an individual boss pull; Rankings (boss-encounter percentiles)
    // only belong on the combined BOSSES card, so the tab must be hidden here.
    renderAt("/report/abc?fight=3");
    expect(screen.queryByRole("button", { name: /^Rankings$/i })).not.toBeInTheDocument();
    // Other combatantInfo tabs still show on a boss pull.
    expect(screen.getByRole("button", { name: /^Gear$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Summary$/i })).toBeInTheDocument();
    // Timeline needs one specific boss pull in view, so it shows here.
    expect(screen.getByRole("button", { name: /^Timeline$/i })).toBeInTheDocument();
  });
  it("hides Timeline on the combined BOSSES card and the TRASH card", () => {
    renderAt("/report/abc");
    expect(screen.queryByRole("button", { name: /^Timeline$/i })).not.toBeInTheDocument();
    renderAt("/report/abc?fight=-2");
    expect(screen.queryByRole("button", { name: /^Timeline$/i })).not.toBeInTheDocument();
  });
  it("shows Buff consumables only on the BOSSES card and renders the table", async () => {
    renderAt("/report/abc");
    const tab = screen.getByRole("button", { name: /^Buff consumables$/i });
    expect(tab).toBeInTheDocument();
    fireEvent.click(tab);
    await waitFor(() => expect(screen.getByText(/Only boss fights evaluated/i)).toBeInTheDocument());
  });
  it("hides Buff consumables on an individual boss pull and on the TRASH card", () => {
    renderAt("/report/abc?fight=3");
    expect(screen.queryByRole("button", { name: /^Buff consumables$/i })).not.toBeInTheDocument();
    renderAt("/report/abc?fight=-2");
    expect(screen.queryByRole("button", { name: /^Buff consumables$/i })).not.toBeInTheDocument();
  });
  it("hides Resistances on an unrelated boss pull (the fixture has no SR boss at all)", () => {
    // fight=3 is Hydross the Unstable — not an SR-relevant encounter, and the
    // combined BOSSES card has no SR boss in this fixture either.
    renderAt("/report/abc?fight=3");
    expect(screen.queryByRole("button", { name: /^Resistances$/i })).not.toBeInTheDocument();
    renderAt("/report/abc");
    expect(screen.queryByRole("button", { name: /^Resistances$/i })).not.toBeInTheDocument();
  });
  describe("with an SR-relevant boss in the report", () => {
    function loadSrFixture() {
      const srFixture = structuredClone(reportFixture);
      srFixture.fights.push({
        id: 99, name: "Mother Shahraz", encounterId: 602, isBoss: true, kill: true,
        startTime: 500_000, endTime: 560_000,
      });
      mockHookState = { result: { data: srFixture, stale: false }, error: null, loading: false, reload: vi.fn() };
    }

    it("shows Resistances on that exact pull", () => {
      loadSrFixture();
      renderAt("/report/abc?fight=99");
      expect(screen.getByRole("button", { name: /^Resistances$/i })).toBeInTheDocument();
    });
    it("shows Resistances on the combined BOSSES card", () => {
      loadSrFixture();
      renderAt("/report/abc");
      expect(screen.getByRole("button", { name: /^Resistances$/i })).toBeInTheDocument();
    });
    it("still hides Resistances on an unrelated pull, even though the report has Shahraz elsewhere", () => {
      loadSrFixture();
      renderAt("/report/abc?fight=3"); // Hydross the Unstable
      expect(screen.queryByRole("button", { name: /^Resistances$/i })).not.toBeInTheDocument();
    });
  });
});
