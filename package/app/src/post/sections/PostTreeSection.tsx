import {
  computeEditorEntryDecision,
  useCurrentUserId,
  useServerPermission,
} from "@rezics/api/hooks";
import { postThreadQuery } from "@rezics/api/post/post";
import type { PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { DropdownMenuItem } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useMemo } from "react";
import { useState } from "react";
import { excludeRootPost } from "../hooks/usePostTreeCollapse";
import { PostEditDialog } from "../forms/PostEditDialog";
import { PostTreeList } from "./PostTreeList";
import { DEFAULT_MAX_DEPTH, DEFAULT_VISUAL_MAX_DEPTH } from "./postTreeLayout";

interface PostTreeSectionProps {
  rootPostUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
  focusPostUnitId?: string;
  highlightFocusedPost?: boolean;
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
  focusPostUnitId,
  highlightFocusedPost,
  onReply,
}) => {
  const { t } = useTranslation(["common"]);
const permission = useServerPermission();
  const actorUserId = useCurrentUserId();
  const [editingPost, setEditingPost] = useState<PostDTO | null>(null);
  const { data, isLoading } = useQuery(
    postThreadQuery(rootPostUnitId, { mode: "threaded", maxDepth }),
  );
  const posts = useMemo(
    () => excludeRootPost(data?.posts ?? [], rootPostUnitId),
    [data?.posts, rootPostUnitId],
  );
  const renderOverflowContent = (post: PostDTO) => {
    const decision = computeEditorEntryDecision({
      permission,
      actorUserId,
      surface: "post",
      ownerUnit: { user: post.author },
    });

    if (!decision.canEnter) return null;

    return (
      <DropdownMenuItem
        className="gap-2"
        onClick={(event) => event.stopPropagation()}
        onSelect={(event) => {
          event.stopPropagation();
          setEditingPost(post);
        }}
      >
        <Pencil size={16} strokeWidth={2} />
        <span>{t("common:edit")}</span>
      </DropdownMenuItem>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <>
      <PostTreeList
        posts={posts}
        rootPostUnitId={rootPostUnitId}
        maxDepth={maxDepth}
        visualMaxDepth={visualMaxDepth}
        focusPostUnitId={focusPostUnitId}
        highlightFocusedPost={highlightFocusedPost}
        onReply={onReply}
        renderOverflowContent={renderOverflowContent}
      />
      {editingPost ? (
        <PostEditDialog
          post={editingPost}
          open
          onClose={() => setEditingPost(null)}
        />
      ) : null}
    </>
  );
};
