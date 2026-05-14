import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import type React from "react";
import { PostReply } from "../components/item/PostReply";
import { CollapseToggle } from "../components/parts/CollapseToggle";
import { ThreadingHoverProvider } from "../components/parts/ThreadingContext";
import { ReplyComposer } from "../forms/ReplyComposer";
import type { PostTreeNodeModel } from "../models/postTreeRails";
import { PostTreeRail } from "./PostTreeRail";
import {
  AVATAR_CENTER_PX,
  RAIL_HITBOX_PX,
  RAIL_STROKE_PX,
  RAIL_TOP_PX,
  TOGGLE_TOP_PX,
} from "./postTreeLayout";

export interface PostTreeNodeProps {
  node: PostTreeNodeModel;
  rootPostUnitId: string;
  visualMaxDepth: number;
  isCollapsed: (postUnitId: string) => boolean;
  toggleCollapse: (postUnitId: string) => void;
  openComposers: Set<string>;
  highlightedThreadUnitId?: string;
  onReplyClick: (postUnitId: string) => void;
  onComposerDone: (postUnitId: string) => void;
  onThreadHoverChange: (postUnitId: string, hovered: boolean) => void;
}

export function PostTreeNode({
  node,
  rootPostUnitId,
  visualMaxDepth,
  isCollapsed,
  toggleCollapse,
  openComposers,
  highlightedThreadUnitId,
  onReplyClick,
  onComposerDone,
  onThreadHoverChange,
}: PostTreeNodeProps) {
  const { post } = node;
  const collapsed = isCollapsed(post.unitId);
  const hasVisibleChildren = node.children.length > 0 && !collapsed;
  const hasThreadChildren =
    (post.directReplyCount ?? 0) > 0 || node.children.length > 0;
  const composerOpen = openComposers.has(post.unitId);
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
      <div className="relative" data-post-tree-node={post.unitId}>
        <div className="relative">
          {hasVisibleChildren ? (
            <button
              type="button"
              aria-label="Collapse thread"
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

          <PostReply
            post={post}
            showAvatar
            onReply={() => onReplyClick(post.unitId)}
            replyComposerSlot={
              composerOpen ? (
                <ReplyComposer
                  mode="expanded"
                  autoFocus
                  targetUnitId={rootPostUnitId}
                  parentPostUnitId={post.unitId}
                  onSubmitted={() => onComposerDone(post.unitId)}
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
                rootPostUnitId,
                unitId: post.unitId,
              }}
            >
              <span className="text-xs text-text-brand">Continue thread →</span>
            </TextLink>
          </div>
        ) : null}

        {hasVisibleChildren ? (
          <PostTreeRail
            childrenNodes={node.children}
            canIndentChildren={canIndentChildren}
            railColor={railColor}
            onRailEnter={handleRailEnter}
            onRailLeave={handleRailLeave}
            onRailToggle={handleRailToggle}
            renderChild={(child) => (
              <PostTreeNode
                node={child}
                rootPostUnitId={rootPostUnitId}
                visualMaxDepth={visualMaxDepth}
                isCollapsed={isCollapsed}
                toggleCollapse={toggleCollapse}
                openComposers={openComposers}
                highlightedThreadUnitId={highlightedThreadUnitId}
                onReplyClick={onReplyClick}
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
