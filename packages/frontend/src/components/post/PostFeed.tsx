"use client";

import { PAGE_SIZE, postListQuery, type PostListArgs } from "@/atoms/posts";
import { PostCard } from "@/components/post/PostCard";
import { PagedList } from "@/components/shared/PagedList";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import { useCallback, useState } from "react";

interface PostFeedProps {
  /** Filter posts to a specific realm; omit for global feed.
   *  按 realm 过滤帖子；省略则显示全局 feed。 */
  readonly realmUnitId?: string;
  /** Filter posts to a specific author.
   *  按作者过滤帖子。 */
  readonly authorUserId?: string;
  /** Hide realm name in cards — used inside realm detail pages
   *  where context already establishes the realm.
   *  隐藏卡片中的 realm 名称——用于 realm 详情页上下文已确立 realm 的场景。 */
  readonly hideRealm?: boolean;
}

function PostFeedInner({ realmUnitId, authorUserId, hideRealm }: PostFeedProps) {
  const [t] = useT();
  const [offset, setOffset] = useState(0);

  const args: PostListArgs = {
    realmUnitId,
    authorUserId,
    limit: PAGE_SIZE,
    offset,
  };

  const result = useAtomSuspense(postListQuery(args));
  const { items, total } = result.value;
  const hasMore = offset + PAGE_SIZE < total;

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  return (
    <PagedList
      items={items}
      renderItem={(post) => (
        <PostCard key={post.unitId} hideRealm={hideRealm} post={post} />
      )}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      emptyMessage={t.post.empty}
    />
  );
}

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | [PostCard]                    |
 * | [PostCard]                    |
 * | [PostCard]                    |
 * |       [Load more]            |
 * +-------------------------------+
 * w-full, single column. Cards separated by divide-y border.
 *
 * Tablet (640-1023px):
 * +---------------------------------------+
 * | [PostCard]                            |
 * | [PostCard]                            |
 * | [PostCard]                            |
 * |           [Load more]                |
 * +---------------------------------------+
 * Same structure, wider cards from parent constraint.
 *
 * Desktop (1024-1535px):
 * +--------------------------------------------------+
 * | [PostCard]                                       |
 * | [PostCard]                                       |
 * | [PostCard]                                       |
 * |               [Load more]                       |
 * +--------------------------------------------------+
 * Same structure. Parent caps max-w.
 *
 * Ultra-wide (>=1536px):
 * +------------------------------------------------------------+
 * | [PostCard]                                                 |
 * | [PostCard]                                                 |
 * | [PostCard]                                                 |
 * |                   [Load more]                             |
 * +------------------------------------------------------------+
 * Same structure. Parent caps max-w.
 *
 * 单列竖向帖子卡片列表（divide-y），所有断点布局一致。
 * 分页由 PagedList 承担：末页满载时显示"加载更多"（居中），
 * 追加页在 transition 中加载，旧内容保持可见。
 * 边界：0 条 -> emptyMessage。realmUnitId 过滤时仅显示该 realm 帖子。
 */
export function PostFeed(props: PostFeedProps) {
  return (
    <SectionBoundary>
      <PostFeedInner {...props} />
    </SectionBoundary>
  );
}
