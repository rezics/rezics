import { useEditorEntry } from "@rezics/api/hooks";
import { commentListQuery, commentQuery } from "@rezics/api/comment/comment";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import type React from "react";
import { Link } from "@/shared/ui/link";
import { PostReply } from "../components/item/PostReply";
import { ReplyComposer } from "../forms/ReplyComposer";
import { useFocusReplyFromQuery } from "../hooks/useFocusReplyFromQuery";
import { PostTreeList } from "../sections/PostTreeList";

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
  const commentSubtreeQuery = useQuery(
    commentListQuery({
      rootUnitId: rootPostUnitId,
      realmUnitId: anchor?.realmUnitId ?? "",
      mode: "subtree",
      subtreeRootCommentUnitId: unitId,
      maxDepth: 5,
      limit: 200,
    }),
  );
  const isAnchorLoading = !anchor && commentAnchorQuery.isLoading;
  const isLoading = isAnchorLoading ? true : commentSubtreeQuery.isLoading;
  const posts = commentSubtreeQuery.data?.comments ?? [];
  const editorEntry = useEditorEntry({
    surface: "post",
    ownerUnit: { user: anchor?.author },
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
      {anchor && (
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
          <PostReply post={anchor} />
        </div>
      )}
      {anchor && (
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={rootPostUnitId}
          rootUnitId={rootPostUnitId}
          realmUnitId={anchor.realmUnitId}
          parentCommentUnitId={anchor.unitId}
        />
      )}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : (
        <PostTreeList
          posts={posts}
          rootUnitId={rootPostUnitId}
          baseDepth={anchor?.depth ?? 0}
        />
      )}
    </div>
  );
};

export default ContinueThreadPage;
