import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import type { Extension } from '@codemirror/state';

export function markdownLanguageSupport(): Extension {
  return markdown({
    base: markdownLanguage,
    extensions: [GFM],
  });
}
