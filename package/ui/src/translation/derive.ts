/**
 * `deriveTitleSummary` extracts a (title, summary) pair from a free-form body.
 *
 * - Title: first non-empty line, stripped of common Markdown heading/quote
 *   prefixes, capped at 80 characters.
 * - Summary: the next chunk of text after the title (skipping empty lines),
 *   joined into a single line and capped at 200 characters.
 *
 * Returns `undefined` for either field when the body offers nothing usable;
 * callers should fall back to existing UnitTranslation values rather than
 * forcing an empty string.
 */
export function deriveTitleSummary(body: string): {
  title?: string;
  summary?: string;
} {
  if (!body) return {};

  const lines = body.split(/\r?\n/);
  let title: string | undefined;
  let summaryStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/^\s*[#>*-]+\s*/, "").trim();
    if (trimmed.length > 0) {
      title = trimmed.length > 80 ? `${trimmed.slice(0, 80).trim()}…` : trimmed;
      summaryStart = i + 1;
      break;
    }
  }

  let summary: string | undefined;
  for (let i = summaryStart; i < lines.length; i++) {
    if (lines[i].trim().length === 0) continue;
    const buf: string[] = [];
    for (let j = i; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t.length === 0) break;
      buf.push(t);
    }
    const joined = buf.join(" ").trim();
    if (joined.length > 0) {
      summary =
        joined.length > 200 ? `${joined.slice(0, 200).trim()}…` : joined;
    }
    break;
  }

  return { title, summary };
}
