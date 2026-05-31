import {
  computeEditorEntryDecision,
  useCurrentUserId,
  useServerPermission,
} from "@rezics/api/hooks";
import { commentListQuery } from "@rezics/api/comment/comment";
import {
  postThreadQuery,
  useAcceptAnswerMutation,
  usePinPostMutation,
  useUnacceptAnswerMutation,
  useUnpinPostMutation,
} from "@rezics/api/post/post";
import type { PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { DropdownMenuItem } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useMemo } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { PostPromotionControls } from "../components/parts/PostPromotionControls";
import { PostEditDialog } from "../forms/PostEditDialog";
import { excludeRootPost } from "../hooks/usePostTreeCollapse";
import { mapCommentToPost } from "../models/commentPostCompat";
import { decidePromotionControls } from "../models/postPromotionGate";
import { PostTreeList } from "./PostTreeList";
import { DEFAULT_MAX_DEPTH, DEFAULT_VISUAL_MAX_DEPTH } from "./postTreeLayout";

interface PostTreeSectionProps {
  rootPostUnitId: string;
  realmUnitId?: string | null;
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
  realmUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  focusPostUnitId,
  highlightFocusedPost,
  onReply,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const permission = useServerPermission();
  const actorUserId = useCurrentUserId();
  const [editingPost, setEditingPost] = useState<PostDTO | null>(null);
  const signalQuery = useQuery({
    ...postThreadQuery(rootPostUnitId, {
      mode: "threaded",
      maxDepth: 0,
      limit: 1,
    }),
    enabled: Boolean(realmUnitId) && !!rootPostUnitId,
  });
  const commentThreadQuery = useQuery(
    commentListQuery({
      rootUnitId: rootPostUnitId,
      realmUnitId: realmUnitId ?? "",
      mode: "threaded",
      maxDepth,
      limit: 200,
    }),
  );
  const legacyThreadQuery = useQuery({
    ...postThreadQuery(rootPostUnitId, { mode: "threaded", maxDepth }),
    enabled: !realmUnitId && !!rootPostUnitId,
  });
  const isCommentThread = Boolean(realmUnitId);
  const isLoading = isCommentThread
    ? commentThreadQuery.isLoading || signalQuery.isLoading
    : legacyThreadQuery.isLoading;
  const posts = useMemo(() => {
    if (isCommentThread) {
      return (commentThreadQuery.data?.comments ?? []).map(mapCommentToPost);
    }
    return excludeRootPost(legacyThreadQuery.data?.posts ?? [], rootPostUnitId);
  }, [
    commentThreadQuery.data?.comments,
    isCommentThread,
    legacyThreadQuery.data?.posts,
    rootPostUnitId,
  ]);
  const signalData = isCommentThread
    ? signalQuery.data
    : legacyThreadQuery.data;

  // Viewer-derived signals from the thread read. The server is the single
  // authorization source; these only gate the affordance. A stale 403 is
  // handled by the mutations re-syncing the thread on settle.
  const viewerCanPromote = Boolean(signalData?.viewerCanPromote);
  const isQuestionThread = Boolean(signalData?.isQuestionThread);

  const onPromotionError = () =>
    toast.error(t("community:post_pin_action_failed"));
  const pinMutation = usePinPostMutation({ onError: onPromotionError });
  const unpinMutation = useUnpinPostMutation({ onError: onPromotionError });
  const acceptMutation = useAcceptAnswerMutation({ onError: onPromotionError });
  const unacceptMutation = useUnacceptAnswerMutation({
    onError: onPromotionError,
  });
  const promotionPending =
    pinMutation.isPending ||
    unpinMutation.isPending ||
    acceptMutation.isPending ||
    unacceptMutation.isPending;

  const renderOverflowContent = (post: PostDTO) => {
    const decision = computeEditorEntryDecision({
      permission,
      actorUserId,
      surface: "post",
      ownerUnit: { user: post.author },
    });

    // Mirror the server's promotion rules: pin/unpin on any reply, accept on a
    // direct (`depth === 1`) reply of a question thread.
    const { canPin, canAccept } = decidePromotionControls({
      viewerCanPromote,
      isQuestionThread,
      hasSession: Boolean(actorUserId),
      depth: post.depth ?? 0,
    });

    if (!decision.canEnter && !canPin && !canAccept) return null;

    const variables = { scopeUnitId: rootPostUnitId, postUnitId: post.unitId };

    return (
      <>
        {decision.canEnter ? (
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
        ) : null}
        <PostPromotionControls
          pinKind={post.pinKind}
          canPin={canPin}
          canAccept={canAccept}
          disabled={promotionPending}
          onPin={() => pinMutation.mutate(variables)}
          onUnpin={() => unpinMutation.mutate(variables)}
          onAccept={() => acceptMutation.mutate(variables)}
          onUnaccept={() => unacceptMutation.mutate(variables)}
        />
      </>
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
