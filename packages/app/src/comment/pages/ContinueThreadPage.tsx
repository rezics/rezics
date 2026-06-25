import {
  commentQuery,
  commentRootChildrenInfiniteQuery,
} from "@rezics/contract/api/comment/comment";
import { useEditorEntry } from "@rezics/contract/api/hooks/useEditorEntry";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { QueryErrorDisplay } from "@/core";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import type React from "react";
import { Link } from "@/shared/ui/link";
import { CommentReply } from "../components/item/CommentReply";
import { ReplyComposer } from "../forms/ReplyComposer";
import { useFocusReplyFromQuery } from "../hooks/useFocusReplyFromQuery";
import { mergeCommentChildSliceRows } from "../models/commentTreeRails";
import { CommentTreeList } from "../sections/CommentTreeList";

/**
 * 继续讨论线程页面。显示单个评论及其回复树，支持无限滚动加载更多回复。
 * Continue thread page. Displays a single comment and its reply tree, supports infinite scroll loading.
 *
 * Mobile:            Tablet:             Desktop:            Ultra-wide:
 * ┌──────────────┐   ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────────┐
 * │ [← back]     │   │ [← back]           │ │ [← back]           │ │ [← back]             │
 * │ Root Comment │   │ Root Comment       │ │ Root Comment       │ │ Root Comment         │
 * │ [Edit][Reply]│   │ [Edit] [Reply]     │ │ [Edit]  [Reply]    │ │ [Edit]   [Reply]     │
 * │ Composer     │   │ Composer input     │ │ Composer input     │ │ Composer input       │
 * │ Reply 1      │   │ Reply 1 Reply 2    │ │ Reply 1 Reply 2    │ │ Reply 1 Reply 2      │
 * │ Reply 2      │   │ Reply 3 [Load +]   │ │ Reply 3 [Load +]   │ │ Reply 3 [Load +]     │
 * │ [Load More]  │   │                    │ │                    │ │                      │
 * └──────────────┘   └────────────────────┘ └────────────────────┘ └──────────────────────┘
 */
export const ContinueThreadPage: React.FC = () => {
  const { t } = useTranslation(["common", "community"]);
  const navigate = useNavigate();
  const { rootPostUnitId, unitId } = useParams({ strict: false }) as {
    rootPostUnitId: string;
    unitId: string;
  };
  const composerRef = useFocusReplyFromQuery();
  const commentAnchorQuery = useQuery(commentQuery(unitId));
  const anchor = commentAnchorQuery.data;
  // No context filter: a subtree is already a single partition because every
  // descendant inherits the anchor comment's context server-side.
  // 不加语境过滤：子树本就是单一分区，因为所有后代在服务端继承锚点评论
  // 的语境。
  const commentSubtreeQuery = useInfiniteQuery(
    commentRootChildrenInfiniteQuery({
      rootUnitId: rootPostUnitId,
      rootCommentId: unitId,
      sort: "best",
      limit: 50,
    }),
  );
  const rootPage = commentSubtreeQuery.data?.pages[0];
  const rootComment = rootPage?.rootComment ?? anchor;
  const isAnchorLoading = !rootComment && commentAnchorQuery.isLoading;
  const isLoading = isAnchorLoading ? true : commentSubtreeQuery.isLoading;
  const posts = mergeCommentChildSliceRows(
    commentSubtreeQuery.data?.pages ?? [],
  );
  const editorEntry = useEditorEntry({
    surface: "post",
    ownerUnit: { user: rootComment?.author },
  });

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-4 flex flex-col gap-4">
      <div className="mb-4">
        <Link to="/post/$rootPostUnitId" params={{ rootPostUnitId }}>
          <span className="text-xs text-text-brand">
            {t("community:post_back_to_original_thread")}
          </span>
        </Link>
      </div>
      {rootComment && (
        <div className="flex flex-col gap-2">
          {editorEntry.canEnter ? (
            <div className="self-end">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("common:edit")}
                onClick={() =>
                  navigate({
                    to: "/post/$rootPostUnitId/continue/$unitId/edit",
                    params: { rootPostUnitId, unitId },
                  })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <CommentReply post={rootComment} />
        </div>
      )}
      {rootComment && (
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={rootPostUnitId}
          rootUnitId={rootPostUnitId}
          realmUnitId={rootComment.realmUnitId ?? null}
          parentCommentId={rootComment.unitId}
        />
      )}
      {commentAnchorQuery.isError ? (
        <QueryErrorDisplay error={commentAnchorQuery.error} />
      ) : commentSubtreeQuery.isError ? (
        <QueryErrorDisplay error={commentSubtreeQuery.error} />
      ) : isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : (
        <CommentTreeList
          posts={posts}
          rootUnitId={rootPostUnitId}
          baseDepth={rootComment?.depth ?? 0}
        />
      )}
      {commentSubtreeQuery.hasNextPage ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={commentSubtreeQuery.isFetchingNextPage}
            onClick={() => void commentSubtreeQuery.fetchNextPage()}
          >
            {commentSubtreeQuery.isFetchingNextPage
              ? t("common:loading")
              : t("common:load_more")}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
