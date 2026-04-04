import type MarkdownIt from 'markdown-it';

export interface PreserveFormatOptions {
  preserveSpaces?: boolean;
  preserveEmptyLines?: boolean;
}

/**
 * Rewrites the markdown source so that consecutive blank lines beyond
 * the standard paragraph break (\n\n) are rendered as visible &nbsp; lines.
 * Only activates on 3+ consecutive newlines (standard \n\n is left alone).
 */
function multipleEmptyLines(state: { src: string }): void {
  if (!state.src.includes('\n\n\n')) return;

  state.src = state.src.replace(/\n{3,}/g, (match) => {
    const extraLines = match.length - 2;
    return '\n\n' + '&nbsp;\n\n'.repeat(extraLines);
  });
}

/**
 * Walks inline tokens and replaces runs of 2+ spaces with &nbsp; entities
 * so they render visibly instead of collapsing.
 */
function preserveSpacesCore(state: {
  tokens: Array<{
    type: string;
    children?: Array<{ type: string; content: string }>;
  }>;
  Token: new (type: string, tag: string, nesting: number) => {
    type: string;
    content: string;
  };
}): void {
  for (const blockToken of state.tokens) {
    if (blockToken.type !== 'inline' || !blockToken.children) continue;

    const newChildren: Array<{ type: string; content: string }> = [];

    for (const token of blockToken.children) {
      if (token.type !== 'text' || !token.content.includes('  ')) {
        newChildren.push(token);
        continue;
      }

      const parts = token.content.split(/( {2,})/g);
      for (const part of parts) {
        if (part.length === 0) continue;

        if (/ {2,}/.test(part)) {
          const t = new state.Token('html_inline', '', 0);
          t.content = '&nbsp;'.repeat(part.length);
          newChildren.push(t);
        } else {
          const t = new state.Token('text', '', 0);
          t.content = part;
          newChildren.push(t);
        }
      }
    }

    blockToken.children = newChildren;
  }
}

export function preserveFormattingPlugin(
  md: MarkdownIt,
  options?: PreserveFormatOptions,
): void {
  const { preserveSpaces = true, preserveEmptyLines = true } = options ?? {};

  if (preserveEmptyLines) {
    md.core.ruler.before(
      'normalize',
      'line_break_to_br',
      multipleEmptyLines as Parameters<typeof md.core.ruler.before>[2],
    );
  }

  if (preserveSpaces) {
    md.core.ruler.push(
      'preserve_spaces_core',
      preserveSpacesCore as Parameters<typeof md.core.ruler.push>[1],
    );
  }
}
