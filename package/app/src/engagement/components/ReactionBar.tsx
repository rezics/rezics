import type React from "react";
import { useMemo } from "react";
import { cn } from "@/shared/utils/css-util";
import { useAuthGuard } from "@/user/hooks/useAuthGuard";
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
  replyCount?: number;
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
  summaryScopeKey?: string | null;
  reactionScopeKey?: string | null;
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
  /** Extra caller-owned items rendered in the overflow menu. */
  overflowContent?: React.ReactNode;
  className?: string;
};

export type ReactionBarModelArgs = Omit<ReactionBarProps, "className">;

export type ReactionBarModel = {
  post: ReactionBarPost;
  policy: ReactionBarPolicy;
  visible: Action[];
  hidden: Action[];
  hasOverflow: boolean;
  size: EngagementSize;
  variant: ReactionBarVariant;
  summaryScopeKey?: string | null;
  reactionScopeKey?: string | null;
  onReplyInvoke?: () => void;
  replyMode: "count" | "label";
  overflowContent?: React.ReactNode;
  authModal: React.ReactNode;
  shareHref: string;
  shareTitle?: string;
  handleReplyInvoke: () => void;
  handleOverflowInvoke: (token: Action) => void;
};

export type ReactionActionRowProps = {
  model: ReactionBarModel;
  className?: string;
};

export type ReactionOverflowMenuProps = {
  model: ReactionBarModel;
  className?: string;
};

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

function reactionBarGapClass(
  variant: ReactionBarVariant,
  size: EngagementSize,
) {
  return variant === "pill"
    ? size === "sm"
      ? "gap-1"
      : size === "lg"
        ? "gap-2"
        : "gap-1.5"
    : size === "sm"
      ? "gap-0.5"
      : size === "lg"
        ? "gap-2"
        : "gap-1";
}

export function useReactionBarModel({
  post,
  policy,
  actions,
  overflow,
  actionPolicy,
  size = "md",
  variant = "plain",
  summaryScopeKey,
  reactionScopeKey,
  onReplyInvoke,
  replyMode = "count",
  overflowContent,
}: ReactionBarModelArgs): ReactionBarModel {
  const authGuard = useAuthGuard();
  const { visible, hidden } = resolvePolicy(actions, overflow, actionPolicy);
  const hasOverflowContent =
    overflowContent !== undefined && overflowContent !== null;
  const hasOverflow = hidden.length > 0 || hasOverflowContent;
  const shareHref = policy.getShareHref(post);
  const shareTitle = policy.getShareTitle?.(post);
  const handleReplyInvoke = () => {
    if (authGuard.requireAuth()) onReplyInvoke?.();
  };

  const handleOverflowInvoke = (token: Action) => {
    switch (token) {
      case "reply":
        handleReplyInvoke();
        break;
      default:
        // share / shelf require their popover roots; if they appear in
        // overflow without dedicated menu renderers, surface them by moving
        // the token to `actions` at the call site.
        break;
    }
  };

  return {
    post,
    policy,
    visible: visible.filter((token) => token !== "more"),
    hidden,
    hasOverflow,
    size,
    variant,
    summaryScopeKey,
    reactionScopeKey,
    onReplyInvoke,
    replyMode,
    overflowContent,
    authModal: authGuard.AuthModal({}),
    shareHref,
    shareTitle,
    handleReplyInvoke,
    handleOverflowInvoke,
  };
}

export const ReactionActionRow: React.FC<ReactionActionRowProps> = ({
  model,
  className,
}) => {
  const {
    post,
    policy,
    visible,
    size,
    variant,
    summaryScopeKey,
    reactionScopeKey,
    replyMode,
    shareHref,
    shareTitle,
    handleReplyInvoke,
  } = model;

  const gapClass = reactionBarGapClass(variant, size);

  const handleBarClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const ctx = useMemo<ReactionBarContextValue>(
    () => ({ variant, size }),
    [variant, size],
  );

  const wrapClass = variant === "pill" ? "flex-nowrap" : "flex-wrap";

  return (
    <ReactionBarProvider value={ctx}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated click handling lets nested actions stop propagation. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the container itself is not an activation target. */}
      <div
        className={cn(
          "flex flex-row items-center",
          gapClass,
          wrapClass,
          className,
        )}
        onClick={handleBarClick}
      >
        {visible.map((token) => {
          switch (token) {
            case "vote":
              return (
                <VoteGroup
                  key="vote"
                  targetUnitId={post.unitId}
                  summaryScopeKey={summaryScopeKey}
                  userScopeKey={reactionScopeKey}
                />
              );
            case "reply":
              return (
                <ReplyAction
                  key="reply"
                  replyCount={post.replyCount ?? 0}
                  mode={replyMode}
                  onInvoke={handleReplyInvoke}
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
              return (
                <OverflowMenu
                  key="more"
                  items={hidden}
                  size={size}
                  onInvoke={handleOverflowInvoke}
                >
                  {overflowContent}
                </OverflowMenu>
              );
            case "funny":
            case "award":
              return null;
            default:
              return null;
          }
        })}
        {model.authModal}
      </div>
    </ReactionBarProvider>
  );
};

export const ReactionOverflowMenu: React.FC<ReactionOverflowMenuProps> = ({
  model,
  className,
}) => {
  if (!model.hasOverflow) return null;

  return (
    <div className={className} onClick={(event) => event.stopPropagation()}>
      <OverflowMenu
        items={model.hidden}
        size={model.size}
        onInvoke={model.handleOverflowInvoke}
      >
        {model.overflowContent}
      </OverflowMenu>
    </div>
  );
};

export const ReactionBar: React.FC<ReactionBarProps> = (props) => {
  const model = useReactionBarModel(props);
  const gapClass = reactionBarGapClass(model.variant, model.size);

  return (
    <ReactionBarProvider value={{ variant: model.variant, size: model.size }}>
      <div
        className={cn(
          "flex flex-row items-center",
          gapClass,
          model.variant === "pill" ? "flex-nowrap" : "flex-wrap",
          props.className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <ReactionActionRow model={model} />
        <ReactionOverflowMenu model={model} />
      </div>
    </ReactionBarProvider>
  );
};
