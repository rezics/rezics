import type { EditorPlugin } from "../../core/types";
import { mentionExtension } from "./mention";
import type { MentionConfig } from "./types";

export function mention(config: MentionConfig): EditorPlugin {
  return {
    name: "mention",
    extensions: mentionExtension(config),
  };
}

export type { MentionConfig, MentionItem } from "./types";
