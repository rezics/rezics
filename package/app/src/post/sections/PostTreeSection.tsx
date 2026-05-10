import { postThreadQuery } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { PostReply } from "../components/item/PostReply";
import { ReplyComposer } from "../forms/ReplyComposer";
import { usePostTreeCollapse } from "../hooks/usePostTreeCollapse";

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

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_VISUAL_MAX_DEPTH = 4;

export const PostTreeSection: React.FC<PostTreeSectionProps> = ({
  rootPostUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  onReply,
}) => {
  const { data, isLoading } = useQuery(
    postThreadQuery(rootPostUnitId, { mode: "threaded", maxDepth }),
  );
  const posts = data?.posts ?? [];
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div>
      {visiblePosts.map((post) => {
        const depth = post.depth ?? 0;
        const indentLevel = Math.min(depth, visualMaxDepth);
        const atMaxDepth =
          depth === maxDepth && (post.directReplyCount ?? 0) > 0;
        const composerOpen = openComposers.has(post.unitId);

        return (
          <div key={post.unitId}>
            <PostReply
              post={post}
              indentLevel={indentLevel}
              isCollapsed={isCollapsed(post.unitId)}
              onToggleCollapse={() => toggleCollapse(post.unitId)}
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
