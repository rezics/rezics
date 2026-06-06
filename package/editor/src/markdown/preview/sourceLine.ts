import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";

/**
 * markdown-it plugin that injects `data-source-line` attributes on block-level
 * HTML elements using the token's `map` metadata (0-based starting line).
 *
 * Only annotates opening block tokens (nesting === 1) and self-closing block
 * tokens (nesting === 0, e.g. `fence`, `code_block`, `hr`). Inline tokens and
 * closing tags are skipped.
 */
export function sourceLinePlugin(md: MarkdownIt): void {
  md.core.ruler.push("source_line", ((state: StateCore) => {
    for (const token of state.tokens) {
      if (!token.map) continue;
      // Opening block tags and self-closing block tokens
      if (token.nesting >= 0 && token.type !== "inline") {
        token.attrSet("data-source-line", String(token.map[0]));
      }
    }
  }) as Parameters<typeof md.core.ruler.push>[1]);
}
