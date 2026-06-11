import type { FeedPostRow, FeedRow } from "@rezics/api/feed/feed";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import { Skeleton } from "@rezics/ui/shadcn";
import type React from "react";
import { FeedBookCard } from "./FeedBookCard";
import { FeedPostRowCard } from "./FeedPostRowCard";
import { FeedShelfCard } from "./FeedShelfCard";

interface FeedRendererProps {
  rows: FeedRow[];
  loading?: boolean;
  emptyTitle?: string;
  renderPostRow?: (row: FeedPostRow) => React.ReactNode;
}

const FEED_LOADING_ROW_KEYS = [
  "feed-loading-1",
  "feed-loading-2",
  "feed-loading-3",
  "feed-loading-4",
];

function FeedLoadingRows() {
  return (
    <div className="space-y-4">
      {FEED_LOADING_ROW_KEYS.map((key) => (
        <div key={key} className="rounded-md bg-surface-subtle p-4">
          <Skeleton className="mb-3 h-5 w-40" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export const FeedRenderer: React.FC<FeedRendererProps> = ({
  rows,
  loading = false,
  emptyTitle,
  renderPostRow,
}) => {
  const { t } = useTranslation("community");
  const effectiveEmptyTitle = emptyTitle ?? t("feed_empty");

  if (loading) return <FeedLoadingRows />;
  if (rows.length === 0) return <EmptyState title={effectiveEmptyTitle} />;

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        switch (row.type) {
          case "post":
            return renderPostRow ? (
              <div key={row.rowId}>{renderPostRow(row)}</div>
            ) : (
              <FeedPostRowCard key={row.rowId} row={row} />
            );
          case "book":
            return <FeedBookCard key={row.rowId} row={row} />;
          case "shelf":
            return <FeedShelfCard key={row.rowId} row={row} />;
        }
      })}
    </div>
  );
};
