import {
  type StreamPostRow,
  type StreamQuery,
  type StreamRow,
  streamRowsInfiniteQuery,
} from "@rezics/api/stream/stream";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core";
import { LoadMoreFooter } from "@/shared/ui/LoadMoreFooter";
import { StreamRenderer } from "../components/StreamRenderer";

interface StreamSectionProps {
  query?: StreamQuery;
  enabled?: boolean;
  emptyTitle?: string;
  renderPostRow?: (row: StreamPostRow) => React.ReactNode;
}

export interface StreamSectionContentProps {
  rows: StreamRow[];
  loading?: boolean;
  emptyTitle?: string;
  renderPostRow?: (row: StreamPostRow) => React.ReactNode;
  error: Error | null;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage?: boolean;
  refetch: () => unknown;
  fetchNextPage: () => unknown;
}

export function useStreamRows(
  query?: StreamQuery,
  options: { enabled?: boolean } = {},
) {
  const streamQuery = useInfiniteQuery({
    ...streamRowsInfiniteQuery(query),
    enabled: options.enabled ?? true,
  });
  const rows = useMemo(
    () => streamQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [streamQuery.data],
  );

  return { ...streamQuery, rows };
}

/**
 * Stream section content：共享信息流主体、错误恢复、加载状态和手动分页。
 * 调用方负责提供 rows/query state；本组件只负责稳定的 stream chrome。
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
 * | Stream rows            |
 * | - Post 1             |
 * | - Post 2             |
 * | [Load More / Loading]|
 * +----------------------+
 *
 * Desktop
 * +------------------------------------+
 * | Stream rows (StreamRenderer)           |
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
export const StreamSectionContent: React.FC<StreamSectionContentProps> = ({
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
      <StreamRenderer
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
      {!loading && !isError && rows.length > 0 && (
        <LoadMoreFooter
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          showEndOfList
        />
      )}
    </div>
  );
};

/**
 * Infinite-scrolling stream section that loads and displays paginated content rows.
 * 支持无限滚动的信息流区域；查询、reaction hydration、分页与错误恢复由
 * 共享 stream 管线处理，调用方只提供 query 与可选行渲染覆盖。
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
 * | Stream rows            |
 * | - Post 1             |
 * | - Post 2             |
 * | [Load More / Loading]|
 * +----------------------+
 *
 * Desktop
 * +------------------------------------+
 * | Stream rows (StreamRenderer)           |
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
export const StreamSection: React.FC<StreamSectionProps> = ({
  query,
  enabled = true,
  emptyTitle,
  renderPostRow,
}) => {
  const streamQuery = useStreamRows(query, { enabled });

  return (
    <StreamSectionContent
      rows={streamQuery.rows}
      loading={streamQuery.isLoading}
      emptyTitle={emptyTitle}
      renderPostRow={renderPostRow}
      error={streamQuery.error}
      isError={streamQuery.isError}
      isFetchingNextPage={streamQuery.isFetchingNextPage}
      hasNextPage={streamQuery.hasNextPage}
      refetch={streamQuery.refetch}
      fetchNextPage={streamQuery.fetchNextPage}
    />
  );
};
