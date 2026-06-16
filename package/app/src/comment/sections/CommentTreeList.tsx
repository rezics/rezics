import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { CommentDTO } from "@rezics/contract";
import { useEffect, useMemo, useState } from "react";
import { useCommentTreeCollapse } from "../hooks/useCommentTreeCollapse";
import { buildCommentTreeNodes } from "../models/commentTreeRails";
import { CommentTreeNode } from "./CommentTreeNode";
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_VISUAL_MAX_DEPTH,
} from "./commentTreeLayout";

export interface CommentTreeListProps {
  posts: CommentDTO[];
  rootUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
  baseDepth?: number;
  focusPostUnitId?: string;
  highlightFocusedPost?: boolean;
  onReply?: (postUnitId: string) => void;
  summaryContextUnitId?: string | null;
  reactionContextUnitId?: string | null;
  renderOverflowContent?: (post: CommentDTO) => React.ReactNode;
  /**
   * Optional per-comment context badge (realm/direct) rendered by mixed
   * "All" views; single-context views omit it.
   * 可选的逐评论语境徽章（realm/直接），由混合“全部”视图渲染；单一语境
   * 视图省略。
   */
  renderContextBadge?: (post: CommentDTO) => React.ReactNode;
}

export function CommentTreeList({
  posts,
  rootUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  baseDepth = 0,
  focusPostUnitId,
  highlightFocusedPost = false,
  onReply,
  summaryContextUnitId,
  reactionContextUnitId,
  renderOverflowContent,
  renderContextBadge,
}: CommentTreeListProps) {
  const allUnitIds = useMemo(
    () => posts.map((p) => p.unitId).filter(Boolean) as string[],
    [posts],
  );
  useReactionHydration(allUnitIds, {
    summaryContextUnitId,
    userContextUnitId: reactionContextUnitId,
  });
  const [submittedPostUnitId, setSubmittedPostUnitId] = useState<
    string | undefined
  >();
  const revealPostUnitId = submittedPostUnitId ?? focusPostUnitId;
  const highlightedFocusPostUnitId = highlightFocusedPost
    ? focusPostUnitId
    : undefined;
  const { isCollapsed, toggleCollapse, visiblePosts } = useCommentTreeCollapse(
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
      buildCommentTreeNodes({
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

  const handleReplyClick = (postUnitId: string) => {
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
  };

  const handleComposerDone = (postUnitId: string) => {
    setOpenComposers((prev) => {
      if (!prev.has(postUnitId)) return prev;
      const next = new Set(prev);
      next.delete(postUnitId);
      return next;
    });
  };

  const handleComposerSubmitted = (
    parentCommentId: string,
    post: CommentDTO,
  ) => {
    setSubmittedPostUnitId(post.unitId);
    handleComposerDone(parentCommentId);
  };

  const handleThreadHoverChange = (postUnitId: string, hovered: boolean) => {
    setHighlightedThreadUnitId((current) => {
      if (hovered) return postUnitId;
      return current === postUnitId ? undefined : current;
    });
  };

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
        <CommentTreeNode
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
          summaryContextUnitId={summaryContextUnitId}
          reactionContextUnitId={reactionContextUnitId}
          renderOverflowContent={renderOverflowContent}
          renderContextBadge={renderContextBadge}
          onComposerSubmitted={handleComposerSubmitted}
          onComposerDone={handleComposerDone}
          onThreadHoverChange={handleThreadHoverChange}
        />
      ))}
    </div>
  );
}
