"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { PostFeed } from "@/components/post/PostFeed";
import { useParams } from "next/navigation";

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | [PostCard]                    |
 * | [PostCard]                    |
 * | [PostCard]                    |
 * |       [Load more]            |
 * +-------------------------------+
 * w-full, single column. Cards separated by divide-y.
 *
 * Tablet (640-1023px):
 * +---------------------------------------+
 * | [PostCard]                            |
 * | [PostCard]                            |
 * |           [Load more]                |
 * +---------------------------------------+
 * Same structure, wider from parent layout.
 *
 * Desktop (1024-1535px):
 * +--------------------------------------------------+
 * | [PostCard]                                       |
 * | [PostCard]                                       |
 * |               [Load more]                       |
 * +--------------------------------------------------+
 * Same structure. Parent layout caps max-w.
 *
 * Ultra-wide (>=1536px):
 * +------------------------------------------------------------+
 * | [PostCard]                                                 |
 * | [PostCard]                                                 |
 * |                   [Load more]                             |
 * +------------------------------------------------------------+
 * Same structure. Parent layout caps max-w.
 *
 * 用户帖子列表页。按 authorUserId 过滤的 PostFeed，
 * 复用现有分页逻辑。所有断点布局一致。
 * 窄端：卡片 w-full 填满父级。宽端：父级 max-w 封顶。
 * 边界：0 条 -> emptyMessage（由 PostFeed 处理）。
 * 用户上下文由 layout 确立，卡片不显示作者名。
 */
export default function UserPostsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ClientOnly>
      <PostFeed authorUserId={id} />
    </ClientOnly>
  );
}
