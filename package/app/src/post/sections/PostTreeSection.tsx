import { postThreadQuery } from "@rezics/api/post/post";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { excludeRootPost } from "../hooks/usePostTreeCollapse";
import { PostTreeList } from "./PostTreeList";
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_VISUAL_MAX_DEPTH,
} from "./postTreeLayout";

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
