import { useReactionHydration } from "@rezics/contract/api/reaction/reaction";
import type { StreamPostRow, StreamRow } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import { Skeleton } from "@rezics/ui/shadcn";
import type React from "react";
import { useMemo } from "react";
import {
  GLOBAL_REACTION_CONTEXT_KEY,
  groupPostReactionTargets,
  type ReactionHydrationGroup,
} from "../models/streamReactionHydration";
import { StreamBookCard } from "./StreamBookCard";
import { StreamPostRowCard } from "./StreamPostRowCard";
import { StreamShelfCard } from "./StreamShelfCard";
import { StreamUnitCard } from "./StreamUnitCard";

interface StreamRendererProps {
  rows: StreamRow[];
  loading?: boolean;
  emptyTitle?: string;
  renderPostRow?: (row: StreamPostRow) => React.ReactNode;
}

const STREAM_LOADING_ROW_KEYS = [
  "stream-loading-1",
  "stream-loading-2",
  "stream-loading-3",
  "stream-loading-4",
];

function StreamReactionHydrationGroup({
  contextUnitId,
  targetIds,
}: ReactionHydrationGroup) {
  useReactionHydration(targetIds, {
    summaryContextUnitId: contextUnitId,
    userContextUnitId: contextUnitId,
  });
  return null;
}

function StreamReactionHydration({ rows }: { rows: readonly StreamRow[] }) {
  const groups = useMemo(() => groupPostReactionTargets(rows), [rows]);
  return (
    <>
      {groups.map((group) => (
        <StreamReactionHydrationGroup
          key={group.contextUnitId ?? GLOBAL_REACTION_CONTEXT_KEY}
          contextUnitId={group.contextUnitId}
          targetIds={group.targetIds}
        />
      ))}
    </>
  );
}

function StreamLoadingRows() {
  return (
    <div className="space-y-4">
      {STREAM_LOADING_ROW_KEYS.map((key) => (
        <div key={key} className="rounded-md bg-surface-subtle p-4">
          <Skeleton className="mb-3 h-5 w-40" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Shared stream renderer：接收后端已经判别好的 `StreamRow` union，由
 * row.type 选择唯一卡片。Mobile 时卡片自身处理窄屏截断；Tablet/Desktop/
 * Ultra-wide 的最终宽度继承父级 stream 容器，renderer 只负责纵向节奏。
 *
 * Mobile
 * +------------------------------+
 * | Row card                     |
 * | Row card                     |
 * +------------------------------+
 *
 * Tablet
 * +--------------------------------------+
 * | Stream card fills parent width       |
 * | Stream card fills parent width       |
 * +--------------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | Type-specific cards, same vertical rhythm      |
 * +------------------------------------------------+
 *
 * Ultra-wide
 * +----------------------------------------------------------+
 * | Parent max-width owns centering and readable line length |
 * +----------------------------------------------------------+
 */
export const StreamRenderer: React.FC<StreamRendererProps> = ({
  rows,
  loading = false,
  emptyTitle,
  renderPostRow,
}) => {
  const { t } = useTranslation("community");
  const effectiveEmptyTitle = emptyTitle ?? t("stream_empty");

  if (loading) return <StreamLoadingRows />;
  if (rows.length === 0) return <EmptyState title={effectiveEmptyTitle} />;

  return (
    <div className="space-y-4">
      <StreamReactionHydration rows={rows} />
      {rows.map((row) => {
        switch (row.type) {
          case "post":
            return renderPostRow ? (
              <div key={row.rowId}>{renderPostRow(row)}</div>
            ) : (
              <StreamPostRowCard
                key={row.rowId}
                row={row}
                hydrateReaction={false}
              />
            );
          case "book":
            return <StreamBookCard key={row.rowId} row={row} />;
          case "shelf":
            return <StreamShelfCard key={row.rowId} row={row} />;
          case "unit":
            return <StreamUnitCard key={row.rowId} row={row} />;
          default:
            return null;
        }
      })}
    </div>
  );
};
