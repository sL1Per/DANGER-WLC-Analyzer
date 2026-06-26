import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../test-utils/matchMedia";
import { useIsPhone, useMediaQuery, PHONE_QUERY } from "./useMediaQuery";

afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe("useMediaQuery", () => {
  it("returns true when the query matches", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(true);
  });

  it("returns false when the query does not match", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(false);
  });

  it("returns false when matchMedia is unavailable", () => {
    const { result } = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(false);
  });

  it("useIsPhone uses the phone breakpoint", () => {
    const spy = vi.fn((query: string) => ({
      matches: true, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }));
    window.matchMedia = spy as unknown as typeof window.matchMedia;
    renderHook(() => useIsPhone());
    expect(spy).toHaveBeenCalledWith(PHONE_QUERY);
  });
});
