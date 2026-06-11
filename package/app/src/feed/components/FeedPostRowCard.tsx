import type { FeedPostRow } from "@rezics/api/feed/feed";
import type { ModerationActionDTO, ModerationStatus } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { FeedPostCard } from "./FeedPostCard";

export interface FeedPostRowCardProps {
  row: FeedPostRow;
  summaryScopeKey?: string;
  reactionScopeKey?: string;
  manageMode?: boolean;
  realmModerationStatus?: ModerationStatus;
  realmModerationAt?: string | Date | null;
  moderationLatestAction?: ModerationActionDTO | null;
  moderationMenuContent?: React.ReactNode;
}

/**
 * Generic feed row presentation. Realm-specific moderation stays injected
 * through props so the feed feature does not own realm behavior.
 */
export function FeedPostRowCard({
  row,
  summaryScopeKey,
  reactionScopeKey,
  manageMode,
  realmModerationStatus,
  realmModerationAt,
  moderationLatestAction,
  moderationMenuContent,
}: FeedPostRowCardProps) {
  const navigate = useNavigate();
  const openRow = () => navigate({ to: row.href });

  return (
    <FeedPostCard
      post={row.post}
      onOpen={openRow}
      onReplyInvoke={() =>
        navigate({
          to: row.href,
          search: { focus: "reply" },
        })
      }
      summaryScopeKey={summaryScopeKey}
      reactionScopeKey={reactionScopeKey}
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
