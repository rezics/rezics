"use client";
import type { ReactNode } from "react";
import { EditProfileContent } from "./page";

const longName =
  "一个显示名非常非常非常长的协作者用于测试输入框滚动与移动端宽度";
const longBio =
  "维护跨语言作品目录、社区 realm 分类、书架、标签和讨论的长期协作者。这个 bio 故意写得很长，用于测试 textarea 预填内容、移动端宽度和表单按钮在窄屏下的排列。";

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export default {
  Empty: (
    <Frame>
      <EditProfileContent />
    </Frame>
  ),
  PrefilledLongText: (
    <Frame>
      <EditProfileContent initialBio={longBio} initialName={longName} />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <EditProfileContent initialBio={longBio} initialName={longName} />
    </div>
  ),
};
