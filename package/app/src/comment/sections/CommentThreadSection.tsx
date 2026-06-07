import {
  commentDiscoveryInfiniteQuery,
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
import {
  BasicAdminPermission,
  type CommentDTO,
  type CommentSortMode,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  DropdownMenuItem,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Pencil, RotateCcw, ShieldX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PostEditDialog } from "@/post";
import {
  hasGovernanceCapabilityHint,
  useAuthSessionStore,
} from "@/user/states";
import { CommentPromotionControls } from "../components/parts/CommentPromotionControls";
import { decidePromotionControls } from "../models/commentPromotionGate";
import { mergeCommentDiscoveryRows } from "../models/commentTreeRails";
import { CommentTreeList } from "./CommentTreeList";
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_VISUAL_MAX_DEPTH,
} from "./commentTreeLayout";

const COMMENT_SORT_OPTIONS: CommentSortMode[] = [
  "best",
  "top",
  "rising",
  "controversial",
  "new",
  "old",
];

const COMMENT_SORT_LABEL_KEYS: Record<CommentSortMode, string> = {
  best: "community:comment_sort_best",
  top: "community:comment_sort_top",
  rising: "community:comment_sort_rising",
  controversial: "community:comment_sort_controversial",
  new: "community:comment_sort_new",
  old: "community:comment_sort_old",
};

interface CommentThreadSectionProps {
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

export const CommentThreadSection: React.FC<CommentThreadSectionProps> = ({
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
  const [sort, setSort] = useState<CommentSortMode>("best");
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
  const commentThreadQuery = useInfiniteQuery(
    commentDiscoveryInfiniteQuery({
      rootUnitId,
      realmUnitId: realmUnitId ?? null,
      sort,
      limit: 50,
    }),
  );
  const hasCommentPartition = Boolean(realmUnitId);
  const isLoading = hasCommentPartition && commentThreadQuery.isLoading;
  const posts = useMemo(() => {
    if (!hasCommentPartition) return [];
    return mergeCommentDiscoveryRows(commentThreadQuery.data?.pages ?? []);
  }, [commentThreadQuery.data?.pages, hasCommentPartition]);
  const signalData = hasCommentPartition
    ? commentThreadQuery.data?.pages[0]
    : undefined;

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
          <CommentPromotionControls
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
      {hasCommentPartition ? (
        <div className="mb-3 flex w-full">
          <Select
            value={sort}
            onValueChange={(next) => setSort(next as CommentSortMode)}
          >
            <SelectTrigger className="w-full sm:w-52" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Sort by</SelectLabel>
                {COMMENT_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(COMMENT_SORT_LABEL_KEYS[option])}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <CommentTreeList
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
      {hasCommentPartition && commentThreadQuery.hasNextPage ? (
        <div className="flex justify-center pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={commentThreadQuery.isFetchingNextPage}
            onClick={() => void commentThreadQuery.fetchNextPage()}
          >
            {commentThreadQuery.isFetchingNextPage
              ? t("common:loading")
              : t("common:load_more")}
          </Button>
        </div>
      ) : null}
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
