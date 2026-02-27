import type {SearchInfo} from './searchInfo';

const TAG_REGEX = /\[([^\]]+)\]/g;
const FILTER_REGEX = /(\w+):("[^"]+"|\S+)/g;

export function parseSearchString(raw: string): SearchInfo {
  const tags: string[] = [];
  let text = raw;

  let match: RegExpExecArray | null;
  while ((match = TAG_REGEX.exec(raw)) !== null) {
    const tag = match[1];
    if (tag) {
      tags.push(tag);
    }
    text = text.replace(match[0], '');
  }

  text = text.replace(FILTER_REGEX, '').trim();

  return {
    keyword: text,
    tags,
  };
}
