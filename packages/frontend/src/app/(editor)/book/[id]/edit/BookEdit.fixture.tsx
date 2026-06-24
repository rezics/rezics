"use client";

import type { ReactNode } from "react";
import { EditBookEditor } from "./page";

const longTitle =
  "The Art of Computer Programming, Volume 4B: Combinatorial Algorithms, Part 2 / 计算机程序设计艺术第四卷 B";
const description =
  "这是一段预填图书描述，用于模拟编辑已有 metadata 的状态。它包含中英文标题、ISBN、封面上传区和富文本描述，重点检查表单在移动端、宽屏以及编辑器已有内容时的布局稳定性。";
const tallDescription = Array.from(
  { length: 18 },
  (_, index) =>
    `描述段落 ${index + 1}：用于制造超高图书描述内容，检查编辑器和按钮在长页面中的表现。`,
).join("\n\n");

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export default {
  Empty: (
    <Frame>
      <EditBookEditor />
    </Frame>
  ),
  PrefilledMetadata: (
    <Frame>
      <EditBookEditor
        initialDescription={description}
        initialIsbn="978-0-201-03806-4"
        initialTitle={longTitle}
      />
    </Frame>
  ),
  TallDescription: (
    <Frame>
      <EditBookEditor
        initialDescription={tallDescription}
        initialIsbn="978-0-201-03806-4"
        initialTitle={longTitle}
      />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <EditBookEditor
        initialDescription={description}
        initialIsbn="978-0-201-03806-4"
        initialTitle={longTitle}
      />
    </div>
  ),
};
