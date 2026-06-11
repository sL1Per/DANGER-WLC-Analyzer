const ID_RE = /^[a-zA-Z0-9]{16}$/;
const URL_RE = /warcraftlogs\.com\/reports\/([a-zA-Z0-9]{16})/;

/** Returns the 16-char WCL report code from a raw id or report URL, else null. */
export function parseReportInput(input: string): string | null {
  const trimmed = input.trim();
  if (ID_RE.test(trimmed)) return trimmed;
  const m = trimmed.match(URL_RE);
  return m?.[1] ?? null;
}
