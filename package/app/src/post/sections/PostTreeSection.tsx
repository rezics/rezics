import { postThreadQuery } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { PostDTO } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { PostReply } from "../components/item/PostReply";
import { CollapseToggle } from "../components/parts/CollapseToggle";
import { ThreadingHoverProvider } from "../components/parts/ThreadingContext";
import { ReplyComposer } from "../forms/ReplyComposer";
import {
  excludeRootPost,
  usePostTreeCollapse,
} from "../hooks/usePostTreeCollapse";
import {
  buildPostTreeNodes,
  type PostTreeNodeModel,
} from "../models/postTreeRails";

interface PostTreeSectionProps {
  rootPostUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
  /**
   * When supplied, overrides the built-in "mount an inline composer" behaviour
   * (used by surfaces that need to navigate or otherwise intercept replies).
   */
  onReply?: (postUnitId: string) => void;
}

interface PostTreeListProps {
  posts: PostDTO[];
  rootPostUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
  baseDepth?: number;
  onReply?: (postUnitId: string) => void;
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_VISUAL_MAX_DEPTH = 4;
const THREAD_INDENT_PX = 44;
const AVATAR_SIZE_PX = 32;
const AVATAR_CENTER_PX = AVATAR_SIZE_PX / 2;
const RAIL_STROKE_PX = 2;
const RAIL_HITBOX_PX = 12;
const ROW_TOP_PADDING_PX = 4;
const RAIL_GAP_PX = 4;
const RAIL_TOP_PX = ROW_TOP_PADDING_PX + AVATAR_SIZE_PX + RAIL_GAP_PX;
const AVATAR_CENTER_Y_PX = ROW_TOP_PADDING_PX + AVATAR_CENTER_PX;
const ELBOW_RADIUS_PX = 10;
const TOGGLE_TOP_PX = RAIL_TOP_PX + 8;

export const PostTreeList: React.FC<PostTreeListProps> = ({
  posts,
  rootPostUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  baseDepth = 0,
  onReply,
}) => {
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
        baseDepth,
        maxDepth,
        visualMaxDepth,
      }),
    [baseDepth, maxDepth, visiblePosts, visualMaxDepth],
  );

  const handleReplyClick = useCallback(
    (postUnitId: string) => {
      if (onReply) {
        onReply(postUnitId);
        return;
      }
      setOpenComposers((prev) => {
        if (prev.has(postUnitId)) return prev;
        const next = new Set(prev);
        next.add(postUnitId);
        return next;
      });
    },
    [onReply],
  );

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
    <div className="relative">
      {treeNodes.map((node) => (
        <PostTreeNode
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
};

function PostTreeNode({
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
                  "absolute left-1/2 top-0 h-full -translate-x-1/2 transition-colors duration-100 ease-in-out",
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
          <div className="pb-2 pl-11">
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
          <div
            className="relative"
            style={{ marginLeft: canIndentChildren ? THREAD_INDENT_PX : 0 }}
          >
            {node.children.map((child, idx) => {
              const isLastChild = idx === node.children.length - 1;
              const railLeftPx =
                -THREAD_INDENT_PX + AVATAR_CENTER_PX - RAIL_HITBOX_PX / 2;
              const railBottom = isLastChild
                ? `calc(100% - ${AVATAR_CENTER_Y_PX}px)`
                : 0;
              const innerRailHeight = isLastChild
                ? `${AVATAR_CENTER_Y_PX - ELBOW_RADIUS_PX}px`
                : "100%";

              return (
                <div key={child.post.unitId} className="relative">
                  {canIndentChildren ? (
                    <>
                      <button
                        type="button"
                        aria-label="Collapse thread"
                        className="absolute z-10 cursor-pointer appearance-none border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-brand-fill focus-visible:outline-offset-1"
                        style={{
                          left: `${railLeftPx}px`,
                          top: 0,
                          bottom: railBottom,
                          width: `${RAIL_HITBOX_PX}px`,
                        }}
                        onClick={handleRailToggle}
                        onMouseEnter={handleRailEnter}
                        onMouseLeave={handleRailLeave}
                      >
                        <span
                          aria-hidden="true"
                          className={[
                            "absolute left-1/2 top-0 -translate-x-1/2 transition-colors duration-100 ease-in-out",
                            railFillClass,
                          ].join(" ")}
                          style={{
                            width: `${RAIL_STROKE_PX}px`,
                            height: innerRailHeight,
                          }}
                        />
                      </button>
                      <svg
                        aria-hidden="true"
                        width={THREAD_INDENT_PX}
                        height={ELBOW_RADIUS_PX}
                        className="pointer-events-none absolute transition-colors duration-100 ease-in-out"
                        style={{
                          left: `${-THREAD_INDENT_PX + AVATAR_CENTER_PX}px`,
                          top: `${AVATAR_CENTER_Y_PX - ELBOW_RADIUS_PX}px`,
                          overflow: "visible",
                          color: railColorVar,
                        }}
                      >
                        <path
                          d={`M 0 0 A ${ELBOW_RADIUS_PX} ${ELBOW_RADIUS_PX} 0 0 0 ${ELBOW_RADIUS_PX} ${ELBOW_RADIUS_PX} H ${THREAD_INDENT_PX}`}
                          stroke="currentColor"
                          strokeWidth={RAIL_STROKE_PX}
                          fill="none"
                        />
                      </svg>
                    </>
                  ) : null}
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
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </ThreadingHoverProvider>
  );
}

export const PostTreeSection: React.FC<PostTreeSectionProps> = ({
  rootPostUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  onReply,
}) => {
  const { data, isLoading } = useQuery(
    postThreadQuery(rootPostUnitId, { mode: "threaded", maxDepth }),
  );
  const posts = useMemo(
    () => excludeRootPost(data?.posts ?? [], rootPostUnitId),
    [data?.posts, rootPostUnitId],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <PostTreeList
      posts={posts}
      rootPostUnitId={rootPostUnitId}
      maxDepth={maxDepth}
      visualMaxDepth={visualMaxDepth}
      onReply={onReply}
    />
  );
};
