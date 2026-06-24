import type { CommentDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { TextLink } from "@/shared/ui/link";
import { CommentReply } from "../components/item/CommentReply";
import { CollapseToggle } from "../components/parts/CollapseToggle";
import { ThreadingHoverProvider } from "../components/parts/ThreadingContext";
import { ReplyComposer } from "../forms/ReplyComposer";
import type { CommentTreeNodeModel } from "../models/commentTreeRails";
import { CommentTreeRail } from "./CommentTreeRail";
import {
  AVATAR_CENTER_PX,
  RAIL_HITBOX_PX,
  RAIL_STROKE_PX,
  RAIL_TOP_PX,
  TOGGLE_TOP_PX,
} from "./commentTreeLayout";

export interface CommentTreeNodeProps {
  node: CommentTreeNodeModel;
  rootUnitId: string;
  visualMaxDepth: number;
  isCollapsed: (postUnitId: string) => boolean;
  toggleCollapse: (postUnitId: string) => void;
  openComposers: Set<string>;
  focusedPostUnitId?: string;
  highlightedFocusPostUnitId?: string;
  highlightedThreadUnitId?: string;
  onReplyClick: (postUnitId: string) => void;
  summaryContextUnitId?: string | null;
  reactionContextUnitId?: string | null;
  renderOverflowContent?: (post: CommentDTO) => React.ReactNode;
  renderContextBadge?: (post: CommentDTO) => React.ReactNode;
  onComposerSubmitted: (parentCommentId: string, post: CommentDTO) => void;
  onComposerDone: (postUnitId: string) => void;
  onThreadHoverChange: (postUnitId: string, hovered: boolean) => void;
}

export function CommentTreeNode({
  node,
  rootUnitId,
  visualMaxDepth,
  isCollapsed,
  toggleCollapse,
  openComposers,
  focusedPostUnitId,
  highlightedFocusPostUnitId,
  highlightedThreadUnitId,
  onReplyClick,
  summaryContextUnitId,
  reactionContextUnitId,
  renderOverflowContent,
  renderContextBadge,
  onComposerSubmitted,
  onComposerDone,
  onThreadHoverChange,
}: CommentTreeNodeProps) {
  const { t } = useTranslation(["community"]);
  const { post } = node;
  const collapsed = isCollapsed(post.unitId);
  const hasVisibleChildren = node.children.length > 0 && !collapsed;
  const hasThreadChildren =
    (post.directReplyCount ?? 0) > 0 || node.children.length > 0;
  const composerOpen = openComposers.has(post.unitId);
  const focusHighlighted = highlightedFocusPostUnitId === post.unitId;
  const highlighted = highlightedThreadUnitId === post.unitId;
  const canIndentChildren = node.displayDepth < visualMaxDepth;

  const railFillClass = highlighted ? "bg-brand-fill" : "bg-border-whisper";
  const railColor = highlighted
    ? "var(--colors-brand-fill)"
    : "var(--colors-border-whisper)";

  const handleRailToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    onThreadHoverChange(post.unitId, false);
    toggleCollapse(post.unitId);
  };
  const handleRailEnter = () => onThreadHoverChange(post.unitId, true);
  const handleRailLeave = () => onThreadHoverChange(post.unitId, false);

  return (
    <ThreadingHoverProvider>
      <div
        className={[
          "relative rounded-md transition-colors duration-200",
          focusHighlighted ? "bg-surface-subtle" : "",
        ].join(" ")}
        data-post-tree-node={post.unitId}
      >
        <div className="relative">
          {hasVisibleChildren ? (
            <button
              type="button"
              aria-label={t("community:post_collapse_thread")}
              className="absolute z-10 -translate-x-1/2 cursor-pointer appearance-none border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-brand-fill focus-visible:outline-offset-1"
              style={{
                left: `${AVATAR_CENTER_PX}px`,
                top: `${RAIL_TOP_PX}px`,
                bottom: 0,
                width: `${RAIL_HITBOX_PX}px`,
              }}
              onClick={handleRailToggle}
              onMouseEnter={handleRailEnter}
              onMouseLeave={handleRailLeave}
            >
              <span
                aria-hidden="true"
                className={[
                  "absolute left-1/2 top-0 h-full -translate-x-1/2 rounded-full transition-colors duration-100 ease-in-out",
                  railFillClass,
                ].join(" ")}
                style={{ width: `${RAIL_STROKE_PX}px` }}
              />
            </button>
          ) : null}

          {hasThreadChildren ? (
            <div
              className="absolute z-30 -translate-x-1/2"
              style={{
                left: `${AVATAR_CENTER_PX}px`,
                top: `${TOGGLE_TOP_PX}px`,
              }}
            >
              <CollapseToggle
                isCollapsed={collapsed}
                onToggle={() => toggleCollapse(post.unitId)}
                highlighted={highlighted}
              />
            </div>
          ) : null}

          <CommentReply
            post={post}
            showAvatar
            onReply={() => onReplyClick(post.unitId)}
            summaryContextUnitId={summaryContextUnitId}
            reactionContextUnitId={reactionContextUnitId}
            overflowContent={renderOverflowContent?.(post)}
            contextBadge={renderContextBadge?.(post)}
            replyComposerSlot={
              composerOpen ? (
                <ReplyComposer
                  mode="expanded"
                  autoFocus
                  targetUnitId={rootUnitId}
                  rootUnitId={rootUnitId}
                  realmUnitId={post.realmUnitId ?? null}
                  parentCommentId={post.unitId}
                  onSubmitted={(createdPost) => {
                    if (!("rootUnitId" in createdPost)) return;
                    onComposerSubmitted(post.unitId, createdPost);
                  }}
                  onCancelled={() => onComposerDone(post.unitId)}
                />
              ) : null
            }
          />
        </div>

        {node.atMaxDepth ? (
          <div className="pb-2 pl-8">
            <TextLink
              to="/post/$rootPostUnitId/continue/$unitId"
              params={{
                rootPostUnitId: rootUnitId,
                unitId: post.unitId,
              }}
            >
              <span className="text-xs text-text-brand">
                {t("community:post_continue_thread")}
              </span>
            </TextLink>
          </div>
        ) : null}

        {hasVisibleChildren ? (
          <CommentTreeRail
            childrenNodes={node.children}
            canIndentChildren={canIndentChildren}
            railColor={railColor}
            onRailEnter={handleRailEnter}
            onRailLeave={handleRailLeave}
            onRailToggle={handleRailToggle}
            renderChild={(child) => (
              <CommentTreeNode
                node={child}
                rootUnitId={rootUnitId}
                visualMaxDepth={visualMaxDepth}
                isCollapsed={isCollapsed}
                toggleCollapse={toggleCollapse}
                openComposers={openComposers}
                focusedPostUnitId={focusedPostUnitId}
                highlightedFocusPostUnitId={highlightedFocusPostUnitId}
                highlightedThreadUnitId={highlightedThreadUnitId}
                onReplyClick={onReplyClick}
                summaryContextUnitId={summaryContextUnitId}
                reactionContextUnitId={reactionContextUnitId}
                renderOverflowContent={renderOverflowContent}
                renderContextBadge={renderContextBadge}
                onComposerSubmitted={onComposerSubmitted}
                onComposerDone={onComposerDone}
                onThreadHoverChange={onThreadHoverChange}
              />
            )}
          />
        ) : null}
      </div>
    </ThreadingHoverProvider>
  );
}
