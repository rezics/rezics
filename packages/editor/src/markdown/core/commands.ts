import type { EditorView } from "@codemirror/view";

function wrapToggle(view: EditorView, marker: string): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selected = state.sliceDoc(from, to);

  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length >= marker.length * 2
  ) {
    // Unwrap
    // 去除包裹
    view.dispatch({
      changes: {
        from,
        to,
        insert: selected.slice(marker.length, -marker.length),
      },
      selection: {
        anchor: from,
        head: to - marker.length * 2,
      },
    });
    return true;
  }

  // Check if surrounding text has the markers
  // 检查周围文本是否带有标记符
  const before = state.sliceDoc(Math.max(0, from - marker.length), from);
  const after = state.sliceDoc(to, to + marker.length);

  if (before === marker && after === marker) {
    // Unwrap surrounding markers
    // 去除周围的标记符
    view.dispatch({
      changes: [
        { from: from - marker.length, to: from, insert: "" },
        { from: to, to: to + marker.length, insert: "" },
      ],
      selection: {
        anchor: from - marker.length,
        head: to - marker.length,
      },
    });
    return true;
  }

  if (from === to) {
    // No selection — insert markers and place cursor between
    // 没有选区——插入标记符并将光标置于其间
    view.dispatch({
      changes: { from, to, insert: marker + marker },
      selection: { anchor: from + marker.length },
    });
  } else {
    // Wrap selection
    // 包裹选区
    view.dispatch({
      changes: { from, to, insert: marker + selected + marker },
      selection: {
        anchor: from + marker.length,
        head: to + marker.length,
      },
    });
  }
  return true;
}

function lineToggle(
  view: EditorView,
  prefix: string,
  ordered = false,
): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  const lineFrom = state.doc.lineAt(from);
  const lineTo = state.doc.lineAt(to);

  const changes: { from: number; to: number; insert: string }[] = [];
  let allHavePrefix = true;

  for (let i = lineFrom.number; i <= lineTo.number; i++) {
    const line = state.doc.line(i);
    const expectedPrefix = ordered ? `${i - lineFrom.number + 1}. ` : prefix;
    if (!line.text.startsWith(expectedPrefix)) {
      allHavePrefix = false;
      break;
    }
  }

  if (allHavePrefix) {
    // Remove prefix
    // 移除前缀
    for (let i = lineFrom.number; i <= lineTo.number; i++) {
      const line = state.doc.line(i);
      const expectedPrefix = ordered ? `${i - lineFrom.number + 1}. ` : prefix;
      changes.push({
        from: line.from,
        to: line.from + expectedPrefix.length,
        insert: "",
      });
    }
  } else {
    // Add prefix
    // 添加前缀
    for (let i = lineFrom.number; i <= lineTo.number; i++) {
      const line = state.doc.line(i);
      const newPrefix = ordered ? `${i - lineFrom.number + 1}. ` : prefix;
      changes.push({
        from: line.from,
        to: line.from,
        insert: newPrefix,
      });
    }
  }

  view.dispatch({ changes });
  return true;
}

export function toggleBold(view: EditorView): boolean {
  return wrapToggle(view, "**");
}

export function toggleItalic(view: EditorView): boolean {
  return wrapToggle(view, "*");
}

export function toggleStrikethrough(view: EditorView): boolean {
  return wrapToggle(view, "~~");
}

export function toggleCode(view: EditorView): boolean {
  return wrapToggle(view, "`");
}

export function toggleHeading(view: EditorView): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const match = line.text.match(/^(#{1,6})\s/);

  if (match) {
    const level = match[1].length;
    if (level >= 6) {
      // Remove heading
      // 移除标题
      view.dispatch({
        changes: { from: line.from, to: line.from + level + 1, insert: "" },
      });
    } else {
      // Increase level
      // 提升标题级别
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: "#" },
      });
    }
  } else {
    // Add h1
    // 添加一级标题
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: "# " },
    });
  }
  return true;
}

export function toggleBlockquote(view: EditorView): boolean {
  return lineToggle(view, "> ");
}

export function toggleUnorderedList(view: EditorView): boolean {
  return lineToggle(view, "- ");
}

export function toggleOrderedList(view: EditorView): boolean {
  return lineToggle(view, "1. ", true);
}

export function toggleCodeBlock(view: EditorView): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selected = state.sliceDoc(from, to);

  const lineFrom = state.doc.lineAt(from);
  const lineTo = state.doc.lineAt(to);

  // Check if already in a code block
  // 检查是否已经位于代码块中
  const prevLine =
    lineFrom.number > 1 ? state.doc.line(lineFrom.number - 1).text : "";
  const nextLine =
    lineTo.number < state.doc.lines
      ? state.doc.line(lineTo.number + 1).text
      : "";

  if (prevLine.startsWith("```") && nextLine.startsWith("```")) {
    // Unwrap code block
    // 去除代码块包裹
    const prevLineObj = state.doc.line(lineFrom.number - 1);
    const nextLineObj = state.doc.line(lineTo.number + 1);
    view.dispatch({
      changes: [
        { from: prevLineObj.from, to: prevLineObj.to + 1, insert: "" },
        { from: nextLineObj.from - 1, to: nextLineObj.to, insert: "" },
      ],
    });
  } else {
    // Wrap in code block
    // 用代码块包裹
    view.dispatch({
      changes: {
        from,
        to,
        insert: `\`\`\`\n${selected}\n\`\`\``,
      },
    });
  }
  return true;
}

export function insertLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const text = selected || "text";
  view.dispatch({
    changes: { from, to, insert: `[${text}](url)` },
    selection: { anchor: from + text.length + 3, head: from + text.length + 6 },
  });
  return true;
}

export function insertImage(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const alt = selected || "alt";
  view.dispatch({
    changes: { from, to, insert: `![${alt}](url)` },
    selection: { anchor: from + alt.length + 4, head: from + alt.length + 7 },
  });
  return true;
}

export function insertImageUrl(
  view: EditorView,
  url: string,
  alt = "image",
): void {
  const { from, to } = view.state.selection.main;
  const insert = `![${alt}](${url})`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
}

export function insertTable(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  const table = "| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |";
  view.dispatch({
    changes: { from, to, insert: table },
  });
  return true;
}
