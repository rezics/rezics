import { describe, expect, test } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { formatJson } from './commands';

function runFormat(doc: string) {
  const state = EditorState.create({ doc });
  let result = state;
  const fakeView = {
    state,
    dispatch(tr: any) {
      result = state.update(tr).state;
      fakeView.state = result;
    },
  };

  formatJson(fakeView as any);
  return result.doc.toString();
}

describe('formatJson', () => {
  test('formats valid JSON with 2-space indentation', () => {
    expect(runFormat('{"a":1,"b":[2,3]}')).toBe(
      JSON.stringify({ a: 1, b: [2, 3] }, null, 2),
    );
  });

  test('does not modify invalid JSON', () => {
    const invalid = '{"a": 1,}';
    expect(runFormat(invalid)).toBe(invalid);
  });

  test('does not modify already-formatted JSON', () => {
    const formatted = JSON.stringify({ key: 'value' }, null, 2);
    expect(runFormat(formatted)).toBe(formatted);
  });
});
