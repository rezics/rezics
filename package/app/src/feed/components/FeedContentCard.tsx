import type { FeedContentRow } from "@rezics/api/feed/feed";
import type { ModerationActionDTO, ModerationStatus } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { FeedCard } from "./FeedCard";

export interface FeedContentCardProps {
  row: FeedContentRow;
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
export function FeedContentCard({
  row,
  summaryScopeKey,
  reactionScopeKey,
  manageMode,
  realmModerationStatus,
  realmModerationAt,
  moderationLatestAction,
  moderationMenuContent,
}: FeedContentCardProps) {
  const navigate = useNavigate();
  const openRow = () => navigate({ to: row.href });

  return (
    <FeedCard
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
