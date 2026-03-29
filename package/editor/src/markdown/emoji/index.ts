import type { EditorPlugin } from '../../core/types';
import type { ToolbarItem } from '../../toolbar/types';
import {
  emojiExtension,
  openEmojiPicker,
  type EmojiConfig,
} from './emoji';

const emojiToolbarItems: ToolbarItem[] = [
  {
    name: 'emoji',
    label: 'Emoji',
    action: (view) => openEmojiPicker(view),
  },
];

export function emoji(_config: EmojiConfig): EditorPlugin {
  return {
    name: 'emoji',
    extensions: emojiExtension(),
    toolbar: emojiToolbarItems,
  };
}

export {
  insertEmoji,
  openEmojiPicker,
  closeEmojiPicker,
  isEmojiPickerOpen,
} from './emoji';
export type { EmojiConfig } from './emoji';
