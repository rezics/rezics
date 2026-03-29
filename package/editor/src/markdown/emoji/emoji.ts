import {
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import type { ReactNode } from 'react';

export interface EmojiConfig {
  renderPicker: (
    onSelect: (emoji: string) => void,
    onClose: () => void,
  ) => ReactNode;
}

const toggleEmojiPicker = StateEffect.define<boolean>();

const emojiPickerOpen = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleEmojiPicker)) {
        return effect.value;
      }
    }
    return value;
  },
});

export function insertEmoji(view: EditorView, emoji: string) {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: emoji },
    selection: { anchor: from + emoji.length },
  });
  view.focus();
}

export function openEmojiPicker(view: EditorView) {
  view.dispatch({ effects: toggleEmojiPicker.of(true) });
}

export function closeEmojiPicker(view: EditorView) {
  view.dispatch({ effects: toggleEmojiPicker.of(false) });
}

export function isEmojiPickerOpen(view: EditorView): boolean {
  return view.state.field(emojiPickerOpen);
}

function closeOnScroll(): Extension {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (update.viewportChanged && update.state.field(emojiPickerOpen)) {
          update.view.dispatch({
            effects: toggleEmojiPicker.of(false),
          });
        }
      }
    },
  );
}

export function emojiExtension(): Extension {
  return [emojiPickerOpen, closeOnScroll()];
}
