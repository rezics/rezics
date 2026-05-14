import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { PostDTO } from "@rezics/contract";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { PostReply } from "../components/item/PostReply";
import { CollapseToggle } from "../components/parts/CollapseToggle";
import { ThreadingHoverProvider } from "../components/parts/ThreadingContext";
import { ReplyComposer } from "../forms/ReplyComposer";
import { usePostTreeCollapse } from "../hooks/usePostTreeCollapse";
import {
  buildPostTreeNodes,
  type PostTreeNodeModel,
} from "../models/postTreeRails";

interface PostTreeRoundedRailLabProps {
  posts: PostDTO[];
  rootPostUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_VISUAL_MAX_DEPTH = 4;
const THREAD_INDENT_PX = 32;
const AVATAR_SIZE_PX = 32;
const AVATAR_CENTER_PX = AVATAR_SIZE_PX / 2;
const RAIL_STROKE_PX = 2;
const RAIL_HITBOX_PX = 12;
const ROW_TOP_PADDING_PX = 4;
const RAIL_GAP_PX = 4;
const RAIL_TOP_PX = ROW_TOP_PADDING_PX + AVATAR_SIZE_PX + RAIL_GAP_PX;
const AVATAR_CENTER_Y_PX = ROW_TOP_PADDING_PX + AVATAR_CENTER_PX;
const RAIL_CAP_RADIUS_PX = RAIL_STROKE_PX;
const TERMINAL_RAIL_HEIGHT_PX =
  AVATAR_CENTER_Y_PX - RAIL_STROKE_PX - RAIL_CAP_RADIUS_PX;
const BRANCH_RADIUS_PX = 8;
const TOGGLE_TOP_PX = RAIL_TOP_PX + 8;

export function PostTreeRoundedRailLab({
  posts,
  rootPostUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
}: PostTreeRoundedRailLabProps) {
  const allUnitIds = useMemo(
    () => posts.map((p) => p.unitId).filter(Boolean) as string[],
    [posts],
  );
  useReactionHydration(allUnitIds);
  const { isCollapsed, toggleCollapse, visiblePosts } =
    usePostTreeCollapse(posts);

  const [openComposers, setOpenComposers] = useState<Set<string>>(
    () => new Set(),
  );
  const [highlightedThreadUnitId, setHighlightedThreadUnitId] = useState<
    string | undefined
  >();

  const treeNodes = useMemo(
    () =>
      buildPostTreeNodes({
        posts: visiblePosts,
        baseDepth: 0,
        maxDepth,
        visualMaxDepth,
      }),
    [maxDepth, visiblePosts, visualMaxDepth],
  );

  const handleReplyClick = useCallback((postUnitId: string) => {
    setOpenComposers((prev) => {
      if (prev.has(postUnitId)) return prev;
      const next = new Set(prev);
      next.add(postUnitId);
      return next;
    });
  }, []);

  const handleComposerDone = useCallback((postUnitId: string) => {
    setOpenComposers((prev) => {
      if (!prev.has(postUnitId)) return prev;
      const next = new Set(prev);
      next.delete(postUnitId);
      return next;
    });
  }, []);

  const handleThreadHoverChange = useCallback(
    (postUnitId: string, hovered: boolean) => {
      setHighlightedThreadUnitId((current) => {
        if (hovered) return postUnitId;
        return current === postUnitId ? undefined : current;
      });
    },
    [],
  );

  return (
    <div className="relative p-4" data-rounded-rail-lab>
      {treeNodes.map((node) => (
        <RoundedRailNode
          key={node.post.unitId}
          node={node}
          rootPostUnitId={rootPostUnitId}
          visualMaxDepth={visualMaxDepth}
          isCollapsed={isCollapsed}
          toggleCollapse={toggleCollapse}
          openComposers={openComposers}
          highlightedThreadUnitId={highlightedThreadUnitId}
          onReplyClick={handleReplyClick}
          onComposerDone={handleComposerDone}
          onThreadHoverChange={handleThreadHoverChange}
        />
      ))}
    </div>
  );
}

function RoundedRailNode({
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
}: {
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
}) {
  const { post } = node;
  const collapsed = isCollapsed(post.unitId);
  const hasVisibleChildren = node.children.length > 0 && !collapsed;
  const hasThreadChildren =
    (post.directReplyCount ?? 0) > 0 || node.children.length > 0;
  const composerOpen = openComposers.has(post.unitId);
  const highlighted = highlightedThreadUnitId === post.unitId;
  const canIndentChildren = node.displayDepth < visualMaxDepth;

  const railFillClass = highlighted ? "bg-brand-fill" : "bg-border-whisper";
  const railColorVar = highlighted
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
          <RoundedChildrenRail
            childrenNodes={node.children}
            rootPostUnitId={rootPostUnitId}
            visualMaxDepth={visualMaxDepth}
            canIndentChildren={canIndentChildren}
            isCollapsed={isCollapsed}
            toggleCollapse={toggleCollapse}
            openComposers={openComposers}
            highlightedThreadUnitId={highlightedThreadUnitId}
            onReplyClick={onReplyClick}
            onComposerDone={onComposerDone}
            onThreadHoverChange={onThreadHoverChange}
            railColorVar={railColorVar}
            onRailEnter={handleRailEnter}
            onRailLeave={handleRailLeave}
            onRailToggle={handleRailToggle}
          />
        ) : null}
      </div>
    </ThreadingHoverProvider>
  );
}

