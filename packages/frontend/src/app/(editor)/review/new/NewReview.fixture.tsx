"use client";
import type { ReactNode } from "react";
import { NewReviewEditor } from "./page";

const longSearch =
  "Structure and Interpretation of Computer Programs / 计算机程序的构造和解释";
const longTitle =
  "一次重读 SICP 后关于抽象边界、解释器和社区协作知识沉淀的非常长书评标题";
const reviewContent =
  "这篇书评草稿模拟已经写到一半的状态：前半部分讨论抽象屏障，后半部分讨论语言实现和读书会讨论如何转化为 realm 内的协作知识。";
const tallContent = Array.from(
  { length: 18 },
  (_, index) =>
    `书评段落 ${index + 1}：移动端和矮视口下需要确认编辑器不会挤压标题与评分区域。`,
).join("\n\n");

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export default {
  Empty: (
    <Frame>
      <NewReviewEditor />
    </Frame>
  ),
  PrefilledLongDraft: (
    <Frame>
      <NewReviewEditor
        initialContent={reviewContent}
        initialSearch={longSearch}
        initialTitle={longTitle}
      />
    </Frame>
  ),
  TallEditorContent: (
    <Frame>
      <NewReviewEditor
        initialContent={tallContent}
        initialSearch={longSearch}
        initialTitle={longTitle}
      />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <NewReviewEditor
        initialContent={reviewContent}
        initialSearch={longSearch}
        initialTitle={longTitle}
      />
    </div>
  ),
};
