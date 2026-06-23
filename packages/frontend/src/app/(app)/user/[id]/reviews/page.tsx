"use client";

import { PAGE_SIZE, postListQuery } from "@/atoms/posts";
import { ClientOnly } from "@/components/ClientOnly";
import { PostCard } from "@/components/post/PostCard";
import { SectionBoundary } from "@/components/SectionBoundary";
import { PagedList } from "@/components/shared/PagedList";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

function UserReviewsInner({ userId }: { readonly userId: string }) {
  const [t] = useT();
  const [offset, setOffset] = useState(0);

  const result = useAtomSuspense(
    postListQuery({
      authorUserId: userId,
      kind: "review",
      limit: PAGE_SIZE,
      offset,
    }),
  );

  const { items, total } = result.value;
  const hasMore = offset + PAGE_SIZE < total;

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  return (
    <PagedList
      items={items}
      renderItem={(post) => <PostCard key={post.unitId} post={post} />}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      emptyMessage={t.user.emptyReviews}
    />
  );
}

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | [PostCard (review)]           |
 * | [PostCard (review)]           |
 * |       [Load more]            |
 * +-------------------------------+
 * w-full, single column. Cards separated by divide-y.
 *
 * Tablet (640-1023px):
 * +---------------------------------------+
 * | [PostCard (review)]                   |
 * | [PostCard (review)]                   |
 * |           [Load more]                |
 * +---------------------------------------+
 * Same structure, wider from parent layout.
 *
 * Desktop (1024-1535px):
 * +--------------------------------------------------+
 * | [PostCard (review)]                              |
 * | [PostCard (review)]                              |
 * |               [Load more]                       |
 * +--------------------------------------------------+
 * Same structure. Parent layout caps max-w.
 *
 * Ultra-wide (>=1536px):
 * +------------------------------------------------------------+
 * | [PostCard (review)]                                        |
 * | [PostCard (review)]                                        |
 * |                   [Load more]                             |
 * +------------------------------------------------------------+
 * Same structure. Parent layout caps max-w.
 *
 * 用户评论列表页。按 authorUserId + kind="review" 过滤的帖子列表。
 * 复用 PostCard 和 PagedList 组件。所有断点布局一致。
 * 窄端：卡片 w-full 填满父级。宽端：父级 max-w 封顶。
 * 边界：0 条 -> emptyReviews 空状态。
 * 用户上下文由 layout 确立，卡片不重复作者名。
 */
export default function UserReviewsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ClientOnly>
      <SectionBoundary>
        <UserReviewsInner userId={id} />
      </SectionBoundary>
    </ClientOnly>
  );
}
