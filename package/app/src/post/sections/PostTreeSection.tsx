import { postThreadQuery } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { PostDTO } from "@rezics/contract";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { PostReply } from "../components/item/PostReply";
import { ReplyComposer } from "../forms/ReplyComposer";
import {
  excludeRootPost,
  usePostTreeCollapse,
} from "../hooks/usePostTreeCollapse";
import {
  findNearestVisibleAncestor,
  getContinuationLines,
  getDisplayDepth,
  hasLaterSiblingBranch,
  isDescendantPost,
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
    <div>
      {visiblePosts.map((post, index) => {
        const depth = post.depth ?? 0;
        const displayDepth = Math.max(0, depth - baseDepth);
        const indentLevel = Math.min(displayDepth, visualMaxDepth);
        const atMaxDepth =
          displayDepth === maxDepth && (post.directReplyCount ?? 0) > 0;
        const composerOpen = openComposers.has(post.unitId);
        const hasVisibleDescendants = visiblePosts.some((candidate) =>
          isDescendantPost(post, candidate),
        );
        const hasThreadChildren =
          (post.directReplyCount ?? 0) > 0 || hasVisibleDescendants;
        const parent = findNearestVisibleAncestor(
          visiblePosts.slice(0, index),
          post,
        );
        const parentLine = parent
          ? {
              level: getDisplayDepth(parent, baseDepth, visualMaxDepth),
              postUnitId: parent.unitId,
              continuesAfterElbow: hasLaterSiblingBranch(
                visiblePosts.slice(index + 1),
                parent,
                post,
              ),
            }
          : undefined;
        const continuationLines = getContinuationLines({
          visibleBefore: visiblePosts.slice(0, index),
          visibleAfter: visiblePosts.slice(index + 1),
          post,
          baseDepth,
          visualMaxDepth,
          parentLineLevel: parentLine?.level,
        });

        return (
          <div key={post.unitId}>
            <PostReply
              post={post}
              indentLevel={indentLevel}
              parentLine={parentLine}
              continuationLines={continuationLines}
              highlightedThreadUnitId={highlightedThreadUnitId}
              isCollapsed={isCollapsed(post.unitId)}
              hasThreadChildren={hasThreadChildren}
              hasVisibleDescendants={hasVisibleDescendants}
              onToggleCollapse={() => toggleCollapse(post.unitId)}
              onToggleAncestorCollapse={toggleCollapse}
              onThreadHoverChange={handleThreadHoverChange}
              onReply={() => handleReplyClick(post.unitId)}
              replyComposerSlot={
                composerOpen ? (
                  <ReplyComposer
                    mode="expanded"
                    autoFocus
                    targetUnitId={rootPostUnitId}
                    parentPostUnitId={post.unitId}
                    onSubmitted={() => handleComposerDone(post.unitId)}
                    onCancelled={() => handleComposerDone(post.unitId)}
                  />
                ) : null
              }
            />
            {atMaxDepth && (
              <div
                className="py-1"
                style={{ paddingLeft: `${(indentLevel + 1) * 20}px` }}
              >
                <TextLink
                  to="/post/$rootPostUnitId/continue/$unitId"
                  params={{
                    rootPostUnitId,
                    unitId: post.unitId,
                  }}
                >
                  <span className="text-xs text-text-brand">
                    Continue thread →
                  </span>
                </TextLink>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

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
