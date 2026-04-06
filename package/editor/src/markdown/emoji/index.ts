import type { EditorPlugin } from "../../core/types";
import type { ToolbarItem } from "../../toolbar/types";
import { type EmojiConfig, emojiExtension, openEmojiPicker } from "./emoji";

const emojiToolbarItems: ToolbarItem[] = [
  {
    name: "emoji",
    label: "Emoji",
    action: (view) => openEmojiPicker(view),
  },
];

export function emoji(_config: EmojiConfig): EditorPlugin {
  return {
    name: "emoji",
    extensions: emojiExtension(),
    toolbar: emojiToolbarItems,
  };
}

export type { EmojiConfig } from "./emoji";
export {
  closeEmojiPicker,
  insertEmoji,
  isEmojiPickerOpen,
  openEmojiPicker,
} from "./emoji";
