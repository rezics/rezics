import type MarkdownIt from 'markdown-it'

// ------------------- 1. 處理空格的行內規則 -------------------
function preserveSpaces(state: any, silent: boolean): boolean {
  let pos = state.pos;
  const max = state.posMax;

  while (pos < max && state.src.charCodeAt(pos) !== 0x0A) {
    pos++;
  }

  if (pos === state.pos) return false;

  if (!silent) {
    let text = state.src.slice(state.pos, pos);
    text = text.replace(/ {2,}/g, (match: string) => ' ' + '&nbsp;'.repeat(match.length - 1));

    const token = state.push('text', '', 0);
    token.content = text;
  }

  state.pos = pos;
  return true;
}

// ------------------- 2. 處理多個空行的區塊規則 -------------------
function multipleEmptyLines(state: any, startLine: number, endLine: number, silent: boolean): boolean {
  let nextLine = startLine;

  // 不是空行則返回 false
  if (!state.isEmpty(nextLine)) return false;

  while (nextLine < endLine && state.isEmpty(nextLine)) {
    nextLine++;
  }

  const count = nextLine - startLine;

  if (count < 2) return false; // 多於1行才插入

  if (silent) return true;

  const token = state.push('preserved_empty_lines', '', 0);
  token.block = true;
  token.meta = { count };

  state.line = nextLine;
  return true;
}

// ------------------- 3. 自訂渲染 -------------------
function renderPreservedEmptyLines(tokens: any[], idx: number): string {
  const count = tokens[idx]?.meta?.count ?? 1;
  // 使用 <p></p> 更安全地占位段落
  return '<p></p>'.repeat(count - 1);
}

// ------------------- 4. 組合插件 -------------------
export function preserveFormatPlugin(md: MarkdownIt) {
  // 保留多空格
  md.inline.ruler.at('text', preserveSpaces);

  // 插入空段落處理器（在 paragraph 前）
  md.block.ruler.before('paragraph', 'multiple_empty_lines', multipleEmptyLines);

  // 添加渲染規則
  md.renderer.rules['preserved_empty_lines'] = renderPreservedEmptyLines;
}
