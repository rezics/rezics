import type { LanguageDescription } from "@codemirror/language";
import type { EditorPlugin } from "../core/types";
import { markdown } from "./core/index";
import type { MarkdownLanguageConfig } from "./core/language";
import { type EmojiConfig, emoji } from "./emoji/index";
import { type MentionConfig, mention } from "./mention/index";

// Lazy-loaded cache; avoids top-level import of @codemirror/language-data
// which triggers a Rolldown chunk initialization order bug.
// 惰性缓存；避免顶层导入 @codemirror/language-data，该模块
// 会触发 Rolldown chunk 初始化顺序 bug。
let _cachedLanguages: readonly LanguageDescription[] | undefined;
async function loadLanguages(): Promise<readonly LanguageDescription[]> {
  return (_cachedLanguages ??= (await import("@codemirror/language-data"))
    .languages);
}

export interface MarkdownFullConfig extends MarkdownLanguageConfig {
  mention?: MentionConfig;
  emoji?: EmojiConfig;
}

export async function markdownFull(
  config?: MarkdownFullConfig,
): Promise<EditorPlugin[]> {
  const codeLanguages = config?.codeLanguages ?? (await loadLanguages());
  const plugins: EditorPlugin[] = [markdown({ codeLanguages })];

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
// 重新导出细粒度工厂函数
export { markdown } from "./core/index";
export type { EmojiConfig } from "./emoji/index";
export { emoji } from "./emoji/index";
export type { MentionConfig, MentionItem } from "./mention/index";
export { mention } from "./mention/index";
export {
  createRezicsRenderer,
  novelModePlugin,
  preserveFormattingPlugin,
} from "./preview/index";
