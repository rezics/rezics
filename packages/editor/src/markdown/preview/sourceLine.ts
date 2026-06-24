import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";

/**
 * markdown-it plugin that injects `data-source-line` attributes on block-level
 * HTML elements using the token's `map` metadata (0-based starting line).
 *
 * Only annotates opening block tokens (nesting === 1) and self-closing block
 * tokens (nesting === 0, e.g. `fence`, `code_block`, `hr`). Inline tokens and
 * closing tags are skipped.
 *
 * markdown-it 插件，利用 token 的 `map` 元数据（0 起始行号）为块级 HTML
 * 元素注入 `data-source-line` 属性。
 *
 * 仅标注块级开标签 token（nesting === 1）和自闭合块 token
 * （nesting === 0，例如 `fence`、`code_block`、`hr`）。内联 token 和闭标签会被跳过。
 */
export function sourceLinePlugin(md: MarkdownIt): void {
  md.core.ruler.push("source_line", ((state: StateCore) => {
    for (const token of state.tokens) {
      if (!token.map) continue;
      // Opening block tags and self-closing block tokens
      // 块级开标签和自闭合块 token
      if (token.nesting >= 0 && token.type !== "inline") {
        token.attrSet("data-source-line", String(token.map[0]));
      }
    }
  }) as Parameters<typeof md.core.ruler.push>[1]);
}
