import {
  type FeedPostRow,
  type FeedQuery,
  feedRowsInfiniteQuery,
} from "@rezics/api/feed/feed";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { FeedRenderer } from "../components/FeedRenderer";

interface FeedSectionProps {
  query?: FeedQuery;
  emptyTitle?: string;
  renderPostRow?: (row: FeedPostRow) => React.ReactNode;
}

/**
 * Infinite-scrolling feed section that loads and displays paginated content rows.
 * 支持无限滚动的馈送区域，加载和显示分页内容行。
 *
 * Renders a feed with optional error recovery, loading states, and manual pagination.
 * 呈现具有可选错误恢复、加载状态和手动分页的馈送。
 *
 * Desktop (md+):
 * ┌────────────────────────────────────┐
 * │ Feed rows (FeedRenderer)           │
 * │ - Post 1                           │
 * │ - Post 2                           │
 * │ - Post 3                           │
 * │ [Load More]  or  [End of List]     │
 * └────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────┐
 * │ Feed rows            │
 * │ - Post 1             │
 * │ - Post 2             │
 * │ [Load More / Loading]│
 * └──────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌────────────────┐
 * │ Post 1         │
 * │ Post 2         │
 * │ [Load More]    │
 * └────────────────┘
 *
 * Error state (compact):
 * ┌────────────────────────────────────┐
 * │ [Error Message] [Retry]            │
 * │ Posts still visible if partial     │
 * └────────────────────────────────────┘
 */
export const FeedSection: React.FC<FeedSectionProps> = ({
  query,
  emptyTitle,
  renderPostRow,
}) => {
  const { t } = useTranslation(["common"]);
  const {
    data,
    error,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery(feedRowsInfiniteQuery(query));
  const rows = data?.pages.flatMap((page) => page.rows) ?? [];

  if (isError && rows.length === 0) return <QueryErrorDisplay error={error} />;

  return (
    <div className="space-y-4">
      <FeedRenderer
        rows={rows}
        loading={isLoading}
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
      {!isLoading && !isError && hasNextPage ? (
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
      {!isLoading && !isError && rows.length > 0 && !hasNextPage ? (
        <p className="text-center text-xs leading-dense text-text-tertiary">
          {t("common:end_of_list")}
        </p>
      ) : null}
    </div>
  );
};
