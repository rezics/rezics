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
import { realmDetailQuery } from "@rezics/api/realm/realm";
import {
  BasicAdminPermission,
  type CommentDTO,
  type CommentListContext,
  type CommentSortMode,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { ConfirmDialog, Spinner } from "@rezics/ui";
import {
  Badge,
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
import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import { Pencil, RotateCcw, ShieldX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";
import { PostEditDialog } from "@/post";
import { hasGovernanceCapabilityHint, useAuthSessionStore } from "@/user";
import { CommentContextSelect } from "../components/parts/CommentContextSelect";
import { CommentPromotionControls } from "../components/parts/CommentPromotionControls";
import {
  buildCommentContextRealmOptions,
  COMMENT_CONTEXT_ALL,
  decideCommentContextBadge,
} from "../models/commentContext";
import { decidePromotionControls } from "../models/commentPromotionGate";
import { mergeCommentDiscoveryRows } from "../models/commentTreeRails";
import { CommentTreeList } from "./CommentTreeList";
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_VISUAL_MAX_DEPTH,
} from "./commentTreeLayout";

interface CommentThreadSectionProps {
  rootUnitId: string;
  /**
   * Surface default for the context selector (zone config realm, realm
   * route realm, or All on direct unit routes). The selector follows this
   * value until the user picks — it is a reactive default, not a controlled
   * value, so a late-loading zone config still lands before interaction.
   * 该界面的语境选择器默认值（专区配置的 realm、realm 路由的 realm，或
   * 直接 Unit 路由的"全部"）。在用户做出选择前，选择器跟随此值——它是
   * 响应式默认值而非受控值，因此延迟加载的专区配置仍能在交互前生效。
   */
  defaultContext?: CommentListContext;
  /**
   * Realm ids the surface already knows for the option list (e.g. the root
   * post's realm). There is no UnitRealm reverse-lookup read endpoint yet,
   * so the options are: default realm (pinned) + these + realms observed
   * on loaded comments.
   * 界面已知的、用于选项列表的 realm id（例如根帖子的 realm）。目前没有
   * UnitRealm 反向查询端点，因此选项为：默认 realm（置顶）+ 这些 id +
   * 已加载评论上观察到的 realm。
   */
  availableRealmUnitIds?: readonly (string | null | undefined)[];
  /**
   * Notifies surfaces that mount a root-level composer of the active
   * context so created comments target the selected partition.
   * 通知挂载根级编辑器的界面当前激活语境，使新建评论写入所选分区。
   */
  onContextChange?: (context: CommentListContext) => void;
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
   * 提供时，会覆盖内置的"挂载内联编辑器"行为
   * （供需要跳转或以其他方式拦截回复的界面使用）。
   */
  onReply?: (postUnitId: string) => void;
}

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

/**
 * 评论线程区块：展示嵌套评论树，支持语境和排序过滤、模运营、提升操作
 * Comment thread section — displays a nested tree of comments with filtering,
 * moderation, and promotion controls. Responsive two-row header: context selector
 * and sort dropdown stack on mobile, inline on wider screens. Infinite-scroll
 * comment tree with edit/moderation actions, pin/accept buttons for questions.
 *
 * Layout Structure:
 *
 * Mobile (<640px):
 *  +---------+
 *  | Context | (full width)
 *  | Selector|
 *  +---------+
 *  | Sort    | (full width)
 *  | Dropdown|
 *  +---------+
 *  | Comment | (tree, left-indented)
 *  | Thread  | (scrollable)
 *  +---------+
 *  | Load... | (centered)
 *  +---------+
 *
 * Tablet (640-1023px):
 *  +---------------+
 *  | Context | Sort| (flex row)
 *  | Selector| DD  |
 *  +---------------+
 *  | Comment Tree  | (nested, indented)
 *  |               |
 *  +---------------+
 *  | Load More     | (centered)
 *  +---------------+
 *
 * Desktop (1024-1535px):
 *  +-------------------+
 *  | Context   | Sort  | (flex row, gap)
 *  | Selector  | Opt.. |
 *  +-------------------+
 *  | Comment Tree      | (full tree, hoverable)
 *  | (nested threads,  |
 *  |  edit/mod/promote)|
 *  +-------------------+
 *  | Load More Button  | (centered)
 *  +-------------------+
 *
 * Ultra-wide (>=1536px):
 *  +----------------------------+
 *  | Context Selector | Sort    | (flex row, full space)
 *  |                  | Options |
 *  +----------------------------+
 *  | Comment Thread (full tree) |
 *  | - Nested structure (5+ lvl)|
 *  | - Edit/Moderate/Promote    |
 *  |   actions in overflow menu |
 *  +----------------------------+
 *  | Load More (if paginated)   |
 *  +----------------------------+
 */
export const CommentThreadSection: React.FC<CommentThreadSectionProps> = ({
  rootUnitId,
  defaultContext,
  availableRealmUnitIds,
  onContextChange,
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
  // The picked context only overrides the surface default after an explicit
  // user choice, so a late-arriving default (zone config) still applies.
  // 仅在用户显式选择后，所选语境才覆盖界面默认值，因此延迟到达的默认值
  // （专区配置）仍能生效。
  const [pickedContext, setPickedContext] = useState<CommentListContext | null>(
    null,
  );
  const context = pickedContext ?? defaultContext ?? COMMENT_CONTEXT_ALL;
  const handleContextChange = (next: CommentListContext) => {
    setPickedContext(next);
    onContextChange?.(next);
  };
  // Moderation affordances follow the selected realm context; the All view
  // falls back to the global capability only. The server stays the single
  // authorization source.
  // 审核入口跟随所选 realm 语境；"全部"视图仅回退到全局能力。服务端仍是
  // 唯一授权来源。
  const contextRealmUnitId =
    context.kind === "realm" ? context.realmUnitId : null;
  const canModerateByCapability = useAuthSessionStore(
    (state) =>
      hasGovernanceCapabilityHint(state, "comment.moderate", {
        kind: "global",
      }) ||
      (contextRealmUnitId
        ? hasGovernanceCapabilityHint(state, "comment.moderate", {
            kind: "realm",
            realmUnitId: contextRealmUnitId,
          })
        : false),
  );
  const [editingPost, setEditingPost] = useState<CommentDTO | null>(null);
  const [moderationPending, setModerationPending] = useState<{
    post: CommentDTO;
    action: "remove" | "restore";
  } | null>(null);
  const commentThreadQuery = useInfiniteQuery(
    commentDiscoveryInfiniteQuery({
      rootUnitId,
      context,
      sort,
      limit: 50,
    }),
  );
  const isLoading = commentThreadQuery.isLoading;
  const isError = commentThreadQuery.isError;
  const queryError = commentThreadQuery.error;
  const posts = useMemo(
    () => mergeCommentDiscoveryRows(commentThreadQuery.data?.pages ?? []),
    [commentThreadQuery.data?.pages],
  );
  const signalData = commentThreadQuery.data?.pages[0];
  const realmOptionIds = useMemo(
    () =>
      buildCommentContextRealmOptions({
        pinnedRealmUnitId:
          defaultContext?.kind === "realm" ? defaultContext.realmUnitId : null,
        knownRealmUnitIds: availableRealmUnitIds,
        observedRealmUnitIds: posts.map((post) => post.realmUnitId),
      }),
    [availableRealmUnitIds, defaultContext, posts],
  );
  const realmDetailResults = useQueries({
    queries: realmOptionIds.map((optionRealmUnitId) =>
      realmDetailQuery(optionRealmUnitId),
    ),
  });
  const realmTitleById = useMemo(() => {
    const titles = new Map<string, string>();
    realmOptionIds.forEach((optionRealmUnitId, index) => {
      const title = realmDetailResults[index]?.data?.title;
      if (title) titles.set(optionRealmUnitId, title);
    });
    return titles;
  }, [realmDetailResults, realmOptionIds]);
  const realmOptions = useMemo(
    () =>
      realmOptionIds.map((optionRealmUnitId) => ({
        realmUnitId: optionRealmUnitId,
        title: realmTitleById.get(optionRealmUnitId) ?? null,
      })),
    [realmOptionIds, realmTitleById],
  );

  // Viewer-derived signals from the thread read. The server is the single
  // authorization source; these only gate the affordance. A stale 403 is
  // handled by the mutations re-syncing the thread on settle.
  // 从线程读取派生出的浏览者信号。服务端是唯一的授权来源；
  // 这些信号仅用于控制交互可见性。过期的 403 由变更操作在结算时
  // 重新同步线程来处理。
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
    setModerationPending({ post, action });
  };

  const confirmModerateComment = () => {
    if (!moderationPending) return;
    const { post, action } = moderationPending;
    setModerationPending(null);
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

  const renderContextBadge = (post: CommentDTO) => {
    const badge = decideCommentContextBadge({
      viewContext: context,
      commentRealmUnitId: post.realmUnitId ?? null,
    });
    if (!badge) return null;
    if (badge.kind === "direct") {
      return (
        <Badge variant="outline" className="text-text-tertiary">
          {t("community:comment_context_badge_direct")}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        {realmTitleById.get(badge.realmUnitId) ?? badge.realmUnitId}
      </Badge>
    );
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
    // 镜像服务端的提升规则：任意回复可置顶/取消置顶，
    // 问题线程的直接（`depth === 1`）回复可被采纳。
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

  if (isError) {
    return <QueryErrorDisplay error={queryError} />;
  }

  return (
    <>
      <div className="mb-3 flex w-full flex-col gap-2 sm:flex-row">
        <CommentContextSelect
          value={context}
          realmOptions={realmOptions}
          onChange={handleContextChange}
        />
        <Select
          value={sort}
          onValueChange={(next) => setSort(next as CommentSortMode)}
        >
          <SelectTrigger
            className="w-full sm:w-52"
            aria-label={t("community:comment_sort_label")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t("community:comment_sort_label")}</SelectLabel>
              {COMMENT_SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(COMMENT_SORT_LABEL_KEYS[option])}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
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
        renderContextBadge={renderContextBadge}
      />
      {commentThreadQuery.hasNextPage ? (
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
      <ConfirmDialog
        open={moderationPending !== null}
        onConfirm={confirmModerateComment}
        onCancel={() => setModerationPending(null)}
        title={
          moderationPending?.action === "restore"
            ? t("community:comment_restore_confirm")
            : t("community:comment_remove_confirm")
        }
        confirmLabel={t("common:confirm")}
        cancelLabel={t("common:cancel")}
        variant={
          moderationPending?.action === "remove" ? "destructive" : "default"
        }
        isPending={commentModeration.isPending}
      />
    </>
  );
};
