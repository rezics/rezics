"use client";

import type { ReactNode } from "react";
import { NewRemarkEditor } from "./page";

const longSearch =
  "Crafting Interpreters: 从零构建编程语言以及非常长的副标题用于压测搜索框";
const remarkContent =
  "短评草稿：解释器章节的节奏很好，但最好和 realm 里的实现笔记一起读。";
const tallContent = Array.from(
  { length: 10 },
  (_, index) =>
    `短评段落 ${index + 1}：刻意超过短评常见长度，用于压测编辑器高度。`,
).join("\n\n");

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export default {
  Empty: (
    <Frame>
      <NewRemarkEditor />
    </Frame>
  ),
  Prefilled: (
    <Frame>
      <NewRemarkEditor
        initialContent={remarkContent}
        initialSearch={longSearch}
      />
    </Frame>
  ),
  TallEditorContent: (
    <Frame>
      <NewRemarkEditor
        initialContent={tallContent}
        initialSearch={longSearch}
      />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <NewRemarkEditor
        initialContent={remarkContent}
        initialSearch={longSearch}
      />
    </div>
  ),
};
