import { Stack } from "@mui/material";
import type React from "react";
import { useMemo } from "react";
import { parseReactionSummaries } from "@/shared/utils/reaction-summaries-parser";
import type {
  Action,
  ActionPolicy,
  EngagementSize,
  ReactionBarVariant,
} from "../types";
import { OverflowMenu } from "./OverflowMenu";
import {
  type ReactionBarContextValue,
  ReactionBarProvider,
} from "./ReactionBarContext";
import { ReplyAction } from "./ReplyAction";
import { ShareAction } from "./ShareAction";
import { ShelfAction } from "./ShelfAction";
import { VoteGroup } from "./VoteGroup";

export type ReactionBarPost = {
  unitId: string;
  reactionSummaries?: unknown[];
  replyCount?: number;
  userReactions?: string[];
};

export type ReactionBarPolicy = {
  /** Builds the absolute-or-relative URL used by the Share popover. */
  getShareHref: (post: ReactionBarPost) => string;
  /** Optional hint so `ShelfAction` can render the review-specific dual-mode UI. */
  isReview?: boolean;
  /** Optional title forwarded to the Web Share API. */
  getShareTitle?: (post: ReactionBarPost) => string | undefined;
};

export type ReactionBarProps = {
  post: ReactionBarPost;
  policy: ReactionBarPolicy;
  /** Explicit action list — overrides `actionPolicy.actions` when provided. */
  actions?: Action[];
  /** Explicit overflow list — overrides `actionPolicy.overflow` when provided. */
  overflow?: Action[];
  /** Alternative to `actions` + `overflow` when the caller already has a policy object. */
  actionPolicy?: ActionPolicy;
  size?: EngagementSize;
  /**
   * Visual treatment. Defaults to `"plain"` (transparent chrome). Use `"pill"`
   * for the segmented capsule that fuses with the host card surface.
   */
  variant?: ReactionBarVariant;
  /** Reply-click handler. Fires on main-bar reply and on overflow-menu reply. */
  onReplyInvoke?: () => void;
  /** Render mode for the Reply atom. `"count"` shows number when > 0, `"label"` always shows "Reply". */
  replyMode?: "count" | "label";
  className?: string;
};

function deriveVoteState(post: ReactionBarPost): {
  score: number;
  userVote: "like" | "dislike" | null;
} {
  const { likes = 0, dislikes = 0 } = parseReactionSummaries(
    (post.reactionSummaries ?? []) as any[],
  );
  const userReactions = post.userReactions ?? [];
  const userVote: "like" | "dislike" | null = userReactions.includes("like")
    ? "like"
    : userReactions.includes("dislike")
      ? "dislike"
      : null;
  return { score: (likes ?? 0) - (dislikes ?? 0), userVote };
}

function resolvePolicy(
  actions: Action[] | undefined,
  overflow: Action[] | undefined,
  actionPolicy: ActionPolicy | undefined,
): { visible: Action[]; hidden: Action[] } {
  const rawActions = actions ?? actionPolicy?.actions ?? [];
  const rawOverflow = overflow ?? actionPolicy?.overflow ?? [];
  const visibleSet = new Set(rawActions);
  const hidden = rawOverflow.filter((token) => !visibleSet.has(token));
  return { visible: rawActions, hidden };
}

export const ReactionBar: React.FC<ReactionBarProps> = ({
  post,
  policy,
  actions,
  overflow,
  actionPolicy,
  size = "md",
  variant = "plain",
  onReplyInvoke,
  replyMode = "count",
  className,
}) => {
  const { visible, hidden } = resolvePolicy(actions, overflow, actionPolicy);
  const { score, userVote } = deriveVoteState(post);
  const shareHref = policy.getShareHref(post);
  const shareTitle = policy.getShareTitle?.(post);

  const handleOverflowInvoke = (token: Action) => {
    switch (token) {
      case "reply":
        onReplyInvoke?.();
        break;
      default:
        // share / shelf require their popover roots; if they appear in
        // overflow without dedicated menu renderers, surface them by moving
        // the token to `actions` at the call site.
        break;
    }
  };

  const spacing =
    variant === "pill"
      ? size === "sm"
        ? 0.5
        : size === "lg"
          ? 1
          : 0.75
      : size === "sm"
        ? 0.25
        : size === "lg"
          ? 1
          : 0.5;

  const handleBarClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const ctx = useMemo<ReactionBarContextValue>(
    () => ({ variant, size }),
    [variant, size],
  );

  const stackSx =
    variant === "pill"
      ? { flexWrap: "nowrap" as const }
      : { flexWrap: "wrap" as const };

  return (
    <ReactionBarProvider value={ctx}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={spacing}
        className={className}
        onClick={handleBarClick}
        sx={stackSx}
      >
        {visible.map((token) => {
          switch (token) {
            case "vote":
              return (
                <VoteGroup
                  key="vote"
                  targetUnitId={post.unitId}
                  initialScore={score}
                  initialUserVote={userVote}
                />
              );
            case "reply":
              return (
                <ReplyAction
                  key="reply"
                  replyCount={post.replyCount ?? 0}
                  mode={replyMode}
                  onInvoke={onReplyInvoke}
                />
              );
            case "share":
              return (
                <ShareAction key="share" href={shareHref} title={shareTitle} />
              );
            case "shelf":
              return (
                <ShelfAction
                  key="shelf"
                  targetUnitId={post.unitId}
                  isReview={policy.isReview}
                />
              );
            case "more":
            case "funny":
            case "award":
              return null;
            default:
              return null;
          }
        })}
        {hidden.length > 0 && (
          <OverflowMenu
            items={hidden}
            size={size}
            onInvoke={handleOverflowInvoke}
          />
        )}
      </Stack>
    </ReactionBarProvider>
  );
};
