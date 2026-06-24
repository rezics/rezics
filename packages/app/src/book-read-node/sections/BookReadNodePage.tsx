import { useParams } from "@tanstack/react-router";
import type React from "react";
import { BookReadNodeSection } from "./BookReadNodeSection";

/**
 * 书籍阅读节点页面。提取路由参数并渲染内容查看部分。
 * Book read node page. Extracts route params and renders the content viewing section.
 *
 * Mobile:            Tablet:             Desktop:            Ultra-wide:
 * ┌─────────────┐   ┌──────────────────┐ ┌──────────────────┐ ┌────────────────────┐
 * │ [Back] Node │   │ [Back]  Node      │ │ [Back]  Node     │ │ [Back]  Node       │
 * │ Chapter A   │   │ Chapter A         │ │ Chapter A        │ │ Chapter A          │
 * │             │   │                   │ │                  │ │                    │
 * │ Content...  │   │ Content Content   │ │ Content Content  │ │ Content Content    │
 * │             │   │                   │ │                  │ │                    │
 * └─────────────┘   └──────────────────┘ └──────────────────┘ └────────────────────┘
 */
export const BookReadNodePage: React.FC = () => {
  const { bookId, nodeId } = useParams({
    from: "/book_/$bookId/node/$nodeId/",
  });
  return <BookReadNodeSection bookId={bookId} nodeId={nodeId} />;
};
