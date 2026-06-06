import {
  commentQuery,
  commentRootChildrenInfiniteQuery,
} from "@rezics/api/comment/comment";
import { useEditorEntry } from "@rezics/api/hooks";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
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
  const commentSubtreeQuery = useInfiniteQuery(
    commentRootChildrenInfiniteQuery({
      rootUnitId: rootPostUnitId,
      realmUnitId: anchor?.realmUnitId ?? null,
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
          realmUnitId={rootComment.realmUnitId}
          parentCommentId={rootComment.unitId}
        />
      )}
      {isLoading ? (
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

export default ContinueThreadPage;
