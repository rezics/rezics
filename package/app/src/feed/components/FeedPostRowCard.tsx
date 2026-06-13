import type { FeedPostRow } from "@rezics/api/feed/feed";
import type { ModerationActionDTO, ModerationStatus } from "@rezics/contract";
import type React from "react";
import { FeedPostCard } from "./FeedPostCard";

export interface FeedPostRowCardProps {
  row: FeedPostRow;
  summaryContextUnitId?: string | null;
  reactionContextUnitId?: string | null;
  manageMode?: boolean;
  realmModerationStatus?: ModerationStatus;
  realmModerationAt?: string | Date | null;
  moderationLatestAction?: ModerationActionDTO | null;
  moderationMenuContent?: React.ReactNode;
}

/**
 * Generic feed row presentation. Realm-specific moderation stays injected
 * through props so the feed feature does not own realm behavior.
 * 通用信息流行展示。Realm 相关的审核功能通过 props 注入，
 * 使信息流 feature 不持有 realm 行为。
 */
export function FeedPostRowCard({
  row,
  summaryContextUnitId,
  reactionContextUnitId,
  manageMode,
  realmModerationStatus,
  realmModerationAt,
  moderationLatestAction,
  moderationMenuContent,
}: FeedPostRowCardProps) {
  const resolvedSummaryContextUnitId =
    summaryContextUnitId !== undefined
      ? summaryContextUnitId
      : (row.contextUnitId ?? null);
  const resolvedReactionContextUnitId =
    reactionContextUnitId !== undefined
      ? reactionContextUnitId
      : (row.contextUnitId ?? null);

  return (
    <FeedPostCard
      post={row.post}
      href={row.href}
      summaryContextUnitId={resolvedSummaryContextUnitId}
      reactionContextUnitId={resolvedReactionContextUnitId}
      variantContext={row.variantContext}
      targetUnit={
        row.targetUnit?.unitId
          ? {
              unitId: row.targetUnit.unitId,
              title: row.targetUnit.title ?? row.targetUnit.unitId,
            }
          : undefined
      }
      manageMode={manageMode}
      realmModerationStatus={realmModerationStatus}
      realmModerationAt={realmModerationAt}
      moderationLatestAction={moderationLatestAction}
      moderationMenuContent={moderationMenuContent}
    />
  );
}