interface RoundedChildrenRailProps {
  childrenNodes: PostTreeNodeModel[];
  rootPostUnitId: string;
  visualMaxDepth: number;
  canIndentChildren: boolean;
  isCollapsed: (postUnitId: string) => boolean;
  toggleCollapse: (postUnitId: string) => void;
  openComposers: Set<string>;
  highlightedThreadUnitId?: string;
  onReplyClick: (postUnitId: string) => void;
  onComposerDone: (postUnitId: string) => void;
  onThreadHoverChange: (postUnitId: string, hovered: boolean) => void;
  railColorVar: string;
  onRailEnter: () => void;
  onRailLeave: () => void;
  onRailToggle: (event: React.MouseEvent) => void;
}

function RoundedChildrenRail({
  childrenNodes,
  rootPostUnitId,
  visualMaxDepth,
  canIndentChildren,
  isCollapsed,
  toggleCollapse,
  openComposers,
  highlightedThreadUnitId,
  onReplyClick,
  onComposerDone,
  onThreadHoverChange,
  railColorVar,
  onRailEnter,
  onRailLeave,
  onRailToggle,
}: RoundedChildrenRailProps) {
  const railCenterLeftPx = -THREAD_INDENT_PX + AVATAR_CENTER_PX;
  const lineLeftPx = railCenterLeftPx - RAIL_STROKE_PX / 2;
  const railLeftPx = railCenterLeftPx - RAIL_HITBOX_PX / 2;
  const branchWidthPx = THREAD_INDENT_PX;

  return (
    <div
      className="relative"
      style={{ marginLeft: canIndentChildren ? THREAD_INDENT_PX : 0 }}
    >
      {canIndentChildren ? (
        <>
          <button
            type="button"
            aria-label="Collapse thread"
            className="absolute z-10 cursor-pointer appearance-none border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-brand-fill focus-visible:outline-offset-1"
            style={{
              left: `${railLeftPx}px`,
              top: 0,
              bottom: 0,
              width: `${RAIL_HITBOX_PX}px`,
            }}
            onClick={onRailToggle}
            onMouseEnter={onRailEnter}
            onMouseLeave={onRailLeave}
          />
        </>
      ) : null}
      {childrenNodes.map((child, index) => {
        const isLastChild = index === childrenNodes.length - 1;

        return (
          <div key={child.post.unitId} className="relative">
            {canIndentChildren ? (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-full transition-colors duration-100 ease-in-out"
                  style={{
                    left: `${lineLeftPx}px`,
                    top: 0,
                    bottom: isLastChild ? undefined : 0,
                    height: isLastChild
                      ? `${TERMINAL_RAIL_HEIGHT_PX}px`
                      : undefined,
                    width: `${RAIL_STROKE_PX}px`,
                    borderRadius: `${RAIL_CAP_RADIUS_PX}px`,
                    backgroundColor: railColorVar,
                  }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute box-border border-0 border-b-2 border-solid transition-colors duration-100 ease-in-out"
                  style={{
                    left: `${lineLeftPx}px`,
                    top: 0,
                    width: `${branchWidthPx}px`,
                    height: `${AVATAR_CENTER_Y_PX}px`,
                    borderBottomLeftRadius: `${BRANCH_RADIUS_PX}px`,
                    borderColor: railColorVar,
                  }}
                />
              </>
            ) : null}
            <RoundedRailNode
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
          </div>
        );
      })}
    </div>
  );
}
