import { languages } from "@codemirror/language-data";
import type { EditorPlugin } from "../core/types";
import { markdown } from "./core/index";
import type { MarkdownLanguageConfig } from "./core/language";
import { type EmojiConfig, emoji } from "./emoji/index";
import { type MentionConfig, mention } from "./mention/index";

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

export { insertImageUrl } from "./core/commands";
// Re-export granular factories
export { markdown } from "./core/index";
export type { EmojiConfig } from "./emoji/index";
export { emoji } from "./emoji/index";
export type { MentionConfig, MentionItem } from "./mention/index";
export { mention } from "./mention/index";
export {
  createNovelRenderer,
  novelModePlugin,
  preserveFormattingPlugin,
} from "./preview/index";
