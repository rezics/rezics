"use client";

import { PAGE_SIZE, postListQuery, type PostListArgs } from "@/atoms/posts";
import { PostCard } from "@/components/post/PostCard";
import { PagedList } from "@/components/shared/PagedList";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import { useCallback, useState } from "react";

interface PostFeedPost {
  readonly unitId: string;
  readonly title: string | null;
  readonly summary: string | null;
  readonly authorUserId: string;
  readonly replyCount: number;
  readonly isLocked: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

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

interface PostFeedViewProps {
  readonly posts: readonly PostFeedPost[];
  readonly hasMore: boolean;
  readonly hideRealm?: boolean;
  readonly emptyMessage: string;
  readonly onLoadMore?: () => void;
}

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | [PostCard]                    |
 * | [PostCard]                    |
 * | [PostCard]                    |
 * |       [Load more]             |
 * +-------------------------------+
 * w-full, single column. Cards separated by divide-y border.
 *
 * Tablet (640-1023px):
 * +---------------------------------------+
 * | [PostCard]                            |
 * | [PostCard]                            |
 * | [PostCard]                            |
 * |           [Load more]                 |
 * +---------------------------------------+
 * Same structure, wider cards from parent constraint.
 *
 * Desktop (1024-1535px):
 * +--------------------------------------------------+
 * | [PostCard]                                       |
 * | [PostCard]                                       |
 * | [PostCard]                                       |
 * |               [Load more]                        |
 * +--------------------------------------------------+
 * Same structure. Parent caps max-w.
 *
 * Ultra-wide (>=1536px):
 * +------------------------------------------------------------+
 * | [PostCard]                                                 |
 * | [PostCard]                                                 |
 * | [PostCard]                                                 |
 * |                   [Load more]                              |
 * +------------------------------------------------------------+
 * Same structure. Parent caps max-w.
 *
 * 单列竖向帖子卡片列表（divide-y），所有断点布局一致。
 * 分页由 PagedList 承担：末页满载时显示"加载更多"（居中），
 * 追加页在 transition 中加载，旧内容保持可见。
 * 边界：0 条 -> emptyMessage。hideRealm 由 PostCard 接收，用于上下文页。
 */
export function PostFeedView({
  posts,
  hasMore,
  hideRealm,
  emptyMessage,
  onLoadMore,
}: PostFeedViewProps) {
  return (
    <PagedList
      emptyMessage={emptyMessage}
      hasMore={hasMore}
      items={posts}
      onLoadMore={onLoadMore ?? (() => {})}
      renderItem={(post) => (
        <PostCard key={post.unitId} hideRealm={hideRealm} post={post} />
      )}
    />
  );
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
    <PostFeedView
      emptyMessage={t.post.empty}
      hasMore={hasMore}
      hideRealm={hideRealm}
      onLoadMore={handleLoadMore}
      posts={items}
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
 * 查询容器，仅负责按 realm/author 读取分页帖子并交给 PostFeedView 渲染。
 * 布局与边界说明见 PostFeedView。
 */
export function PostFeed(props: PostFeedProps) {
  return (
    <SectionBoundary>
      <PostFeedInner {...props} />
    </SectionBoundary>
  );
}
