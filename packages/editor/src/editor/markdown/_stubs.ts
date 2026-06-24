import type { EmojiConfig } from "../../markdown/emoji/emoji";
import type { MentionConfig, MentionItem } from "../../markdown/mention/types";

const mentionItems: MentionItem[] = [
  { id: "1", label: "Alice Johnson" },
  { id: "2", label: "Bob Smith" },
  { id: "3", label: "Carol Williams" },
  { id: "4", label: "David Brown" },
];

export const stubMentionConfig: MentionConfig = {
  source: async (query: string) =>
    mentionItems.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase()),
    ),
};

export const stubEmojiConfig: EmojiConfig = {
  renderPicker: (onSelect, onClose) => {
    const emojis = ["😀", "👍", "❤️", "🎉", "🔥"];
    // Minimal inline picker for fixture demonstration
    // 用于 fixture 演示的极简内联选择器
    const container = document.createElement("div");
    container.style.cssText =
      "display:flex;gap:4px;padding:8px;background:#fff;border:1px solid #ddd;border-radius:6px;";
    for (const emoji of emojis) {
      const btn = document.createElement("button");
      btn.textContent = emoji;
      btn.style.cssText =
        "font-size:20px;cursor:pointer;border:none;background:none;";
      btn.onclick = () => {
        onSelect(emoji);
        onClose();
      };
      container.appendChild(btn);
    }
    return null; // React-rendered; the DOM approach is just for reference — 由 React 渲染；上述 DOM 方式仅作参考
  },
};
