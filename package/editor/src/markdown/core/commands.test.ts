import { describe, expect, test } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { toggleBold, toggleItalic, toggleCode, insertImageUrl } from './commands';

// Use a minimal mock that captures dispatches without needing DOM
function runCommand(
  doc: string,
  from: number,
  to: number | undefined,
  command: (view: any) => boolean | void,
) {
  const state = EditorState.create({
    doc,
    selection: { anchor: from, head: to ?? from },
  });

  let result = state;
  const fakeView = {
    state,
    dispatch(tr: any) {
      result = state.update(tr).state;
      fakeView.state = result;
    },
  };

  command(fakeView);
  return {
    text: result.doc.toString(),
    head: result.selection.main.head,
  };
}

describe('toggleBold', () => {
  test('wraps selection with **', () => {
    const { text } = runCommand('hello', 0, 5, toggleBold);
    expect(text).toBe('**hello**');
  });

  test('unwraps **-wrapped selection', () => {
    const { text } = runCommand('**hello**', 0, 9, toggleBold);
    expect(text).toBe('hello');
  });

  test('inserts **** with cursor between when no selection', () => {
    const { text, head } = runCommand('hello', 2, undefined, toggleBold);
    expect(text).toBe('he****llo');
    expect(head).toBe(4);
  });

  test('unwraps when cursor is between surrounding markers', () => {
    const { text } = runCommand('**hello**', 2, 7, toggleBold);
    expect(text).toBe('hello');
  });
});

describe('toggleItalic', () => {
  test('wraps selection with *', () => {
    const { text } = runCommand('hello', 0, 5, toggleItalic);
    expect(text).toBe('*hello*');
  });

  test('unwraps *-wrapped selection', () => {
    const { text } = runCommand('*hello*', 0, 7, toggleItalic);
    expect(text).toBe('hello');
  });
});

describe('insertImageUrl', () => {
  test('inserts image with URL and alt text', () => {
    const { text, head } = runCommand('hello', 5, undefined, (view) =>
      insertImageUrl(view, 'https://example.com/img.png', 'photo'),
    );
    expect(text).toBe('hello![photo](https://example.com/img.png)');
    expect(head).toBe('hello![photo](https://example.com/img.png)'.length);
  });

  test('defaults alt to "image" when not provided', () => {
    const { text } = runCommand('', 0, undefined, (view) =>
      insertImageUrl(view, 'https://example.com/img.png'),
    );
    expect(text).toBe('![image](https://example.com/img.png)');
  });

  test('replaces selected text', () => {
    const { text, head } = runCommand('replace me', 0, 10, (view) =>
      insertImageUrl(view, 'https://example.com/img.png', 'photo'),
    );
    expect(text).toBe('![photo](https://example.com/img.png)');
    expect(head).toBe('![photo](https://example.com/img.png)'.length);
  });

  test('inserts at cursor position in middle of text', () => {
    const { text } = runCommand('before after', 7, undefined, (view) =>
      insertImageUrl(view, 'https://example.com/img.png'),
    );
    expect(text).toBe('before ![image](https://example.com/img.png)after');
  });
});

describe('toggleCode', () => {
  test('wraps selection with backtick', () => {
    const { text } = runCommand('hello', 0, 5, toggleCode);
    expect(text).toBe('`hello`');
  });

  test('inserts empty backticks when no selection', () => {
    const { text, head } = runCommand('hello', 2, undefined, toggleCode);
    expect(text).toBe('he``llo');
    expect(head).toBe(3);
  });
});
