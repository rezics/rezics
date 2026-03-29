import { describe, expect, test } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { insertEmoji } from './emoji';

function runInsert(doc: string, from: number, to: number | undefined, emoji: string) {
  const state = EditorState.create({
    doc,
    selection: { anchor: from, head: to ?? from },
  });

  let result = state;
  const fakeView = {
    state,
    focus() {},
    dispatch(tr: any) {
      result = state.update(tr).state;
      fakeView.state = result;
    },
  };

  insertEmoji(fakeView as any, emoji);
  return {
    text: result.doc.toString(),
    head: result.selection.main.head,
  };
}

describe('emoji insertion', () => {
  test('inserts emoji at cursor', () => {
    const { text } = runInsert('hello world', 5, undefined, '😀');
    expect(text).toBe('hello😀 world');
  });

  test('replaces selection with emoji', () => {
    const { text } = runInsert('hello world', 0, 5, '🎉');
    expect(text).toBe('🎉 world');
  });

  test('cursor advances past inserted emoji', () => {
    const { head } = runInsert('test', 2, undefined, '✨');
    expect(head).toBe(2 + '✨'.length);
  });
});
