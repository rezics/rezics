import MarkdownIt from 'markdown-it';

export interface PreserveFormatOptions {
  preserveSpaces?: boolean;
  preserveEmptyLines?: boolean;
}

export interface NovelRendererOptions {
  html?: boolean;
  linkify?: boolean;
  typographer?: boolean;
  highlight?: ((code: string, lang: string) => string) | false;
}

/**
 * Reads `token.map` gaps between block elements and injects `empty_line` tokens.
 * A single empty line (standard paragraph break) is ignored; gaps of 2+ empty lines
 * emit the full count as tokens so the visual spacing is faithfully preserved.
 */
function emptyLinesCore(state: {
  tokens: Array<{
    type: string;
    map?: [number, number] | null;
    meta?: unknown;
  }>;
  Token: new (type: string, tag: string, nesting: number) => {
    type: string;
    map?: [number, number] | null;
    meta?: unknown;
  };
}): void {
  const out: typeof state.tokens = [];
  let prevEnd = -1;

  for (const token of state.tokens) {
    if (token.map) {
      if (prevEnd >= 0) {
        const gap = token.map[0] - prevEnd;
        if (gap >= 2) {
          const spacer = new state.Token('empty_lines', '', 0);
          spacer.meta = { count: gap };
          out.push(spacer);
        }
      }
      prevEnd = token.map[1];
    }
    out.push(token);
  }

  state.tokens = out;
}

/**
 * Walks inline tokens and replaces runs of 2+ spaces with `&nbsp;` entities
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

/** markdown-it plugin: preserves extra blank lines as a height-compensated spacer. */
export function emptyLinesPlugin(md: MarkdownIt): void {
  md.core.ruler.push(
    'empty_lines',
    emptyLinesCore as Parameters<typeof md.core.ruler.push>[1],
  );
  md.renderer.rules.empty_lines = (tokens, idx) => {
    const count = (tokens[idx].meta as { count: number }).count;
    return (
      `<div class="preserved-empty-lines" ` +
      `style="height:calc(${count} * 1lh);margin-block:calc(-0.5 * var(--p-margin, 1em))" ` +
      `aria-hidden="true"></div>`
    );
  };
}

/** markdown-it plugin: preserves runs of 2+ inline spaces as `&nbsp;` entities. */
export function preserveSpacesPlugin(md: MarkdownIt): void {
  md.core.ruler.push(
    'preserve_spaces',
    preserveSpacesCore as Parameters<typeof md.core.ruler.push>[1],
  );
}

/** markdown-it plugin: enables `breaks`, blank-line preservation, and space preservation. */
export function novelModePlugin(md: MarkdownIt): void {
  md.options.breaks = true;
  md.use(emptyLinesPlugin).use(preserveSpacesPlugin);
}

/** markdown-it plugin: selectively applies blank-line and space preservation. */
export function preserveFormattingPlugin(
  md: MarkdownIt,
  options?: PreserveFormatOptions,
): void {
  const { preserveSpaces = true, preserveEmptyLines = true } = options ?? {};
  if (preserveEmptyLines) md.use(emptyLinesPlugin);
  if (preserveSpaces) md.use(preserveSpacesPlugin);
}

/** Returns a fully configured `MarkdownIt` instance for novel/prose content. */
export function createNovelRenderer(options?: NovelRendererOptions): MarkdownIt {
  return new MarkdownIt({
    html: options?.html ?? false,
    linkify: options?.linkify ?? true,
    typographer: options?.typographer ?? true,
    highlight: options?.highlight === false ? undefined : options?.highlight,
  }).use(novelModePlugin);
}
