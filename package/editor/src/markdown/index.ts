import type { EditorPlugin } from '../core/types';
import type { MarkdownLanguageConfig } from './core/language';
import { markdown } from './core/index';
import { mention, type MentionConfig } from './mention/index';
import { emoji, type EmojiConfig } from './emoji/index';
import { languages } from '@codemirror/language-data';

export interface MarkdownFullConfig extends MarkdownLanguageConfig {
  mention?: MentionConfig;
  emoji?: EmojiConfig;
}

export function markdownFull(config?: MarkdownFullConfig): EditorPlugin[] {
  const plugins: EditorPlugin[] = [
    markdown({ codeLanguages: config?.codeLanguages ?? languages }),
  ];

  if (config?.mention) {
    plugins.push(mention(config.mention));
  }

  if (config?.emoji) {
    plugins.push(emoji(config.emoji));
  }

  return plugins;
}

// Re-export granular factories
export { markdown } from './core/index';
export { mention } from './mention/index';
export type { MentionItem, MentionConfig } from './mention/index';
export { emoji } from './emoji/index';
export type { EmojiConfig } from './emoji/index';
export {
  preserveFormattingPlugin,
  novelModePlugin,
  createNovelRenderer,
} from './preview/index';
