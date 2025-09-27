export interface SearchInfo {
  searchText: string;
  searchTags: string[];
}

/**
 * [Some] -> Some
 */
const TAG_REGEX = /\[([^\]]+)\]/g;

/**
 * user:admin -> [user, admin]
 * book:"Correct Code" -> [book, "Correct Code"]
 */
const FILTER_REGEX = /(\w+):("[^"]+"|\S+)/g;

/**
 * Parse a StackOverflow-style search query.
 * Currently extracts [tags] and plain search text.
 * Other filters (user:123, score:3, etc.) are stripped but can be added later.
 */
export function parseSearchString(raw: string): SearchInfo {
  const tags: string[] = [];
  let text = raw;

  // Extract tags like [tag]
  let match: RegExpExecArray | null;
  while ((match = TAG_REGEX.exec(raw)) !== null) {
    const tag = match[1];
    if (tag) {
      tags.push(tag);
    }
    text = text.replace(match[0], "");
  }

  // Remove key:value filters for now
  text = text.replace(FILTER_REGEX, "").trim();

  return {
    searchText: text,
    searchTags: tags,
  };
}
