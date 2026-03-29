import { json as jsonLang } from '@codemirror/lang-json';
import type { Extension } from '@codemirror/state';

export function jsonLanguageSupport(): Extension {
  return jsonLang();
}
