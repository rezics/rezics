"use client";

import type { ReactNode } from "react";
import { NewEntityEditor } from "./page";

const longName =
  "一个名称非常非常非常长的译者组织与开放知识协作小组用于压测实体名称输入框";
const longSummary =
  "这个实体摘要模拟人物、组织或小组的简介。它会出现在作品归属、贡献者列表和实体详情页中，因此 fixture 需要覆盖长文本、跨语言标点和移动端输入区域。";

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export default {
  EmptyPerson: (
    <Frame>
      <NewEntityEditor />
    </Frame>
  ),
  OrganizationLongText: (
    <Frame>
      <NewEntityEditor
        initialKind="organization"
        initialName={longName}
        initialSummary={longSummary}
      />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <NewEntityEditor
        initialKind="group"
        initialName={longName}
        initialSummary={longSummary}
      />
    </div>
  ),
};
