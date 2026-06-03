import {
  commentListQuery,
  useModerateCommentMutation,
} from "@rezics/api/comment/comment";
import {
  computeEditorEntryDecision,
  useCurrentUserId,
  useServerPermission,
} from "@rezics/api/hooks";
import {
  useAcceptAnswerMutation,
  usePinCommentMutation,
  useUnacceptAnswerMutation,
  useUnpinCommentMutation,
} from "@rezics/api/post/post";
import { BasicAdminPermission, type CommentDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { DropdownMenuItem } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil, RotateCcw, ShieldX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  hasGovernanceCapabilityHint,
  useAuthSessionStore,
} from "@/user/states";
import { PostPromotionControls } from "../components/parts/PostPromotionControls";
import { PostEditDialog } from "../forms/PostEditDialog";
import { decidePromotionControls } from "../models/postPromotionGate";
import { PostTreeList } from "./PostTreeList";
import { DEFAULT_MAX_DEPTH, DEFAULT_VISUAL_MAX_DEPTH } from "./postTreeLayout";

interface PostTreeSectionProps {
  rootUnitId: string;
  realmUnitId?: string | null;
  maxDepth?: number;
  visualMaxDepth?: number;
  focusPostUnitId?: string;
  rootAuthorUserId?: string | null;
  highlightFocusedPost?: boolean;
  summaryScopeKey?: string | null;
  reactionScopeKey?: string | null;
  /**
   * When supplied, overrides the built-in "mount an inline composer" behaviour
   * (used by surfaces that need to navigate or otherwise intercept replies).
   */
  onReply?: (postUnitId: string) => void;
}

export const PostTreeSection: React.FC<PostTreeSectionProps> = ({
  rootUnitId,
  realmUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  focusPostUnitId,
  rootAuthorUserId,
  highlightFocusedPost,
  summaryScopeKey,
  reactionScopeKey,
  onReply,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const permission = useServerPermission();
  const actorUserId = useCurrentUserId();
  const canModerateByCapability = useAuthSessionStore(
    (state) =>
      hasGovernanceCapabilityHint(state, "comment.moderate", {
        kind: "global",
      }) ||
      (realmUnitId
        ? hasGovernanceCapabilityHint(state, "comment.moderate", {
            kind: "realm",
            realmUnitId,
          })
        : false),
  );
  const [editingPost, setEditingPost] = useState<CommentDTO | null>(null);
  const commentThreadQuery = useQuery(
    commentListQuery({
      rootUnitId,
      realmUnitId: realmUnitId ?? "",
      mode: "threaded",
      maxDepth,
      limit: 200,
    }),
  );
  const hasCommentPartition = Boolean(realmUnitId);
  const isLoading = hasCommentPartition && commentThreadQuery.isLoading;
  const posts = useMemo(() => {
    if (!hasCommentPartition) return [];
    return commentThreadQuery.data?.comments ?? [];
  }, [commentThreadQuery.data?.comments, hasCommentPartition]);
  const signalData = hasCommentPartition ? commentThreadQuery.data : undefined;

  // Viewer-derived signals from the thread read. The server is the single
  // authorization source; these only gate the affordance. A stale 403 is
  // handled by the mutations re-syncing the thread on settle.
  const viewerCanPromote = Boolean(signalData?.viewerCanPromote);
  const isQuestionThread = Boolean(signalData?.isQuestionThread);

  const onPromotionError = () =>
    toast.error(t("community:post_pin_action_failed"));
  const pinMutation = usePinCommentMutation({ onError: onPromotionError });
  const unpinMutation = useUnpinCommentMutation({ onError: onPromotionError });
  const acceptMutation = useAcceptAnswerMutation({ onError: onPromotionError });
  const unacceptMutation = useUnacceptAnswerMutation({
    onError: onPromotionError,
  });
  const promotionPending =
    pinMutation.isPending ||
    unpinMutation.isPending ||
    acceptMutation.isPending ||
    unacceptMutation.isPending;
  const commentModeration = useModerateCommentMutation({
    onSuccess: (_data, variables) => {
      toast.success(
        variables.input.action === "restore"
          ? t("community:comment_restore_success")
          : t("community:comment_remove_success"),
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const canModerateComments = Boolean(
    actorUserId &&
      (canModerateByCapability ||
        (permission ? BasicAdminPermission(permission) : false) ||
        (rootAuthorUserId && actorUserId === rootAuthorUserId)),
  );

  const moderateComment = (post: CommentDTO, action: "remove" | "restore") => {
    if (
      !window.confirm(
        action === "restore"
          ? t("community:comment_restore_confirm")
          : t("community:comment_remove_confirm"),
      )
    ) {
      return;
    }

    commentModeration.mutate({
      id: post.id,
      input: {
        action,
        reasonCode:
          action === "restore"
            ? "comment.moderation.restored"
            : "comment.moderation.removed",
      },
    });
  };

  const renderOverflowContent = (post: CommentDTO) => {
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

    const showRestore =
      canModerateComments && post.moderationStatus === "removed";
    const showRemove =
      canModerateComments && post.moderationStatus !== "removed";

    if (
      !decision.canEnter &&
      !canPin &&
      !canAccept &&
      !showRemove &&
      !showRestore
    ) {
      return null;
    }

    const variables = { scopeUnitId: rootUnitId, commentId: post.unitId };

    return (
      <>
        {decision.canEnter && !post.isRedacted ? (
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
        {post.isRedacted ? null : (
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
        )}
        {showRemove ? (
          <DropdownMenuItem
            className="gap-2"
            disabled={commentModeration.isPending}
            onClick={(event) => event.stopPropagation()}
            onSelect={(event) => {
              event.stopPropagation();
              moderateComment(post, "remove");
            }}
          >
            <ShieldX size={16} strokeWidth={2} />
            <span>{t("community:comment_remove_action")}</span>
          </DropdownMenuItem>
        ) : null}
        {showRestore ? (
          <DropdownMenuItem
            className="gap-2"
            disabled={commentModeration.isPending}
            onClick={(event) => event.stopPropagation()}
            onSelect={(event) => {
              event.stopPropagation();
              moderateComment(post, "restore");
            }}
          >
            <RotateCcw size={16} strokeWidth={2} />
            <span>{t("community:comment_restore_action")}</span>
          </DropdownMenuItem>
        ) : null}
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
        rootUnitId={rootUnitId}
        maxDepth={maxDepth}
        visualMaxDepth={visualMaxDepth}
        focusPostUnitId={focusPostUnitId}
        highlightFocusedPost={highlightFocusedPost}
        onReply={onReply}
        summaryScopeKey={summaryScopeKey}
        reactionScopeKey={reactionScopeKey}
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
