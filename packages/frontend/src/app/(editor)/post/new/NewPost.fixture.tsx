"use client";
import type { ReactNode } from "react";
import { NewPostEditor } from "./page";

const longTitle =
  "为什么跨语言作品目录需要把书籍、游戏、帖子、书架和 realm 讨论统一建模为 Unit：一个非常长的发帖标题";
const longContent =
  "第一段：这个帖子正文预填了较长内容，用于测试 Portable Text 编辑器在已有草稿、移动端窄宽度和发布按钮同屏时的布局。\n\n第二段：内容继续增长，模拟用户从外部笔记粘贴来的草稿。这里保留多段文本，让编辑器容器产生更真实的高度压力。";
const tallContent = Array.from(
  { length: 16 },
  (_, index) => `段落 ${index + 1}：用于制造超高编辑器内容的草稿正文。`,
).join("\n\n");

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export default {
  Empty: (
    <Frame>
      <NewPostEditor />
    </Frame>
  ),
  PrefilledLongDraft: (
    <Frame>
      <NewPostEditor initialContent={longContent} initialTitle={longTitle} />
    </Frame>
  ),
  TallEditorContent: (
    <Frame>
      <NewPostEditor initialContent={tallContent} initialTitle={longTitle} />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <NewPostEditor initialContent={longContent} initialTitle={longTitle} />
    </div>
  ),
};
