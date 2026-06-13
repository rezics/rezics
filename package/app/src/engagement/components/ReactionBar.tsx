import type React from "react";
import { useMemo } from "react";
import { cn } from "@/shared/utils/css-util";
import { useAuthGuard } from "@/user";
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
  /**
   * Builds the absolute-or-relative URL used by the Share popover.
   * 构建 Share 弹出框使用的绝对或相对 URL。
   */
  getShareHref: (post: ReactionBarPost) => string;
  /**
   * Optional hint so `ShelfAction` can render the review-specific dual-mode UI.
   * 可选提示，使 `ShelfAction` 能渲染评论专用的双模式 UI。
   */
  isReview?: boolean;
  /**
   * Optional shelf item target override for non-Unit-backed surfaces.
   * 针对非 Unit 支撑的界面，可选的书架条目目标覆盖。
   */
  shelfItemType?: "unit" | "comment";
  shelfItemKind?:
    | "book"
    | "game"
    | "media"
    | "post"
    | "review"
    | "tag"
    | "shelf"
    | "comment";
  /**
   * Optional title forwarded to the Web Share API.
   * 可选标题，转发给 Web Share API。
   */
  getShareTitle?: (post: ReactionBarPost) => string | undefined;
};

export type ReactionBarProps = {
  post: ReactionBarPost;
  policy: ReactionBarPolicy;
  summaryScopeKey?: string | null;
  reactionScopeKey?: string | null;
  /**
   * Explicit action list — overrides `actionPolicy.actions` when provided.
   * 显式动作列表 — 提供时会覆盖 `actionPolicy.actions`。
   */
  actions?: Action[];
  /**
   * Explicit overflow list — overrides `actionPolicy.overflow` when provided.
   * 显式溢出列表 — 提供时会覆盖 `actionPolicy.overflow`。
   */
  overflow?: Action[];
  /**
   * Alternative to `actions` + `overflow` when the caller already has a policy object.
   * 当调用方已有策略对象时，可替代 `actions` + `overflow`。
   */
  actionPolicy?: ActionPolicy;
  size?: EngagementSize;
  /**
   * Visual treatment. Defaults to `"plain"` (transparent chrome). Use `"pill"`
   * for the segmented capsule that fuses with the host card surface.
   * 视觉处理。默认为 `"plain"`（透明外观）。使用 `"pill"` 可得到与宿主
   * 卡片表面融合的分段胶囊样式。
   */
  variant?: ReactionBarVariant;
  /**
   * Reply-click handler. Fires on main-bar reply and on overflow-menu reply.
   * 回复点击处理器。在主栏回复和溢出菜单回复时触发。
   */
  onReplyInvoke?: () => void;
  /**
   * Render mode for the Reply atom. `"count"` shows number when > 0, `"label"` always shows "Reply".
   * Reply 原子的渲染模式。`"count"` 在大于 0 时显示数字，`"label"` 始终显示 "Reply"。
   */
  replyMode?: "count" | "label";
  /**
   * Optional visible label for the reply/comment action when no count is shown.
   * 当没有显示计数时，回复/评论动作的可选显示文案。
   */
  replyLabel?: string;
  /**
   * Extra caller-owned items rendered in the overflow menu.
   * 在溢出菜单中渲染的由调用方自有的额外条目。
   */
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
  replyLabel?: string;
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
  replyLabel,
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
        // share / shelf 需要各自的弹出框根节点；若它们出现在 overflow
        // 中却没有专用菜单渲染器，则需在调用处把对应 token 移到 `actions`
        // 才能显示出来。
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
    replyLabel,
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
    hidden,
    size,
    variant,
    summaryScopeKey,
    reactionScopeKey,
    replyLabel,
    replyMode,
    shareHref,
    shareTitle,
    handleReplyInvoke,
    handleOverflowInvoke,
    overflowContent,
  } = model;

  const gapClass = reactionBarGapClass(variant, size);

  const handleBarClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleBarKeyDown = (event: React.KeyboardEvent) => {
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
      <div
        className={cn(
          "flex flex-row items-center",
          gapClass,
          wrapClass,
          className,
        )}
        onClick={handleBarClick}
        onKeyDown={handleBarKeyDown}
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
                  label={replyLabel}
                  replyCount={post.replyCount ?? 0}
                  mode={replyMode}
                  onInvoke={handleReplyInvoke}
                />
              );
            case "share":
              return (
                <ShareAction
                  key="share"
                  href={shareHref}
                  title={shareTitle}
                  targetId={post.unitId}
                />
              );
            case "shelf":
              return (
                <ShelfAction
                  key="shelf"
                  targetUnitId={post.unitId}
                  targetItemType={policy.shelfItemType}
                  targetKind={policy.shelfItemKind}
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
    // biome-ignore lint/a11y/noStaticElementInteractions: this wrapper only prevents parent card navigation while menu buttons handle keyboard input.
    <div
      className={className}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
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
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the bar contains interactive buttons and stops parent card navigation. */}
      <div
        className={cn(
          "flex flex-row items-center",
          gapClass,
          model.variant === "pill" ? "flex-nowrap" : "flex-wrap",
          props.className,
        )}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <ReactionActionRow model={model} />
        <ReactionOverflowMenu model={model} />
      </div>
    </ReactionBarProvider>
  );
};
