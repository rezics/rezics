import { describe, expect, test } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { toggleBold, toggleItalic, toggleCode } from './commands';

// Use a minimal mock that captures dispatches without needing DOM
function runCommand(
  doc: string,
  from: number,
  to: number | undefined,
  command: (view: any) => boolean,
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
