import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import type { MentionConfig, MentionItem } from "./types";

function defaultFormatMention(item: MentionItem): string {
  return `@${item.label} `;
}

function createMentionSource(config: MentionConfig) {
  const format = config.formatMention ?? defaultFormatMention;

  return async (
    context: CompletionContext,
  ): Promise<CompletionResult | null> => {
    // Find @ trigger — must be at start of line or after whitespace/punctuation
    // 查找 @ 触发符——必须位于行首或空白/标点之后
    const line = context.state.doc.lineAt(context.pos);
    const lineText = line.text.slice(0, context.pos - line.from);

    const match = lineText.match(/(^|[\s\p{P}])@(\S*)$/u);
    if (!match) return null;

    const query = match[2];
    const atPos = context.pos - query.length - 1; // position of @ — @ 的位置

    let items: MentionItem[];
    try {
      items = await config.source(query);
    } catch {
      return null;
    }

    if (items.length === 0) return null;

    return {
      from: atPos,
      options: items.map((item) => ({
        label: `@${item.label}`,
        apply: format(item),
        detail: item.id,
      })),
    };
  };
}

export function mentionExtension(config: MentionConfig): Extension {
  return autocompletion({
    override: [createMentionSource(config)],
    defaultKeymap: true,
  });
}
