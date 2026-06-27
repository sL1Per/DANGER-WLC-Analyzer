import { useEffect, useState } from "react";

export const PHONE_QUERY = "(max-width: 640px)";

/** Reactive media-query match. SSR/jsdom-safe: returns false when matchMedia is absent. */
export function useMediaQuery(query: string): boolean {
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // sync in case it changed between render and effect
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
