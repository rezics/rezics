"use client";

import { PAGE_SIZE, postListQuery, type PostListArgs } from "@/atoms/posts";
import { ClientOnly } from "@/components/ClientOnly";
import { PostCard } from "@/components/post/PostCard";
import { SectionBoundary } from "@/components/SectionBoundary";
import { PagedList } from "@/components/shared/PagedList";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import { MessageSquareIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useState, type ComponentProps } from "react";

type BookDiscussionPost = ComponentProps<typeof PostCard>["post"];

export function BookDiscussionListView({
  items,
  total,
  offset,
  onLoadMore,
}: {
  readonly items: readonly BookDiscussionPost[];
  readonly total: number;
  readonly offset: number;
  readonly onLoadMore: () => void;
}) {
  const [t] = useT();
  const hasMore = offset + PAGE_SIZE < total;

  if (items.length === 0 && offset === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <MessageSquareIcon className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm">{t.book.emptyDiscussion}</p>
        <p className="text-muted-foreground text-xs">{t.book.emptyDiscussionHint}</p>
      </div>
    );
  }

  return (
    <PagedList
      emptyMessage={t.book.emptyDiscussion}
      hasMore={hasMore}
      items={items}
      onLoadMore={onLoadMore}
      renderItem={(post) => <PostCard key={post.unitId} post={post} />}
    />
  );
}

function DiscussionListInner({ bookId }: { readonly bookId: string }) {
  const [offset, setOffset] = useState(0);

  const args: PostListArgs = {
    parentUnitId: bookId,
    kind: "discussion",
    limit: PAGE_SIZE,
    offset,
  };

  const result = useAtomSuspense(postListQuery(args));
  const { items, total } = result.value;

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  return (
    <BookDiscussionListView
      items={items}
      offset={offset}
      onLoadMore={handleLoadMore}
      total={total}
    />
  );
}

/**
 * Book discussion page showing discussion threads for this book.
 * 书籍讨论页面，展示该书的讨论帖子列表。
 *
 * ```
 * Mobile (<640px):
 * +----------------------------+
 * | [PostCard              ]   |
 * | [PostCard              ]   |
 * | [PostCard              ]   |
 * |      [Load more]          |
 * +----------------------------+
 * w-full, single column. PostCards separated by divide-y.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [PostCard                         ]  |
 * | [PostCard                         ]  |
 * | [PostCard                         ]  |
 * |           [Load more]               |
 * +--------------------------------------+
 * Same structure, wider cards from parent constraint.
 *
 * Desktop (1024-1535px):
 * +--------------------------------------+
 * | [PostCard                         ]  |
 * | [PostCard                         ]  |
 * |           [Load more]               |
 * +--------------------------------------+
 * Same structure. Parent caps max-w-3xl.
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop. Parent caps max-w-3xl.
 * ```
 *
 * 所有断点布局一致，仅宽度随父容器变化。
 * 空状态：居中图标 + 提示文字 + 鼓励语。
 * 分页由 PagedList 承担。使用 parentUnitId 过滤该书的讨论帖。
 */
export default function BookDiscussionPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="py-4">
      <ClientOnly>
        <SectionBoundary>
          <DiscussionListInner bookId={id} />
        </SectionBoundary>
      </ClientOnly>
    </div>
  );
}
