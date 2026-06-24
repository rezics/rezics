"use client";
import type { ReactNode } from "react";
import { NewExcerptEditor } from "./page";

const longSearch =
  "The Art of Computer Programming, Volume 4B / 计算机程序设计艺术第四卷 B";
const longChapter =
  "Chapter 7.2.2.1: Dancing Links 与精确覆盖问题，一个很长的章节路径";
const longPassage =
  "Programs must be written for people to read, and only incidentally for machines to execute. 这段摘录故意加长，用来模拟用户粘贴跨语言引用、章节信息和批注时的 textarea 高度与宽度压力。";
const notes =
  "批注：这条摘录会被放进书籍详情、个人书架和 realm 讨论中，因此编辑器需要承受较长上下文。";
const tallNotes = Array.from(
  { length: 14 },
  (_, index) =>
    `批注段落 ${index + 1}：用于制造超高内容，检查编辑器容器和保存按钮的相对位置。`,
).join("\n\n");

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export default {
  Empty: (
    <Frame>
      <NewExcerptEditor />
    </Frame>
  ),
  PrefilledLongPassage: (
    <Frame>
      <NewExcerptEditor
        initialChapter={longChapter}
        initialNotes={notes}
        initialPassage={longPassage}
        initialSearch={longSearch}
      />
    </Frame>
  ),
  TallNotes: (
    <Frame>
      <NewExcerptEditor
        initialChapter={longChapter}
        initialNotes={tallNotes}
        initialPassage={longPassage}
        initialSearch={longSearch}
      />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <NewExcerptEditor
        initialChapter={longChapter}
        initialNotes={notes}
        initialPassage={longPassage}
        initialSearch={longSearch}
      />
    </div>
  ),
};
