import type { FeedContentRow } from "@rezics/api/feed/feed";
import {
  type ModerationActionDTO,
  type ModerationStatus,
  PostKind,
} from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { PostCard } from "@/post";
import { ReviewCard } from "@/review/components/item/ReviewCard";

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

  if (row.post.kind === PostKind.REVIEW) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: nested links and actions provide keyboard access; pointer row open mirrors content cards.
      // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users can use the nested review title/action links.
      <div
        className="cursor-pointer border-b border-border-whisper"
        onClick={openRow}
      >
        <ReviewCard
          review={row.post}
          className="border-b-0"
          targetUnit={
            row.targetUnit?.unitId
              ? {
                  unitId: row.targetUnit.unitId,
                  title: row.targetUnit.title ?? row.targetUnit.unitId,
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <PostCard
      post={row.post}
      onOpen={openRow}
      href={row.href}
      summaryScopeKey={summaryScopeKey}
      reactionScopeKey={reactionScopeKey}
      variantContext={row.variantContext}
      manageMode={manageMode}
      realmModerationStatus={realmModerationStatus}
      realmModerationAt={realmModerationAt}
      moderationLatestAction={moderationLatestAction}
      moderationMenuContent={moderationMenuContent}
    />
  );
}
