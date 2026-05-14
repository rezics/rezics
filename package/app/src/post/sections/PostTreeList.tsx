import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { PostDTO } from "@rezics/contract";
import { useCallback, useMemo, useState } from "react";
import { usePostTreeCollapse } from "../hooks/usePostTreeCollapse";
import { buildPostTreeNodes } from "../models/postTreeRails";
import { PostTreeNode } from "./PostTreeNode";
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_VISUAL_MAX_DEPTH,
} from "./postTreeLayout";

export interface PostTreeListProps {
  posts: PostDTO[];
  rootPostUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
  baseDepth?: number;
  onReply?: (postUnitId: string) => void;
}

export function PostTreeList({
  posts,
  rootPostUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  baseDepth = 0,
  onReply,
}: PostTreeListProps) {
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
}
