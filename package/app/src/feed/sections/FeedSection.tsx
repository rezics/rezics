import {
  type FeedPostRow,
  type FeedQuery,
  type FeedRow,
  feedRowsInfiniteQuery,
} from "@rezics/api/feed/feed";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core";
import { FeedRenderer } from "../components/FeedRenderer";

interface FeedSectionProps {
  query?: FeedQuery;
  enabled?: boolean;
  emptyTitle?: string;
  renderPostRow?: (row: FeedPostRow) => React.ReactNode;
}

export interface FeedSectionContentProps {
  rows: FeedRow[];
  loading?: boolean;
  emptyTitle?: string;
  renderPostRow?: (row: FeedPostRow) => React.ReactNode;
  error: Error | null;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage?: boolean;
  refetch: () => unknown;
  fetchNextPage: () => unknown;
}

export function useFeedRows(
  query?: FeedQuery,
  options: { enabled?: boolean } = {},
) {
  const feedQuery = useInfiniteQuery({
    ...feedRowsInfiniteQuery(query),
    enabled: options.enabled ?? true,
  });
  const rows = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [feedQuery.data],
  );

  return { ...feedQuery, rows };
}

/**
 * Feed section content：共享信息流主体、错误恢复、加载状态和手动分页。
 * 调用方负责提供 rows/query state；本组件只负责稳定的 feed chrome。
 *
 * Mobile
 * +----------------+
 * | Post 1         |
 * | Post 2         |
 * | [Load More]    |
 * +----------------+
 *
 * Tablet
 * +----------------------+
 * | Feed rows            |
 * | - Post 1             |
 * | - Post 2             |
 * | [Load More / Loading]|
 * +----------------------+
 *
 * Desktop
 * +------------------------------------+
 * | Feed rows (FeedRenderer)           |
 * | - Post 1                           |
 * | - Post 2                           |
 * | - Post 3                           |
 * | [Load More] or [End of List]       |
 * +------------------------------------+
 * Ultra-wide
 * +------------------------------------+
 * | Width inherited from parent layout |
 * +------------------------------------+
 */
export const FeedSectionContent: React.FC<FeedSectionContentProps> = ({
  rows,
  loading = false,
  emptyTitle,
  renderPostRow,
  error,
  isError,
  isFetchingNextPage,
  hasNextPage,
  refetch,
  fetchNextPage,
}) => {
  const { t } = useTranslation(["common"]);

  if (isError && rows.length === 0) return <QueryErrorDisplay error={error} />;

  return (
    <div className="space-y-4">
      <FeedRenderer
        rows={rows}
        loading={loading}
        emptyTitle={emptyTitle}
        renderPostRow={renderPostRow}
      />
      {isError && rows.length > 0 ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
          >
            {t("common:retry")}
          </Button>
        </div>
      ) : null}
      {!loading && !isError && hasNextPage ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                {t("common:loading")}
              </span>
            ) : (
              t("common:load_more")
            )}
          </Button>
        </div>
      ) : null}
      {!loading && !isError && rows.length > 0 && !hasNextPage ? (
        <p className="text-center text-xs leading-dense text-text-tertiary">
          {t("common:end_of_list")}
        </p>
      ) : null}
    </div>
  );
};

/**
 * Infinite-scrolling feed section that loads and displays paginated content rows.
 * 支持无限滚动的信息流区域；查询、reaction hydration、分页与错误恢复由
 * 共享 feed 管线处理，调用方只提供 query 与可选行渲染覆盖。
 *
 * Mobile
 * +----------------+
 * | Post 1         |
 * | Post 2         |
 * | [Load More]    |
 * +----------------+
 *
 * Tablet
 * +----------------------+
 * | Feed rows            |
 * | - Post 1             |
 * | - Post 2             |
 * | [Load More / Loading]|
 * +----------------------+
 *
 * Desktop
 * +------------------------------------+
 * | Feed rows (FeedRenderer)           |
 * | - Post 1                           |
 * | - Post 2                           |
 * | - Post 3                           |
 * | [Load More] or [End of List]       |
 * +------------------------------------+
 *
 * Ultra-wide
 * +------------------------------------+
 * | Width inherited from parent layout |
 * +------------------------------------+
 */
export const FeedSection: React.FC<FeedSectionProps> = ({
  query,
  enabled = true,
  emptyTitle,
  renderPostRow,
}) => {
  const feedQuery = useFeedRows(query, { enabled });

  return (
    <FeedSectionContent
      rows={feedQuery.rows}
      loading={feedQuery.isLoading}
      emptyTitle={emptyTitle}
      renderPostRow={renderPostRow}
      error={feedQuery.error}
      isError={feedQuery.isError}
      isFetchingNextPage={feedQuery.isFetchingNextPage}
      hasNextPage={feedQuery.hasNextPage}
      refetch={feedQuery.refetch}
      fetchNextPage={feedQuery.fetchNextPage}
    />
  );
};
