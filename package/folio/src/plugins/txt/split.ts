import type { FolioNode } from "../../types";
import { DEFAULT_SPLIT_RULES } from "./rules";

export interface TxtSplitOptions {
  splitRules?: RegExp[];
}

export interface TxtSplitResult {
  tree: FolioNode[];
  ruleUsed: RegExp | null;
}

interface Chunk {
  title: string;
  content: string;
}

function splitByRule(raw: string, rule: RegExp): Chunk[] {
  // Ensure the regex has the multiline flag and is global for splitting
  const globalRule = new RegExp(
    rule.source,
    rule.flags.includes("g") ? rule.flags : `${rule.flags}g`,
  );
  // Also ensure multiline
  const mlRule = new RegExp(
    globalRule.source,
    globalRule.flags.includes("m") ? globalRule.flags : `${globalRule.flags}m`,
  );

  const matches: { index: number; match: string }[] = [];
  let m: RegExpExecArray | null;
  m = mlRule.exec(raw);

  while (m !== null) {
    // Extract the full line containing the match for a better title
    const lineStart = raw.lastIndexOf("\n", m.index - 1) + 1;
    const lineEnd = raw.indexOf("\n", m.index);
    const fullLine = raw.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    matches.push({ index: m.index, match: fullLine });
    // Prevent infinite loops on zero-width matches
    if (m.index === mlRule.lastIndex) mlRule.lastIndex++;
    m = mlRule.exec(raw);
  }

  if (matches.length < 2) return [];

  const chunks: Chunk[] = [];

  // Content before first match (if any)
  if (matches[0].index > 0) {
    const before = raw.slice(0, matches[0].index).trim();
    if (before) {
      chunks.push({ title: "Preface", content: before });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const content = raw.slice(start, end);
    const title = matches[i].match.trim();
    chunks.push({ title, content: content.trim() });
  }

  return chunks;
}

export function splitTxt(
  raw: string,
  options?: TxtSplitOptions,
): TxtSplitResult {
  const rules = options?.splitRules ?? DEFAULT_SPLIT_RULES;

  for (const rule of rules) {
    const chunks = splitByRule(raw, rule);
    if (chunks.length >= 2) {
      return {
        tree: chunks.map((chunk, i) => ({
          id: `txt-${i}`,
          title: chunk.title,
          fetch: () =>
            Promise.resolve({
              contentType: "txt",
              raw: chunk.content,
            }),
        })),
        ruleUsed: rule,
      };
    }
  }

  // Fallback: single chapter
  return {
    tree: [
      {
        id: "txt-0",
        title: "Full Text",
        fetch: () =>
          Promise.resolve({
            contentType: "txt",
            raw,
          }),
      },
    ],
    ruleUsed: null,
  };
}
