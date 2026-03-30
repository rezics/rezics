import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import type { Extension } from '@codemirror/state';
import type { LanguageDescription } from '@codemirror/language';
import { markdownHighlighting } from './highlight';

export interface MarkdownLanguageConfig {
  codeLanguages?:
    | readonly LanguageDescription[]
    | ((info: string) => LanguageDescription | null);
}

export function markdownLanguageSupport(
  config?: MarkdownLanguageConfig,
): Extension {
  return [
    markdown({
      base: markdownLanguage,
      extensions: [GFM],
      codeLanguages: config?.codeLanguages,
    }),
    markdownHighlighting(),
  ];
}
