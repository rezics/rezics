import type { SearchInfo } from "./searchInfo";

const TAG_REGEX = /\[([^\]]+)\]/g;
const FILTER_REGEX = /(\w+):("[^"]+"|\S+)/g;

export function parseSearchString(raw: string): SearchInfo {
  const tags: string[] = [];
  let text = raw;

  let match: RegExpExecArray | null = TAG_REGEX.exec(raw);
  while (match !== null) {
    const tag = match[1];
    if (tag) {
      tags.push(tag);
    }
    text = text.replace(match[0], "");
    match = TAG_REGEX.exec(raw);
  }

  text = text.replace(FILTER_REGEX, "").trim();

  return {
    keyword: text,
    tags,
  };
}
