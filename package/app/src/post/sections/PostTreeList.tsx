import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { CommentDTO } from "@rezics/contract";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePostTreeCollapse } from "../hooks/usePostTreeCollapse";
import { buildPostTreeNodes } from "../models/postTreeRails";
import { PostTreeNode } from "./PostTreeNode";
import { DEFAULT_MAX_DEPTH, DEFAULT_VISUAL_MAX_DEPTH } from "./postTreeLayout";

export interface PostTreeListProps {
  posts: CommentDTO[];
  rootUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
  baseDepth?: number;
  focusPostUnitId?: string;
  highlightFocusedPost?: boolean;
  onReply?: (postUnitId: string) => void;
  summaryScopeKey?: string | null;
  reactionScopeKey?: string | null;
  renderOverflowContent?: (post: CommentDTO) => React.ReactNode;
}

export function PostTreeList({
  posts,
  rootUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  baseDepth = 0,
  focusPostUnitId,
  highlightFocusedPost = false,
  onReply,
  summaryScopeKey,
  reactionScopeKey,
  renderOverflowContent,
}: PostTreeListProps) {
  const allUnitIds = useMemo(
    () => posts.map((p) => p.unitId).filter(Boolean) as string[],
    [posts],
  );
  useReactionHydration(allUnitIds, {
    summaryScopeKey,
    userScopeKey: reactionScopeKey,
  });
  const [submittedPostUnitId, setSubmittedPostUnitId] = useState<
    string | undefined
  >();
  const revealPostUnitId = submittedPostUnitId ?? focusPostUnitId;
  const highlightedFocusPostUnitId = highlightFocusedPost
    ? focusPostUnitId
    : undefined;
  const { isCollapsed, toggleCollapse, visiblePosts } = usePostTreeCollapse(
    posts,
    {
      baseDepth,
      revealPostUnitId,
    },
  );

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
  const revealPostIsVisible = useMemo(
    () =>
      Boolean(
        revealPostUnitId &&
          visiblePosts.some((post) => post.unitId === revealPostUnitId),
      ),
    [revealPostUnitId, visiblePosts],
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

  const handleComposerSubmitted = useCallback(
    (parentCommentId: string, post: CommentDTO) => {
      setSubmittedPostUnitId(post.unitId);
      handleComposerDone(parentCommentId);
    },
    [handleComposerDone],
  );

  const handleThreadHoverChange = useCallback(
    (postUnitId: string, hovered: boolean) => {
      setHighlightedThreadUnitId((current) => {
        if (hovered) return postUnitId;
        return current === postUnitId ? undefined : current;
      });
    },
    [],
  );

  useEffect(() => {
    if (!revealPostUnitId || !revealPostIsVisible) return;
    const escapedUnitId =
      typeof CSS !== "undefined" && CSS.escape
        ? CSS.escape(revealPostUnitId)
        : revealPostUnitId.replace(/"/g, '\\"');
    const element = document.querySelector<HTMLElement>(
      `[data-post-tree-node="${escapedUnitId}"]`,
    );
    element?.scrollIntoView({ block: "center" });
  }, [revealPostIsVisible, revealPostUnitId]);

  return (
    <div className="relative">
      {treeNodes.map((node) => (
        <PostTreeNode
          key={node.post.unitId}
          node={node}
          rootUnitId={rootUnitId}
          visualMaxDepth={visualMaxDepth}
          isCollapsed={isCollapsed}
          toggleCollapse={toggleCollapse}
          openComposers={openComposers}
          focusedPostUnitId={revealPostUnitId}
          highlightedFocusPostUnitId={highlightedFocusPostUnitId}
          highlightedThreadUnitId={highlightedThreadUnitId}
          onReplyClick={handleReplyClick}
          summaryScopeKey={summaryScopeKey}
          reactionScopeKey={reactionScopeKey}
          renderOverflowContent={renderOverflowContent}
          onComposerSubmitted={handleComposerSubmitted}
          onComposerDone={handleComposerDone}
          onThreadHoverChange={handleThreadHoverChange}
        />
      ))}
    </div>
  );
}
