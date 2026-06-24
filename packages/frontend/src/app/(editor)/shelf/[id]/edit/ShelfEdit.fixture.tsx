"use client";

import type { ReactNode } from "react";
import { EditShelfEditor, type ShelfItem } from "./page";

const longName = "一个名称非常非常非常长的跨语言阅读与游戏研究书架";
const longDescription =
  "这个书架描述用于测试已有书架设置表单：它包含图书、游戏、帖子和摘录的混合收藏说明，并故意写得较长以覆盖 textarea 与操作按钮布局。";
const shelfItems: readonly ShelfItem[] = [
  {
    id: "item-1",
    title: "Structure and Interpretation of Computer Programs",
  },
  {
    id: "item-2",
    title:
      "一个条目标题非常非常非常长的作品用于测试拖拽手柄、标题截断和删除按钮固定宽度",
  },
  {
    id: "item-3",
    title: "Baba Is You",
  },
];

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export default {
  EmptyShelf: (
    <Frame>
      <EditShelfEditor />
    </Frame>
  ),
  PrefilledWithItems: (
    <Frame>
      <EditShelfEditor
        initialDescription={longDescription}
        initialItems={shelfItems}
        initialName={longName}
      />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <EditShelfEditor
        initialDescription={longDescription}
        initialItems={shelfItems}
        initialName={longName}
      />
    </div>
  ),
};
