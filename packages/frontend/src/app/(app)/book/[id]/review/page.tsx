"use client";

import { PAGE_SIZE, postListQuery, type PostListArgs } from "@/atoms/posts";
import { ClientOnly } from "@/components/ClientOnly";
import { PostCard } from "@/components/post/PostCard";
import { SectionBoundary } from "@/components/SectionBoundary";
import { PagedList } from "@/components/shared/PagedList";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import { StarIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useState, type ComponentProps } from "react";

type BookReviewPost = ComponentProps<typeof PostCard>["post"];

export function BookReviewListView({
  items,
  total,
  offset,
  onLoadMore,
}: {
  readonly items: readonly BookReviewPost[];
  readonly total: number;
  readonly offset: number;
  readonly onLoadMore: () => void;
}) {
  const [t] = useT();
  const hasMore = offset + PAGE_SIZE < total;

  if (items.length === 0 && offset === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <StarIcon className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm">{t.book.emptyReviews}</p>
        <p className="text-muted-foreground text-xs">{t.book.emptyReviewsHint}</p>
      </div>
    );
  }

  return (
    <PagedList
      emptyMessage={t.book.emptyReviews}
      hasMore={hasMore}
      items={items}
      onLoadMore={onLoadMore}
      renderItem={(post) => <PostCard key={post.unitId} post={post} />}
    />
  );
}

function ReviewListInner({ bookId }: { readonly bookId: string }) {
  const [offset, setOffset] = useState(0);

  const args: PostListArgs = {
    parentUnitId: bookId,
    kind: "review",
    limit: PAGE_SIZE,
    offset,
  };

  const result = useAtomSuspense(postListQuery(args));
  const { items, total } = result.value;

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  return (
    <BookReviewListView
      items={items}
      offset={offset}
      onLoadMore={handleLoadMore}
      total={total}
    />
  );
}

/**
 * Book reviews page showing all reviews for this book.
 * 书评页面，展示该书的所有评论。
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
 * 空状态：居中星形图标 + 提示文字 + 鼓励语。
 * 分页由 PagedList 承担。使用 parentUnitId + kind=review 过滤该书的书评。
 */
export default function BookReviewPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="py-4">
      <ClientOnly>
        <SectionBoundary>
          <ReviewListInner bookId={id} />
        </SectionBoundary>
      </ClientOnly>
    </div>
  );
}
