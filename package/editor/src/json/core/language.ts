import { json as jsonLang } from '@codemirror/lang-json';
import type { Extension } from '@codemirror/state';
import { jsonHighlighting } from './highlight';

export function jsonLanguageSupport(): Extension {
  return [jsonLang(), jsonHighlighting()];
}
