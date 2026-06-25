import type { StreamPostRow } from "@rezics/contract/api/stream/stream.types";
import type { ModerationActionDTO, ModerationStatus } from "@rezics/contract";
import type React from "react";
import { StreamPostCard } from "./StreamPostCard";

export interface StreamPostRowCardProps {
  row: StreamPostRow;
  summaryContextUnitId?: string | null;
  reactionContextUnitId?: string | null;
  hydrateReaction?: boolean;
  manageMode?: boolean;
  realmModerationStatus?: ModerationStatus;
  realmModerationAt?: string | Date | null;
  moderationLatestAction?: ModerationActionDTO | null;
  moderationMenuContent?: React.ReactNode;
}

/**
 * Generic stream row presentation. Realm-specific moderation stays injected
 * through props so the stream feature does not own realm behavior.
 * 通用信息流行展示。Realm 相关的审核功能通过 props 注入，
 * 使信息流 feature 不持有 realm 行为。
 */
export function StreamPostRowCard({
  row,
  summaryContextUnitId,
  reactionContextUnitId,
  hydrateReaction,
  manageMode,
  realmModerationStatus,
  realmModerationAt,
  moderationLatestAction,
  moderationMenuContent,
}: StreamPostRowCardProps) {
  const resolvedSummaryContextUnitId =
    summaryContextUnitId !== undefined
      ? summaryContextUnitId
      : (row.contextUnitId ?? null);
  const resolvedReactionContextUnitId =
    reactionContextUnitId !== undefined
      ? reactionContextUnitId
      : (row.contextUnitId ?? null);

  return (
    <StreamPostCard
      post={row.post}
      href={row.href}
      summaryContextUnitId={resolvedSummaryContextUnitId}
      reactionContextUnitId={resolvedReactionContextUnitId}
      hydrateReaction={hydrateReaction}
      variantContext={row.post.variantContext}
      manageMode={manageMode}
      realmModerationStatus={realmModerationStatus}
      realmModerationAt={realmModerationAt}
      moderationLatestAction={moderationLatestAction}
      moderationMenuContent={moderationMenuContent}
    />
  );
}
